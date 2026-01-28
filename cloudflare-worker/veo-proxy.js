/**
 * Cloudflare Worker for Veo Video Generation API Proxy
 *
 * This worker handles:
 * 1. CORS preflight requests
 * 2. Initiating video generation requests to Vertex AI
 * 3. Providing a status endpoint for polling
 * 4. Returning the video URL when ready
 *
 * Two-phase approach to avoid Cloudflare Worker CPU time limits:
 * - POST /: Initiates generation, returns operation ID
 * - GET /?operation=<id>: Checks status of operation
 */

// Configuration
const VERTEX_AI_BASE_URL = 'https://us-central1-aiplatform.googleapis.com/v1';
const QUICK_POLL_ATTEMPTS = 3; // Do 3 quick checks during initial request
const POLL_INTERVAL_MS = 2000; // 2 seconds

// CORS headers
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

/**
 * Handle CORS preflight requests
 */
function handleOptions() {
  return new Response(null, {
    headers: CORS_HEADERS
  });
}

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check operation status once
 */
async function checkOperation(operationName, accessToken, projectId) {
  try {
    // For Veo operations, we need to use the :fetchPredictOperation endpoint
    // Extract model info from the operation name to construct the endpoint
    // Operation name format: "projects/{project}/locations/{location}/publishers/google/models/{model}/operations/{id}"

    const projectMatch = operationName.match(/projects\/([^/]+)/);
    const locationMatch = operationName.match(/locations\/([^/]+)/);
    const modelMatch = operationName.match(/models\/([^/]+)/);

    if (!projectMatch || !locationMatch || !modelMatch) {
      throw new Error('Could not parse operation name: ' + operationName);
    }

    const project = projectMatch[1];
    const location = locationMatch[1];
    const model = modelMatch[1];

    // Use fetchPredictOperation endpoint (POST, not GET)
    const fetchUrl = `${VERTEX_AI_BASE_URL}/projects/${project}/locations/${location}/publishers/google/models/${model}:fetchPredictOperation`;

    const response = await fetch(fetchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'x-goog-user-project': projectId,
      },
      body: JSON.stringify({
        operationName: operationName
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Operation check error:', response.status, errorText);
      return {
        status: 'error',
        error: `API returned status ${response.status}: ${errorText}`
      };
    }

    const data = await response.json();

    if (data.done) {
      console.log('✅ Operation complete! Response keys:', Object.keys(data));

      if (data.error) {
        return {
          status: 'error',
          error: data.error.message || 'Operation failed'
        };
      }

      // Extract video URL from response
      try {
        const videoUrl = extractVideoUrl(data.response);
        console.log('📹 Video URL extracted:', videoUrl);
        return {
          status: 'complete',
          videoUrl,
          expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
        };
      } catch (error) {
        console.error('❌ Video URL extraction failed:', error.message);
        console.log('Response structure:', JSON.stringify(data.response).substring(0, 500));
        return {
          status: 'error',
          error: error.message
        };
      }
    }

    // Not done yet
    return {
      status: 'processing',
      operationName
    };

  } catch (error) {
    console.error('Operation check failed:', error);
    return {
      status: 'error',
      error: error.message || 'Failed to check operation status'
    };
  }
}

/**
 * Extract video URL from API response
 */
function extractVideoUrl(response) {
  console.log('Extracting video URL. Response has:', {
    hasPredictions: !!response.predictions,
    hasVideo: !!response.video,
    hasVideoUrl: !!response.videoUrl,
    keys: Object.keys(response || {})
  });

  // Try different possible response formats
  if (response.predictions && response.predictions.length > 0) {
    const prediction = response.predictions[0];
    console.log('Prediction keys:', Object.keys(prediction));

    const videoUrl = prediction.videoUrl ||
                     prediction.videoUri ||
                     prediction.video_url ||
                     prediction.video_uri;

    if (videoUrl) {
      console.log('Found video URL in prediction:', videoUrl.substring(0, 50) + '...');
      return videoUrl;
    }

    if (prediction.video) {
      const url = prediction.video.url || prediction.video.uri;
      if (url) {
        console.log('Found video URL in prediction.video:', url.substring(0, 50) + '...');
        return url;
      }
    }
  }

  if (response.video?.url || response.videoUrl) {
    const url = response.video?.url || response.videoUrl;
    console.log('Found video URL at response level:', url.substring(0, 50) + '...');
    return url;
  }

  // Log a sample of the response for debugging
  const responseSample = JSON.stringify(response).substring(0, 500);
  console.error('Could not find video URL. Response sample:', responseSample);

  throw new Error('No video URL found in response. Check worker logs for response structure.');
}

/**
 * Handle status check request (GET)
 */
async function handleStatusCheck(request) {
  try {
    const url = new URL(request.url);
    const operationName = url.searchParams.get('operation');
    const accessToken = url.searchParams.get('token');
    const projectId = url.searchParams.get('project');

    if (!operationName || !accessToken || !projectId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: operation, token, project' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const result = await checkOperation(operationName, accessToken, projectId);

    return new Response(
      JSON.stringify(result),
      {
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    console.error('Status check error:', error);
    return new Response(
      JSON.stringify({
        status: 'error',
        error: error.message || 'Status check failed'
      }),
      {
        status: 500,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json'
        }
      }
    );
  }
}

/**
 * Handle video generation initiation request (POST)
 */
async function handleInitiateGeneration(request) {
  try {
    const body = await request.json();
    const {
      prompt,
      image,
      durationSeconds = 8,
      aspectRatio = '16:9',
      projectId,
      accessToken
    } = body;

    console.log('🎬 Init:', { duration: durationSeconds, aspectRatio, hasImage: !!image });

    if (!projectId || !accessToken) {
      return new Response(
        JSON.stringify({ error: 'Missing projectId or accessToken' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // Build the request payload
    const instance = { prompt };

    if (image && image.bytesBase64Encoded && image.mimeType) {
      instance.image = {
        bytesBase64Encoded: image.bytesBase64Encoded,
        mimeType: image.mimeType
      };
    }

    const payload = {
      instances: [instance],
      parameters: {
        durationSeconds,
        aspectRatio
      }
    };

    // Make initial request to Vertex AI
    const endpoint = `${VERTEX_AI_BASE_URL}/projects/${projectId}/locations/us-central1/publishers/google/models/veo-3.1-generate-preview:predictLongRunning`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'x-goog-user-project': projectId
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Vertex AI error:', response.status, errorText);

      let errorMessage = `Vertex AI API error (${response.status})`;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error?.message || errorMessage;
      } catch (e) {
        errorMessage += `: ${errorText}`;
      }

      return new Response(
        JSON.stringify({
          status: 'error',
          error: errorMessage
        }),
        { status: response.status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('✅ Initial request successful, operation:', data.name);

    if (!data.name) {
      throw new Error('No operation name in response: ' + JSON.stringify(data));
    }

    // Do a few quick polls to see if it completes fast
    for (let i = 0; i < QUICK_POLL_ATTEMPTS; i++) {
      await sleep(POLL_INTERVAL_MS);

      const result = await checkOperation(data.name, accessToken, projectId);

      if (result.status === 'complete' || result.status === 'error') {
        console.log(`✅ Operation completed on quick poll attempt ${i + 1}`);
        return new Response(
          JSON.stringify(result),
          {
            headers: {
              ...CORS_HEADERS,
              'Content-Type': 'application/json'
            }
          }
        );
      }
    }

    // Still processing, return operation name for client-side polling
    console.log('⏳ Operation still processing, returning operation name for polling');
    return new Response(
      JSON.stringify({
        status: 'processing',
        operationName: data.name,
        message: 'Video generation in progress. Poll status endpoint to check completion.'
      }),
      {
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    console.error('Initiation error:', error);
    return new Response(
      JSON.stringify({
        status: 'error',
        error: error.message || 'Video generation initiation failed'
      }),
      {
        status: 500,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json'
        }
      }
    );
  }
}

/**
 * Main entry point
 */
addEventListener('fetch', event => {
  const { request } = event;

  if (request.method === 'OPTIONS') {
    event.respondWith(handleOptions());
  } else if (request.method === 'POST') {
    event.respondWith(handleInitiateGeneration(request));
  } else if (request.method === 'GET') {
    event.respondWith(handleStatusCheck(request));
  } else {
    event.respondWith(
      new Response('Method not allowed', {
        status: 405,
        headers: CORS_HEADERS
      })
    );
  }
});
