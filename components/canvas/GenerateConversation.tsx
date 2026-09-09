import { IMAGE_GENERATION_MODEL_LABELS } from '../../types';
import React, { useEffect, useRef, useState } from 'react';
import { Download, Plus, Sparkles, X } from 'lucide-react';
import { useAppStore } from '../../store';
import { downloadImage } from '../../lib/download';

export const GenerateConversation: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' });
  }, [state.generateMessages]);
  useEffect(() => {
    if (!preview) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setPreview(null); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [preview]);

  return <>
    <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3 sm:px-6">
      <div><h1 className="text-sm font-medium">Generate</h1><p className="text-xs text-foreground-muted">Conversation and images stay in this session.</p></div>
      <button type="button" disabled={state.isGenerating} onClick={() => dispatch({ type: 'NEW_GENERATE_CONVERSATION' })} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs disabled:opacity-40"><Plus size={14} />New conversation</button>
    </div>
    <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 custom-scrollbar" role="log" aria-label="Image generation conversation">
      <div className="mx-auto max-w-3xl space-y-7 px-4 py-8 sm:px-6">
        {state.generateMessages.length === 0 && <div className="py-12 text-center text-foreground-muted"><Sparkles className="mx-auto mb-4" size={28} /><h2 className="text-xl text-foreground">What would you like to create?</h2><p className="mt-2 text-sm">Describe an image or upload a reference. Then keep refining it here.</p></div>}
        {state.generateMessages.map(message => <article key={message.id} className={message.role === 'user' ? 'ml-auto max-w-[85%] rounded-2xl bg-surface-sunken px-4 py-3' : 'mr-auto w-full'}>
          <p className="mb-2 text-xs text-foreground-muted">{message.role === 'user' ? 'You' : message.model ? IMAGE_GENERATION_MODEL_LABELS[message.model] : 'Nano Banana'}</p>
          {message.content && <p className={`whitespace-pre-wrap break-words text-sm leading-relaxed ${message.status === 'error' ? 'text-red-500' : ''}`}>{message.content}</p>}
          {message.attachments?.map((url, index) => url.startsWith('data:image/') ? <button type="button" key={index} onClick={() => setPreview(url)} className="mt-3 mr-2 inline-block"><img src={url} alt={`Uploaded reference ${index + 1}`} className="h-24 w-24 rounded-lg object-cover" /></button> : <p key={index} className="text-xs">Attached file {index + 1}</p>)}
          {message.images?.map((url, index) => <div key={index} className="mt-3">
            <button type="button" onClick={() => setPreview(url)} aria-label="View generated image" className="block"><img src={url} alt={`Generated image ${index + 1}`} className="max-h-[520px] max-w-full rounded-xl object-contain" /></button>
            <div className="mt-2 flex gap-4 text-xs text-foreground-muted">
              <button type="button" onClick={() => void downloadImage(url, `generated-${message.id}-${index + 1}.png`)} className="flex items-center gap-1"><Download size={13} />Download</button>
              <button type="button" disabled={state.isGenerating} onClick={() => dispatch({ type: 'SET_GENERATE_REFERENCE', payload: url })}>Use as reference</button>
            </div>
          </div>)}
          {message.status === 'pending' && <p role="status" className="flex items-center gap-2 text-sm text-foreground-muted"><Sparkles size={16} className="animate-pulse" />Generating your image… {Math.round(state.progress)}%</p>}
        </article>)}
      </div>
    </div>
    {state.generateReferenceImage && <div className="flex items-center gap-3 px-6 py-2 text-xs"><img src={state.generateReferenceImage} alt="Selected reference" className="h-10 w-10 rounded object-cover" /><span>Using this image for your next message</span><button type="button" aria-label="Remove reference" onClick={() => dispatch({ type: 'SET_GENERATE_REFERENCE', payload: null })}><X size={14} /></button></div>}
    {preview && <div role="dialog" aria-modal="true" aria-label="Image preview" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-8" onClick={() => setPreview(null)}><button autoFocus type="button" aria-label="Close preview" className="absolute right-4 top-4 text-white" onClick={() => setPreview(null)}><X /></button><img src={preview} alt="Full size preview" className="max-h-full max-w-full object-contain" /></div>}
  </>;
};
