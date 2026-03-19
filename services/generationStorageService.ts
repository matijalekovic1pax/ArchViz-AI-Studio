/**
 * Generation Storage Service
 *
 * Uploads generated images to Supabase Storage and records them
 * in the `generations` table for persistent cross-session history.
 */

import { supabase } from '../lib/supabaseClient';

const BUCKET = 'generations';

/** Convert a base64 data URL to a Blob */
function dataUrlToBlob(dataUrl: string): { blob: Blob; ext: string } {
  const [header, data] = dataUrl.split(',');
  const mime = header.match(/data:([^;]+)/)?.[1] ?? 'image/png';
  const ext  = mime === 'image/jpeg' ? 'jpg' : mime === 'image/webp' ? 'webp' : 'png';
  const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0));
  return { blob: new Blob([bytes], { type: mime }), ext };
}

/** Upload a generated image and record it in the generations table. */
export async function saveGeneration(params: {
  userId: string;
  orgId:  string | null;
  mode:   string;
  imageDataUrl: string;
  prompt?: string;
  creditsUsed: number;
}): Promise<string | null> {
  try {
    const { blob, ext } = dataUrlToBlob(params.imageDataUrl);
    const path = `${params.userId}/${params.mode}/${Date.now()}.${ext}`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, { contentType: blob.type, upsert: false });

    if (uploadError) {
      console.error('[storage] upload failed:', uploadError.message);
      return null;
    }

    // Get public URL (works for private buckets with signed URLs too, but we
    // use the path-based approach and generate signed URLs on demand)
    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);

    // Record in generations table
    const { error: insertError } = await supabase
      .from('generations')
      .insert({
        user_id:      params.userId,
        org_id:       params.orgId,
        mode:         params.mode,
        storage_path: path,
        public_url:   publicUrl,
        prompt:       params.prompt ?? null,
        credits_used: params.creditsUsed,
      });

    if (insertError) {
      console.error('[storage] insert failed:', insertError.message);
      // Don't fail — the upload succeeded, just the metadata insert failed
    }

    return publicUrl;
  } catch (err: any) {
    console.error('[storage] saveGeneration error:', err.message);
    return null;
  }
}

export interface GenerationRecord {
  id: string;
  mode: string;
  storage_path: string;
  public_url: string | null;
  prompt: string | null;
  credits_used: number;
  created_at: string;
}

/** Fetch the last N generations for a user (for persistent history). */
export async function fetchGenerationHistory(
  userId: string,
  limit = 50,
): Promise<GenerationRecord[]> {
  const { data, error } = await supabase
    .from('generations')
    .select('id, mode, storage_path, public_url, prompt, credits_used, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[storage] fetchGenerationHistory error:', error.message);
    return [];
  }
  return data ?? [];
}

/** Generate a signed URL for a private bucket file (valid for 1 hour). */
export async function getSignedUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600);

  if (error) {
    console.error('[storage] getSignedUrl error:', error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}
