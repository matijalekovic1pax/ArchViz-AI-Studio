/** Local real-time trim. Footage stays in the browser until the explicit upload. */
export async function trimVideo(file: File, start: number, length: number, signal: AbortSignal): Promise<File> {
  if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream)
    throw new Error('This browser cannot trim video. Trim to 10 seconds or less in your video editor, then choose the exported clip.');
  const mime = ['video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type));
  if (!mime) throw new Error('Video trimming is unavailable in this browser. Upload a clip already trimmed to 10 seconds or less.');
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.src = url; video.playsInline = true; video.preload = 'auto';
  let stream: MediaStream | undefined;
  let context: AudioContext | undefined;
  let recorder: MediaRecorder | undefined;
  let frame = 0;
  const check = () => { if (signal.aborted) throw new DOMException('Cancelled', 'AbortError'); };
  const waitFor = (event: string) => new Promise<void>((resolve, reject) => {
    const clean = () => { video.removeEventListener(event, done); video.removeEventListener('error', error); signal.removeEventListener('abort', abort); };
    const done = () => { clean(); resolve(); };
    const error = () => { clean(); reject(new Error('This browser cannot decode the video. Export it as MP4 or WebM.')); };
    const abort = () => { clean(); reject(new DOMException('Cancelled', 'AbortError')); };
    video.addEventListener(event, done, { once: true }); video.addEventListener('error', error, { once: true }); signal.addEventListener('abort', abort, { once: true });
  });
  try {
    check();
    if (video.readyState < 1) await waitFor('loadedmetadata');
    check();
    if (start > 0) { const seek = waitFor('seeked'); video.currentTime = start; await seek; }
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.max(2, Math.round(video.videoWidth * scale)); canvas.height = Math.max(2, Math.round(video.videoHeight * scale));
    const drawing = canvas.getContext('2d');
    if (!drawing) throw new Error('Cannot prepare the video preview.');
    drawing.drawImage(video, 0, 0, canvas.width, canvas.height);
    stream = canvas.captureStream(24);
    context = new AudioContext();
    const destination = context.createMediaStreamDestination();
    context.createMediaElementSource(video).connect(destination);
    await context.resume();
    destination.stream.getAudioTracks().forEach(track => stream!.addTrack(track));
    check();
    recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000, audioBitsPerSecond: 128_000 });
    const chunks: Blob[] = [];
    const completed = new Promise<Blob>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout>;
      const clean = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); };
      const abort = () => { clean(); if (recorder?.state !== 'inactive') recorder?.stop(); reject(new DOMException('Cancelled', 'AbortError')); };
      recorder!.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder!.onerror = () => { clean(); reject(new Error('Video trimming failed. Export a short clip from your video editor.')); };
      recorder!.onstop = () => { clean(); resolve(new Blob(chunks, { type: mime.split(';')[0] })); };
      signal.addEventListener('abort', abort, { once: true });
      recorder!.start(200);
      const draw = () => {
        drawing.drawImage(video, 0, 0, canvas.width, canvas.height);
        if (video.currentTime >= start + length || video.ended) { if (recorder!.state !== 'inactive') recorder!.stop(); }
        else frame = requestAnimationFrame(draw);
      };
      video.play().then(() => { frame = requestAnimationFrame(draw); }).catch(error => { clean(); reject(error); });
      // Keep the uploaded clip below the provider's 10-second ceiling, including muxing overhead.
      timer = setTimeout(() => { if (recorder!.state !== 'inactive') recorder!.stop(); }, Math.min(length, 9.8) * 1000);
    });
    const blob = await completed; check();
    if (!blob.size) throw new Error('The trimmed clip is empty. Choose another source.');
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '-trimmed.' + (blob.type === 'video/mp4' ? 'mp4' : 'webm'), { type: blob.type });
  } finally {
    cancelAnimationFrame(frame); video.pause();
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    stream?.getTracks().forEach(track => track.stop());
    await context?.close().catch(() => {});
    video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url);
  }
}
