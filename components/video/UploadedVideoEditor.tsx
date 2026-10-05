import React, { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store';
import { omniUploadAvailability, omniUploadVideo, omniInspectUpload } from '../../services/apiGateway';
import { trimVideo } from '../../lib/videoTrim';
import { cn } from '../../lib/utils';

export function UploadedVideoEditor() {
  const { state, dispatch } = useAppStore();
  const video = state.workflow.videoState;
  const update = (payload: Partial<typeof video>) => dispatch({ type: 'UPDATE_VIDEO_STATE', payload });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [length, setLength] = useState(9.8);
  const [availability, setAvailability] = useState<{ available: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState(false);
  const clip = useRef<HTMLVideoElement>(null);
  const operation = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const source = video.omniSourceVideo;
  useEffect(() => {
    alive.current = true;
    omniUploadAvailability().then(value => { if (alive.current) setAvailability(value); })
      .catch(e => { if (alive.current) { setError(e.message); setAvailability({ available: false, message: 'Sign in to check uploaded-video availability.' }); } });
    return () => { alive.current = false; operation.current?.abort(); };
  }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const clearSource = async () => {
    if (!source) return;
    if (Date.parse(source.expiresAt) <= Date.now()) { update({ omniSourceVideo: null }); return; }
    setRemoving(true);
    try { await omniInspectUpload(source.fileToken, true); update({ omniSourceVideo: null }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not remove the source upload.'); }
    finally { setRemoving(false); }
  };
  const choose = (chosen?: File) => {
    if (!chosen || busy || removing) return;
    setError('');
    if (!['video/mp4', 'video/webm', 'video/quicktime'].includes(chosen.type)) { setError('Choose an MP4, WebM or MOV video.'); return; }
    if (chosen.size > 256 * 1024 * 1024) { setError('Choose a source file smaller than 256 MB. The prepared clip must be 32 MB or less.'); return; }
    if (source) { setError('Remove the current source upload before choosing another clip.'); return; }
    setFile(chosen); setPreview(URL.createObjectURL(chosen)); setDuration(0); setStart(0);
  };
  const prepare = async () => {
    if (!file || !duration || !availability?.available || source) return;
    const controller = new AbortController(); operation.current = controller; setError('');
    let token: string | undefined;
    try {
      const needsTrim = start > 0 || duration > 10 || length < duration - 0.05;
      setBusy(needsTrim ? 'Trimming clip locally…' : 'Uploading clip…');
      const prepared = needsTrim ? await trimVideo(file, start, Math.min(length, duration - start, 9.8), controller.signal) : file;
      if (prepared.size > 32 * 1024 * 1024) throw new Error('The prepared clip is larger than 32 MB. Choose a shorter segment or export at a lower resolution.');
      if (needsTrim && alive.current) { setFile(prepared); setPreview(URL.createObjectURL(prepared)); }
      setBusy('Uploading clip…');
      let result = await omniUploadVideo(prepared, controller.signal); token = result.fileToken;
      // Bounded polling: processing never starts a paid generation.
      const deadline = Date.now() + 180_000;
      while (result.status === 'processing') {
        if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
        if (Date.now() > deadline) throw new Error('Google is still processing the clip. Remove it and upload a smaller MP4 or WebM.');
        setBusy('Google is processing your clip…');
        await new Promise<void>((resolve, reject) => {
          const done = () => { controller.signal.removeEventListener('abort', abort); resolve(); };
          const timer = setTimeout(done, 2000);
          const abort = () => { clearTimeout(timer); controller.signal.removeEventListener('abort', abort); reject(new DOMException('Cancelled', 'AbortError')); };
          controller.signal.addEventListener('abort', abort, { once: true });
        });
        result = await omniInspectUpload(result.fileToken); token = result.fileToken;
      }
      if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      if (!result.name || !result.mimeType || !result.durationSeconds) throw new Error('Google did not return valid video metadata. Upload again.');
      if (alive.current) update({ omniSourceVideo: { fileToken: result.fileToken, name: result.name,
        durationSeconds: result.durationSeconds, mimeType: result.mimeType, expiresAt: result.expiresAt } });
    } catch (e) {
      if (token) await omniInspectUpload(token, true).catch(() => {});
      if (alive.current) setError(e instanceof Error && e.name !== 'AbortError' ? e.message : 'Preparation cancelled.');
    } finally { if (alive.current) setBusy(''); operation.current = null; }
  };
  return <section className="space-y-3" aria-label="Uploaded video source">
    <p className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted">Source Video</p>
    {!availability ? <p className="text-xs text-foreground-muted">Checking upload availability…</p>
      : !availability.available ? <p className="text-xs text-foreground-muted" role="status">{availability.message}</p> : <>
      <label className="block rounded-xl border border-dashed border-border bg-surface-elevated p-3 text-xs cursor-pointer">
        <span className="block font-medium">{file?.name || 'Choose a video'}</span>
        <span className="block mt-1 text-foreground-muted">MP4, WebM, MOV · trim to 10 seconds · upload ≤32 MB</span>
        <input aria-label="Choose source video" type="file" className="mt-2 w-full text-[10px]" accept="video/mp4,video/webm,video/quicktime" disabled={Boolean(busy || source || removing)} onChange={e => { choose(e.target.files?.[0]); e.target.value = ''; }} />
      </label>
      {preview && <video ref={clip} className="w-full rounded-lg bg-black" src={preview} controls playsInline preload="metadata"
        onLoadedMetadata={e => { const value = e.currentTarget.duration;
          if (Number.isFinite(value) && value > 0) { setDuration(value); setLength(Math.min(value, 9.8)); }
          else { e.currentTarget.currentTime = 1e10; } }}
        onDurationChange={e => { const value = e.currentTarget.duration; if (Number.isFinite(value) && value > 0) { setDuration(value); setLength(old => Math.min(old, value, 9.8)); if (e.currentTarget.currentTime > value) e.currentTarget.currentTime = 0; } }}
        onError={() => setError('This browser cannot preview this video. Export it as MP4 or WebM and choose it again.')} />}
      {file && duration > 0 && !source && <>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <label>Start (seconds)<input aria-label="Trim start in seconds" className="mt-1 w-full rounded border border-border bg-surface-elevated p-2" type="number" min={0} max={Math.max(0, duration - 0.2)} step={0.1} value={start} disabled={!!busy}
            onChange={e => { const value = Math.max(0, Math.min(Number(e.target.value), duration - 0.2)); setStart(value); setLength(old => Math.min(old, duration - value)); if (clip.current) clip.current.currentTime = value; }} /></label>
          <label>Length (seconds)<input aria-label="Trim length in seconds" className="mt-1 w-full rounded border border-border bg-surface-elevated p-2" type="number" min={0.2} max={Math.min(9.8, duration - start)} step={0.1} value={Number(length.toFixed(2))} disabled={!!busy}
            onChange={e => setLength(Math.max(0.2, Math.min(Number(e.target.value), 9.8, duration - start)))} /></label>
        </div>
        <p className="text-[10px] text-foreground-muted">Source {duration.toFixed(1)}s · selected {length.toFixed(1)}s. Trimming takes the clip’s length and keeps audio. Keep this tab visible.</p>
        <button type="button" className="w-full rounded-lg bg-foreground text-background py-2 text-xs font-bold disabled:opacity-50" disabled={!!busy} onClick={prepare}>Prepare &amp; Upload Clip</button>
      </>}
    </>}
    {busy && <div className="text-xs" role="status">{busy} <button type="button" className="underline ml-2" onClick={() => operation.current?.abort()}>Cancel</button></div>}
    {source && <div className="rounded-lg border border-border p-3 space-y-2 text-xs">
      <p className="font-medium">Uploaded source ready · {source.durationSeconds.toFixed(1)}s</p>
      <p className="text-[10px] text-foreground-muted">Expires {new Date(source.expiresAt).toLocaleString()}. This source is separate from generated history.</p>
      <button className="underline disabled:opacity-50" disabled={removing || !!busy} onClick={clearSource}>{removing ? 'Removing…' : 'Remove source upload'}</button>
    </div>}
    <div className="grid grid-cols-2 gap-2">
      {(['edit', 'extend'] as const).map(task => <button key={task} type="button" onClick={() => update({ omniFollowUp: task })}
        className={cn('rounded-lg border py-2 text-xs font-bold', video.omniFollowUp === task ? 'bg-foreground text-background border-foreground' : 'border-border bg-surface-elevated')}>
        {task === 'edit' ? 'Edit source' : 'Extend source'}
      </button>)}
    </div>
    <p className="text-[10px] text-foreground-muted">Extension adds footage at the end. Uploaded dialogue continuation and voice editing are not supported.</p>
    {error && <p className="text-xs text-red-400" role="alert">{error}</p>}
  </section>;
}
