import { DRAW_COLORS, TOOL_GROUPS } from "../chart/drawings";

const ICONS = {
  cross: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 2v12M2 8h12" />
    </svg>
  ),
  hline: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2 8h12" />
    </svg>
  ),
  vline: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 2v12" />
    </svg>
  ),
  trend: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 12 L13 4" />
    </svg>
  ),
  hray: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 8h10" />
      <path d="M11 6l2 2-2 2" />
    </svg>
  ),
  ray: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 12 L10 6" />
      <path d="M10 6 L14 3" opacity="0.45" />
    </svg>
  ),
  extended: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2 13 L14 3" />
    </svg>
  ),
  arrow: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 12 L12 4" />
      <path d="M8 4h4v4" />
    </svg>
  ),
  fib: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2 4h12M2 7h12M2 10h12M2 13h12" />
    </svg>
  ),
  range: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <rect x="3" y="4" width="10" height="8" fill="none" />
      <path d="M8 5v6" />
    </svg>
  ),
  rect: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <rect x="3" y="4" width="10" height="8" fill="none" />
    </svg>
  ),
  channel: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 11 L13 5M3 14 L13 8" />
    </svg>
  ),
  text: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 4h8M8 4v9" />
    </svg>
  ),
  price: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 3h6a3 3 0 0 1 0 6H4zM4 9h7" />
    </svg>
  ),
  undo: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M6 4 L2 8 L6 12M2 8h8a4 4 0 0 1 0 8" />
    </svg>
  ),
  clear: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  ),
  magnet: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 3v5a5 5 0 0 0 10 0V3M3 3h3v5a2 2 0 0 0 4 0V3h3" />
    </svg>
  ),
};

function ToolIcon({ name }) {
  return ICONS[name] || ICONS.cross;
}

export default function ChartTools({
  tool,
  color,
  magnet,
  t,
  onSelectTool,
  onSelectColor,
  onUndo,
  onClear,
  onToggleMagnet,
}) {
  return (
    <aside className="hybrid-tools" aria-label={t.chartTools}>
      <div className="hybrid-colors is-docked" role="group" aria-label="draw color">
        {DRAW_COLORS.map((swatch) => (
          <button
            key={swatch.id}
            type="button"
            className={color === swatch.hex ? "hybrid-swatch active" : "hybrid-swatch"}
            style={{ background: swatch.hex }}
            title={swatch.id}
            aria-label={swatch.id}
            onMouseEnter={() => onSelectColor(swatch.hex)}
            onPointerDown={(event) => {
              event.preventDefault();
              onSelectColor(swatch.hex);
            }}
          />
        ))}
      </div>
      {TOOL_GROUPS.map((group) => (
        <div key={group.id} className="hybrid-tool-group">
          <p className="hybrid-tool-group-label">{t[group.labelKey] || group.id}</p>
          {group.tools.map((row) => (
            <button
              key={row.id}
              type="button"
              className={tool === row.id ? "hybrid-tool active" : "hybrid-tool"}
              style={tool === row.id && row.colors !== false ? { borderColor: color, color } : undefined}
              onPointerDown={(event) => {
                event.preventDefault();
                onSelectTool(row.id);
              }}
              title={t[row.labelKey] || row.id}
            >
              <ToolIcon name={row.icon} />
            </button>
          ))}
        </div>
      ))}
      <div className="hybrid-tool-group">
        <p className="hybrid-tool-group-label">{t.chartEdit}</p>
        <button
          type="button"
          className={magnet ? "hybrid-tool active" : "hybrid-tool"}
          onPointerDown={(event) => {
            event.preventDefault();
            onToggleMagnet();
          }}
          title={t.chartMagnet}
        >
          <ToolIcon name="magnet" />
        </button>
      </div>
      <div className="hybrid-tool-pair" role="group" aria-label={t.chartEdit}>
        <button
          type="button"
          className="hybrid-tool"
          onPointerDown={(event) => {
            event.preventDefault();
            onUndo();
          }}
          title={t.chartUndo}
        >
          <ToolIcon name="undo" />
        </button>
        <button
          type="button"
          className="hybrid-tool is-clear"
          onPointerDown={(event) => {
            event.preventDefault();
            onClear();
          }}
          title={t.chartClear}
        >
          <ToolIcon name="clear" />
        </button>
      </div>
    </aside>
  );
}
