/** Small inline icons (currentColor). No emoji as icons. */
const PATHS: Record<string, string> = {
  play: 'M7 4.5v15l12-7.5z',
  pause: 'M6 4.5h4.2v15H6zM13.8 4.5H18v15h-4.2z',
  slower: 'M12 5v14L2.5 12zM21.5 5v14L12 12z',
  faster: 'M12 5v14l9.5-7zM2.5 5v14L12 12z',
  stepBack: 'M6 5h2.4v14H6zM19 5v14L9.5 12z',
  stepForward: 'M15.6 5H18v14h-2.4zM5 5v14l9.5-7z',
  plus: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z',
  minus: 'M5 11h14v2H5z',
  close: 'M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12 5 6.4z',
  search: 'M10.5 4a6.5 6.5 0 0 1 5.2 10.4l4 4-1.4 1.4-4-4A6.5 6.5 0 1 1 10.5 4zm0 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z',
  pin: 'M12 2.5a6.5 6.5 0 0 1 6.5 6.5c0 4.6-6.5 12.5-6.5 12.5S5.5 13.6 5.5 9A6.5 6.5 0 0 1 12 2.5zm0 4a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  layers: 'M12 3 2.5 8.2 12 13.4l9.5-5.2zM4.6 11.6 2.5 12.8 12 18l9.5-5.2-2.1-1.2L12 15.7zM4.6 16.2 2.5 17.4 12 22.6l9.5-5.2-2.1-1.2-7.4 4.1z',
  glow: 'M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zM11 1.5h2v3.2h-2zM11 19.3h2v3.2h-2zM1.5 11h3.2v2H1.5zM19.3 11h3.2v2h-3.2zM4.2 5.6l1.4-1.4 2.3 2.3-1.4 1.4zM16.1 17.5l1.4-1.4 2.3 2.3-1.4 1.4zM4.2 18.4l2.3-2.3 1.4 1.4-2.3 2.3zM16.1 6.5l2.3-2.3 1.4 1.4-2.3 2.3z',
  chevronUp: 'M12 8.2l7 7-1.4 1.4-5.6-5.6-5.6 5.6L5 15.2z',
  chevronDown: 'M12 15.8l-7-7 1.4-1.4 5.6 5.6 5.6-5.6L19 8.8z',
  target: 'M11 2h2v3.1a7 7 0 0 1 5.9 5.9H22v2h-3.1a7 7 0 0 1-5.9 5.9V22h-2v-3.1A7 7 0 0 1 5.1 13H2v-2h3.1A7 7 0 0 1 11 5.1zm1 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4z',
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg className="ex-icon" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false">
      <path d={PATHS[name]} />
    </svg>
  );
}
