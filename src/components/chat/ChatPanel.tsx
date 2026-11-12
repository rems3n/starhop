import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { ActionEnv } from '@/ai/actions';
import { useChat } from '@/ai/chat';
import { SPARK } from './ChatLauncher';

const STARTERS: Record<string, string[]> = {
  sky: ['Show me Orion', 'Turn off the lines', 'What is the brightest thing up right now?', 'Show the sky from Sydney tonight at 10'],
  tonight: ['Where is Saturn right now?', 'Show me the Pleiades', 'When is the Moon up tonight?'],
  learn: ['Is there a lesson on moon phases?', 'How do I find the North Star?', 'Show me the Big Dipper'],
  library: ['What is the myth of Andromeda?', 'Show me the Orion Nebula', 'How do I star-hop to Arcturus?'],
  practice: ['Show me Cassiopeia', 'Open the course', 'What can I see tonight?'],
};

export default function ChatPanel({ onClose }: { onClose: () => void }) {
  const items = useChat((s) => s.items);
  const busy = useChat((s) => s.busy);
  const aiEnabled = useChat((s) => s.aiEnabled);
  const send = useChat((s) => s.send);
  const undo = useChat((s) => s.undo);
  const clear = useChat((s) => s.clear);
  const checkStatus = useChat((s) => s.checkStatus);
  const navigate = useNavigate();
  const location = useLocation();
  const [draft, setDraft] = useState('');
  const input = useRef<HTMLTextAreaElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const pathRef = useRef('');
  pathRef.current = location.pathname + location.search;
  const env = useMemo<ActionEnv>(() => ({
    navigate: (path) => {
      pathRef.current = path; // tools that run right after a navigation must already see the new page
      navigate(path);
    },
    path: () => pathRef.current,
  }), [navigate]);

  useEffect(() => { checkStatus(); input.current?.focus(); }, [checkStatus]);
  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight }); }, [items.length, busy]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && document.activeElement === input.current) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const submit = (text: string, preset?: Parameters<typeof send>[2]) => {
    if (!text.trim() || busy) return;
    if (!preset) setDraft('');
    void send(text, env, preset).then(() => input.current?.focus());
  };
  const section = location.pathname.split('/')[1] || 'sky';
  const starters = STARTERS[section] ?? STARTERS.sky;
  const lastUndo = [...items].reverse().find((i) => i.role === 'assistant')?.id;

  return (
    <section className="ch-panel panel" aria-label="Starhop assistant">
      <header className="ch-head">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false"><path d={SPARK} /></svg>
        <h4>Ask Starhop</h4>
        {items.length > 0 && <button type="button" className="ch-link" onClick={clear} disabled={busy}>Clear</button>}
        <button type="button" className="ch-x" onClick={onClose} aria-label="Close the assistant" title="Close (Esc)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden focusable="false"><path d="M5 5l14 14M19 5L5 19" /></svg>
        </button>
      </header>
      <div className="ch-log" ref={log} role="log" aria-live="polite">
        {items.length === 0 && (
          <div className="ch-empty">
            <p>Tell me what you want to see or change, in your own words. If I get it wrong, just say so and I will fix it.</p>
            <div className="ch-starters">
              {starters.map((s) => <button key={s} type="button" className="ch-starter" onClick={() => submit(s)}>{s}</button>)}
            </div>
            {aiEnabled === false && <p className="ch-note">Simple commands work here (show an object, layers on or off, zoom, directions, time). Questions need the full assistant, which is not set up on this server.</p>}
          </div>
        )}
        {items.map((it) => (
          <div key={it.id} className={`ch-msg ch-msg--${it.role}${it.error ? ' is-error' : ''}`}>
            <div className="ch-bubble">{it.text}</div>
            {it.actions && (
              <ul className="ch-actions" aria-label="What changed">
                {it.actions.map((a, i) => <li key={i} className={it.undone ? 'is-undone' : ''}>{a}</li>)}
              </ul>
            )}
            {it.undo && it.id === lastUndo && !it.undone && !busy && <button type="button" className="ch-undo" onClick={() => void undo(it.id, env)}>Undo</button>}
            {it.undone && <span className="ch-undone">Undone</span>}
            {it.chips && it.id === lastUndo && !it.undone && !busy && (
              <div className="ch-chips">
                {it.chips.map((c) => <button key={c.label} type="button" className="ch-undo ch-chip" onClick={() => submit(c.label, c.calls)}>{c.label}</button>)}
              </div>
            )}
          </div>
        ))}
        {busy && <div className="ch-msg ch-msg--assistant"><div className="ch-bubble ch-typing" aria-label="Working"><i /><i /><i /></div></div>}
      </div>
      <form className="ch-form" onSubmit={(e) => { e.preventDefault(); submit(draft); }}>
        <textarea
          ref={input}
          className="ch-input"
          rows={1}
          value={draft}
          maxLength={500}
          placeholder="Show me Orion, turn off lines…"
          aria-label="Message the assistant"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit(draft);
            }
          }}
        />
        <button type="submit" className="ch-send" disabled={busy || !draft.trim()} aria-label="Send">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false"><path d="M3 20.5 21.5 12 3 3.5v6.6L15 12 3 13.9z" /></svg>
        </button>
      </form>
    </section>
  );
}
