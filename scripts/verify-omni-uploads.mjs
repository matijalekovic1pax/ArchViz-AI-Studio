import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { uploadVideo, inspectUpload, sourceVideoContent, uploadAvailability, uploadTokenFromBody, VIDEO_UPLOAD_LIMIT } from '../cloudflare-worker/omniUploads.js';
import worker from '../cloudflare-worker/worker.js';
const env = { JWT_SECRET: 'mock-jwt-signing-secret', GEMINI_API_KEY: 'mock-key' };
const user = { email: 'synthetic@example.test' };
const request = (country = 'US', body = 'synthetic bytes') => {
  const r = new Request('https://gateway.test/api/omni/uploads', { method: 'POST', body, headers: { 'Content-Type': 'video/mp4' } });
  Object.defineProperty(r, 'cf', { value: { country } }); return r;
};
const json = x => new Response(JSON.stringify(x), { headers: { 'Content-Type': 'application/json' } });
const originalFetch = globalThis.fetch;
let calls, file;
function mock() {
  calls = []; file = { name: 'files/test-clip', state: 'ACTIVE', mimeType: 'video/mp4', videoMetadata: { videoDuration: '3.5s' }, expirationTime: new Date(Date.now() + 48*3600000).toISOString() };
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).includes('/upload/v1beta/files')) return new Response('', { headers: { 'x-goog-upload-url': 'https://generativelanguage.googleapis.com/upload-session' } });
    if (String(url).endsWith('/upload-session')) return json({ file });
    if (String(url).includes('/files/test-clip')) return init.method === 'DELETE' ? json({}) : json(file);
    if (String(url).endsWith('/interactions')) return json({ id: 'generated-result', status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'video', data: 'AA==', mime_type: 'video/mp4' }] }] });
    throw new Error('Unexpected provider call: ' + url);
  };
}
const jwt = email => {
  const a=Buffer.from(JSON.stringify({alg:'HS256'})).toString('base64url'), b=Buffer.from(JSON.stringify({email,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');
  return `${a}.${b}.${createHmac('sha256',env.JWT_SECRET).update(`${a}.${b}`).digest('base64url')}`;
};
const signedClaim = claim => { const body=Buffer.from(JSON.stringify(claim)).toString('base64url'); return body+'.'+createHmac('sha256','avas-omni-source-v1:'+env.JWT_SECRET).update(body).digest('base64url'); };
try {
  await test('regional gate rejects every restricted territory and unknown location before contacting Google', async () => {
    mock(); for (const country of 'AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO CH GB XX T1'.split(' ')) {
      assert.equal(uploadAvailability(request(country)).available, false);
      await assert.rejects(uploadVideo(request(country),env,user), e => e.status===403);
    }
    assert.equal(uploadAvailability(new Request('https://gateway.test')).available,false); assert.equal(calls.length,0);
  });
  await test('bounded raw upload, processing to ready, owner binding, tamper rejection, expiry and deletion', async () => {
    mock(); file.state='PROCESSING'; let result=await uploadVideo(request(),env,user); assert.equal(result.status,'processing');
    assert.equal(calls[0].init.headers['x-goog-api-key'],env.GEMINI_API_KEY); assert.equal(calls[1].init.body.size,15);
    await assert.rejects(inspectUpload(request(),env,{email:'other@example.test'},result.fileToken),e=>e.status===403);
    await assert.rejects(inspectUpload(request(),env,user,result.fileToken+'x'),e=>e.status===403);
    await assert.rejects(inspectUpload(request(),env,user,signedClaim({name:file.name,owner:user.email,exp:Date.now()-1})),e=>e.status===403);
    file.state='ACTIVE'; result=await inspectUpload(request(),env,user,result.fileToken); assert.equal(result.durationSeconds,3.5);
    assert.deepEqual(await sourceVideoContent(request(),env,user,result.fileToken),{type:'video',uri:'https://generativelanguage.googleapis.com/v1beta/files/test-clip',mime_type:'video/mp4'});
    assert.equal((await inspectUpload(request('FR'),env,user,result.fileToken,true)).deleted,true);
  });
  await test('provider duration is authoritative, oversize and wrong formats cannot bypass validation', async () => {
    mock(); file.videoMetadata.videoDuration='10.01s'; await assert.rejects(uploadVideo(request(),env,user),e=>e.status===422); assert.ok(calls.some(c=>c.init.method==='DELETE'));
    mock(); delete file.videoMetadata; await assert.rejects(uploadVideo(request(),env,user),e=>e.status===422);
    mock(); await assert.rejects(uploadVideo(request('US',new Uint8Array(VIDEO_UPLOAD_LIMIT+1)),env,user),e=>e.status===413);assert.equal(calls.length,0);
    const r=request();r.headers.set('Content-Type','image/png');await assert.rejects(uploadVideo(r,env,user),e=>e.status===415);
  });
  await test('protected endpoints require app JWT; source capability cannot authenticate to app', async () => {
    mock(); for(const path of ['/api/omni/uploads','/api/omni/uploads/availability']) assert.equal((await worker.fetch(new Request('https://gateway.test'+path),env,{})).status,401);
    const ready=await uploadVideo(request(),env,user); assert.equal((await worker.fetch(new Request('https://gateway.test/api/omni/uploads',{headers:{Authorization:'Bearer '+ready.fileToken}}),env,{})).status,401);
  });
  await test('uploaded edits send video content and explicit task, generated follow-ups send only previous interaction', async () => {
    mock(); const ready=await uploadVideo(request(),env,user);
    const generate=async body=>{const r=new Request('https://gateway.test/api/omni/generate',{method:'POST',headers:{Authorization:'Bearer '+jwt(user.email),'Content-Type':'application/json'},body:JSON.stringify(body)});Object.defineProperty(r,'cf',{value:{country:'US'}});return worker.fetch(r,env,{waitUntil:()=>{}});};
    for(const task of ['edit','extend']) {
      assert.equal((await generate({prompt:'Synthetic instruction',task,sourceVideoToken:ready.fileToken})).status,200);
      const payload=JSON.parse(calls.filter(c=>c.url.endsWith('/interactions')).at(-1).init.body);
      assert.equal(payload.input[0].type,'video');assert.equal(payload.generation_config.video_config.task,task);assert.equal(payload.previous_interaction_id,undefined);
    }
    assert.equal((await generate({prompt:'Synthetic continuation',previousInteractionId:'old-generated-id'})).status,200);
    const chained=JSON.parse(calls.filter(c=>c.url.endsWith('/interactions')).at(-1).init.body);assert.equal(chained.previous_interaction_id,'old-generated-id');assert.equal(chained.generation_config,undefined);
    const before=calls.length;assert.equal((await generate({prompt:'instruction',task:'edit',sourceVideoToken:ready.fileToken,previousInteractionId:'old-id'})).status,400);assert.equal(calls.length,before);
  });
  await test('status token bodies are bounded and processing sources cannot start generation', async () => {
    mock();
    assert.equal(await uploadTokenFromBody(new Request('https://gateway.test', { method: 'POST', body: JSON.stringify({ fileToken: 'private-reference' }) })), 'private-reference');
    await assert.rejects(uploadTokenFromBody(new Request('https://gateway.test', { method: 'POST', body: 'x'.repeat(8193) })), e => e.status === 413);
    file.state='PROCESSING'; const pending=await uploadVideo(request(),env,user);
    await assert.rejects(sourceVideoContent(request(),env,user,pending.fileToken), e=>e.status===409);
    assert.equal(calls.filter(c=>c.url.endsWith('/interactions')).length,0);
    const status=new Request('https://gateway.test/api/omni/uploads/status',{method:'POST',body:JSON.stringify({fileToken:pending.fileToken}),headers:{Authorization:'Bearer '+jwt('other@example.test'),'Content-Type':'application/json'}});
    Object.defineProperty(status,'cf',{value:{country:'US'}});assert.equal((await worker.fetch(status,env,{})).status,403);
  });
  await test('upload readiness requires a source, valid expiry and an explicit instruction', async () => {
    const { build } = await import('esbuild');
    const code=(await build({entryPoints:['lib/videoReadiness.ts'],bundle:true,format:'esm',write:false})).outputFiles[0].text;
    const { getVideoReadiness }=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
    const video={model:'gemini-omni-1.1-flash',inputMode:'video-upload',omniFollowUp:'edit',keyframes:[]};
    const state={prompt:'',workflow:{videoState:video}};
    assert.equal(getVideoReadiness(state).ready,false);
    video.omniSourceVideo={fileToken:'private',expiresAt:new Date(Date.now()+100000).toISOString()};assert.equal(getVideoReadiness(state).ready,false);
    state.prompt='Synthetic edit';assert.equal(getVideoReadiness(state).ready,true);
    video.omniSourceVideo.expiresAt='invalid';assert.equal(getVideoReadiness(state).ready,false);
    video.inputMode='text-to-video';video.omniInteractionId='selected-generated-id';video.omniInteractionExpiresAt=new Date(Date.now()-1).toISOString();assert.equal(getVideoReadiness(state).ready,false);
  });
} finally { globalThis.fetch=originalFetch; }
