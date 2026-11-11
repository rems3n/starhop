const ROWS: [string, string][] = [
  ['Drag', 'Look around'],
  ['Scroll wheel or pinch', 'Zoom in and out'],
  ['Click or tap', 'Select a star, planet, object or constellation name'],
  ['Double-click or double-tap', 'Centre that spot'],
  ['House button, Home or 0', 'Reset the view: face north, horizon at the bottom'],
  ['/', 'Search'],
  ['Space', 'Play or pause time'],
  ['Arrow keys', 'Pan (click the sky first)'],
  ['+ and −', 'Zoom (click the sky first)'],
  ['Esc', 'Close the open panel'],
];

export function HelpPanel() {
  return (
    <dl className="ex-help">
      {ROWS.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
