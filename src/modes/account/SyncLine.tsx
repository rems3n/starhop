/** "Saved to your account 12:31 PM" / "Saving…" / "Not saved: offline". */
import { useAccount } from '@/lib/account';

export function SyncLine() {
  const { sync, lastSaved } = useAccount();
  if (sync === 'saving') return <span>Saving…</span>;
  if (sync === 'offline') return <span className="pf-warn">Could not reach the server; changes are kept here and saved when it is back</span>;
  if (lastSaved) return <span>Saved {new Date(lastSaved).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>;
  return <span>Saved</span>;
}
