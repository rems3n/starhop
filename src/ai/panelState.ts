/** Whether the assistant panel is open. Kept apart from the conversation so the launcher button stays tiny. */
import { create } from 'zustand';

export const useChatPanel = create<{ open: boolean; setOpen(open: boolean): void }>()((set) => ({ open: false, setOpen: (open) => set({ open }) }));
