/** The always-visible "Ask Starhop" button and the lazily loaded panel it opens. Mounted once in the app shell. */
import { lazy, Suspense } from 'react';
import { useChatPanel } from '@/ai/panelState';
import './chat.css';

const ChatPanel = lazy(() => import('./ChatPanel'));

export const SPARK = 'M12 2l1.8 5.6a4 4 0 0 0 2.6 2.6L22 12l-5.6 1.8a4 4 0 0 0-2.6 2.6L12 22l-1.8-5.6a4 4 0 0 0-2.6-2.6L2 12l5.6-1.8a4 4 0 0 0 2.6-2.6z';

export function ChatLauncher({ sky }: { sky: boolean }) {
  const open = useChatPanel((s) => s.open);
  const setOpen = useChatPanel((s) => s.setOpen);
  return (
    <div className={`ch-root${sky ? ' ch-root--sky' : ''}`}>
      {!open && (
        <button type="button" className="ch-launch" onClick={() => setOpen(true)} aria-label="Ask Starhop: open the assistant">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false"><path d={SPARK} /></svg>
          <span>Ask Starhop</span>
        </button>
      )}
      {open && (
        <Suspense fallback={<div className="ch-panel panel ch-loading" role="status">Loading…</div>}>
          <ChatPanel onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}
