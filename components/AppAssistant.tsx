import React, { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, ChevronDown, Loader2, MessageCircle, RefreshCw, Send, Sparkles, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store';
import type { GenerationMode } from '../types';
import { cn } from '../lib/utils';
import {
  buildAppAssistantPrompt,
  buildAppAssistantWorkspaceSnapshot,
  getAppAssistantFeature,
} from '../lib/appAssistantKnowledge';
import { GeminiService, TEXT_MODEL } from '../services/geminiService';

type AssistantRole = 'user' | 'assistant';

interface AssistantMessage {
  id: string;
  role: AssistantRole;
  content: string;
  isLoading?: boolean;
}

type AssistantThreads = Partial<Record<GenerationMode, AssistantMessage[]>>;

const makeMessageId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const BubbleText: React.FC<{ text: string }> = ({ text }) => (
  <div className="whitespace-pre-wrap break-words">{text}</div>
);

export const AppAssistant: React.FC = () => {
  const { state } = useAppStore();
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);
  const [input, setInput] = useState('');
  const [threads, setThreads] = useState<AssistantThreads>({});
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const service = useMemo(() => new GeminiService({ model: TEXT_MODEL }), []);
  const feature = getAppAssistantFeature(state.mode);
  const messages = threads[state.mode] || [];
  const isThinking = messages.some((message) => message.isLoading);
  const assistantHintKey = 'archviz_assistant_hint_seen';

  const setThreadForMode = (
    mode: GenerationMode,
    updater: (messages: AssistantMessage[]) => AssistantMessage[]
  ) => {
    setThreads((previous) => ({
      ...previous,
      [mode]: updater(previous[mode] || []),
    }));
  };

  useEffect(() => {
    if (!open) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, open, state.mode]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [open, state.mode]);

  useEffect(() => {
    let alreadySeen = false;
    try {
      alreadySeen = sessionStorage.getItem(assistantHintKey) === 'true';
    } catch {
      alreadySeen = false;
    }
    if (alreadySeen) return;

    const showTimer = window.setTimeout(() => setHintVisible(true), 900);
    const hideTimer = window.setTimeout(() => {
      setHintVisible(false);
      try {
        sessionStorage.setItem(assistantHintKey, 'true');
      } catch {}
    }, 8500);

    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  const dismissHint = () => {
    setHintVisible(false);
    try {
      sessionStorage.setItem(assistantHintKey, 'true');
    } catch {}
  };

  const quickPrompts = feature.suggestions.slice(0, 3);

  const submitQuestion = async (rawQuestion: string) => {
    const question = rawQuestion.trim();
    if (!question || isThinking) return;

    const requestMode = state.mode;
    const requestMessages = threads[requestMode] || [];
    const workspaceSnapshot = buildAppAssistantWorkspaceSnapshot(state);
    const userMessage: AssistantMessage = {
      id: makeMessageId(),
      role: 'user',
      content: question,
    };
    const loadingMessage: AssistantMessage = {
      id: makeMessageId(),
      role: 'assistant',
      content: String(t('assistant.thinking', { defaultValue: 'Reading this feature...' })),
      isLoading: true,
    };

    setError(null);
    setInput('');
    setThreadForMode(requestMode, (items) => [...items, userMessage, loadingMessage]);

    try {
      const answer = await service.generateText({
        model: TEXT_MODEL,
        prompt: buildAppAssistantPrompt({
          mode: requestMode,
          question,
          language: i18n.language || 'en',
          messages: [...requestMessages, userMessage],
          workspaceSnapshot,
        }),
        generationConfig: {
          temperature: 0.15,
          topP: 0.9,
          maxOutputTokens: 1000,
          responseModalities: ['TEXT'],
          thinkingConfig: { thinkingLevel: 'low' },
        },
      });

      setThreadForMode(requestMode, (items) =>
        items.map((message) =>
          message.id === loadingMessage.id
            ? {
                ...message,
                content: answer.trim() || String(t('assistant.empty', { defaultValue: 'I could not produce an answer. Try asking again with a little more detail.' })),
                isLoading: false,
              }
            : message
        )
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setThreadForMode(requestMode, (items) =>
        items.map((item) =>
          item.id === loadingMessage.id
            ? {
                ...item,
                content: String(t('assistant.error', { defaultValue: 'I could not reach the assistant right now. Please try again.' })),
                isLoading: false,
              }
            : item
        )
      );
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submitQuestion(input);
  };

  const clearThread = () => {
    setError(null);
    setThreadForMode(state.mode, () => []);
  };

  return (
    <>
      {open && (
        <section
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+8.25rem)] right-3 z-[95] flex h-[min(600px,calc(100svh-9.5rem))] w-[calc(100vw-1.5rem)] max-w-[390px] flex-col overflow-hidden rounded-2xl border border-border bg-surface-elevated shadow-xl lg:bottom-[calc(env(safe-area-inset-bottom)+4rem)] lg:right-3"
          aria-label={String(t('assistant.title', { defaultValue: 'Assistant' }))}
        >
          <header className="border-b border-border-subtle bg-background/95 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-foreground text-background">
                  <Bot size={19} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-sm font-bold text-foreground">
                      {t('assistant.title', { defaultValue: 'Studio Assistant' })}
                    </h2>
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-green-700">
                      {t('assistant.live', { defaultValue: 'Live' })}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-foreground-muted">
                    {t('assistant.contextLabel', { defaultValue: 'Context' })}: {feature.title}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={clearThread}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-surface-sunken hover:text-foreground"
                  title={String(t('assistant.clear', { defaultValue: 'Clear chat' }))}
                  aria-label={String(t('assistant.clear', { defaultValue: 'Clear chat' }))}
                >
                  <RefreshCw size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-surface-sunken hover:text-foreground"
                  title={String(t('common.close'))}
                  aria-label={String(t('common.close'))}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="mt-3 rounded-xl border border-border-subtle bg-surface-sunken px-3 py-2">
              <div className="flex items-start gap-2">
                <Sparkles size={14} className="mt-0.5 shrink-0 text-accent" />
                <p className="line-clamp-2 text-xs leading-relaxed text-foreground-secondary">
                  {feature.summary}
                </p>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto bg-background-secondary/70 px-3 py-3 custom-scrollbar">
            {messages.length === 0 ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-border bg-surface-elevated px-4 py-3 text-sm leading-relaxed text-foreground-secondary">
                  <div className="font-semibold text-foreground">
                    {t('assistant.emptyTitle', { defaultValue: 'Ask about this feature.' })}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-foreground-muted">
                    {t('assistant.emptyBody', {
                      defaultValue: 'I can explain what to upload, which controls matter, and the safest next step for the current workspace.',
                    })}
                  </p>
                </div>
                <div className="space-y-2">
                  {quickPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => void submitQuestion(prompt)}
                      className="w-full rounded-xl border border-border bg-surface-elevated px-3 py-2 text-left text-xs font-medium text-foreground-secondary transition-colors hover:border-border-strong hover:bg-surface-sunken hover:text-foreground"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      'flex',
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm',
                        message.role === 'user'
                          ? 'bg-foreground text-background'
                          : 'border border-border bg-surface-elevated text-foreground-secondary'
                      )}
                    >
                      {message.isLoading ? (
                        <div className="flex items-center gap-2 text-foreground-muted">
                          <Loader2 size={14} className="animate-spin" />
                          <span>{message.content}</span>
                        </div>
                      ) : (
                        <BubbleText text={message.content} />
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {error && (
            <div className="border-t border-red-200 bg-red-50 px-4 py-2 text-xs text-red-800">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="border-t border-border bg-background px-3 py-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void submitQuestion(input);
                  }
                }}
                rows={1}
                className="max-h-28 min-h-[42px] flex-1 resize-none rounded-xl border border-border bg-surface-elevated px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-border-strong focus:bg-background"
                placeholder={String(t('assistant.placeholder', { defaultValue: `Ask about ${feature.title}...` }))}
                disabled={isThinking}
              />
              <button
                type="submit"
                disabled={!input.trim() || isThinking}
                className={cn(
                  'flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl transition-all',
                  !input.trim() || isThinking
                    ? 'bg-surface-sunken text-foreground-muted'
                    : 'bg-foreground text-background hover:scale-105 active:scale-95'
                )}
                aria-label={String(t('assistant.send', { defaultValue: 'Send' }))}
              >
                {isThinking ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
              </button>
            </div>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => {
          dismissHint();
          setOpen((value) => !value);
        }}
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] right-3 z-[90] flex h-11 w-11 items-center justify-center rounded-full border border-border/80 bg-foreground text-background shadow-xl transition-all hover:-translate-y-0.5 hover:shadow-elevated active:scale-95 lg:bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] lg:right-3"
        aria-label={String(t('assistant.open', { defaultValue: 'Open assistant' }))}
        aria-expanded={open}
      >
        {open ? <ChevronDown size={18} /> : <MessageCircle size={18} />}
        {!open && (
          <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full border-2 border-background bg-green-500" />
        )}
      </button>

      {hintVisible && !open && (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+8rem)] right-3 z-[89] max-w-[220px] animate-fade-in rounded-xl border border-border bg-surface-elevated px-3 py-2 text-xs leading-relaxed text-foreground-secondary shadow-lg lg:bottom-[calc(env(safe-area-inset-bottom)+4rem)]">
          <button
            type="button"
            onClick={dismissHint}
            className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-md text-foreground-muted transition-colors hover:bg-surface-sunken hover:text-foreground"
            aria-label={String(t('common.close'))}
          >
            <X size={12} />
          </button>
          <div className="pr-5 font-semibold text-foreground">
            {t('assistant.hintTitle', { defaultValue: 'Need help?' })}
          </div>
          <div className="mt-0.5 pr-3 text-[11px] text-foreground-muted">
            {t('assistant.hintBody', {
              feature: feature.title,
              defaultValue: `Ask the assistant about ${feature.title}.`,
            })}
          </div>
        </div>
      )}
    </>
  );
};
