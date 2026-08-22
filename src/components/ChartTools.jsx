import { useEffect, useRef, useState } from "react";
import { DRAW_COLORS, LINE_STYLES, LINE_WIDTHS, TOOL_GROUPS, groupForTool, toolMeta } from "../chart/drawings";

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
  crossline: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 2v12M2 8h12" />
      <circle cx="8" cy="8" r="1.4" />
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
  infoline: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 12 L12 4" />
      <rect x="8.5" y="7.5" width="5" height="4" fill="none" />
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
  fibext: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2 12 L7 4" />
      <path d="M7 8h7M7 11h7M7 13h7" />
    </svg>
  ),
  range: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <rect x="3" y="4" width="10" height="8" fill="none" />
      <path d="M8 5v6" />
    </svg>
  ),
  pitchfork: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 13 L8 3M3 13 L13 7M3 13 L13 12" />
    </svg>
  ),
  rect: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <rect x="3" y="4" width="10" height="8" fill="none" />
    </svg>
  ),
  ellipse: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <ellipse cx="8" cy="8" rx="6" ry="4" fill="none" />
    </svg>
  ),
  circle: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="5" fill="none" />
    </svg>
  ),
  triangle: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 3 L14 13 H2 Z" />
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
  stay: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 3h8v3L9.5 8.5V13l-3-1.5V8.5L4 6z" />
    </svg>
  ),
};

function ToolIcon({ name }) {
  return ICONS[name] || ICONS.cross;
}

function DrawStyle({ color, strokeWidth, lineStyle, t, onSelectColor, onSelectWidth, onSelectStyle }) {
  return (
    <div className="hybrid-draw-style">
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
      <p className="hybrid-tool-group-label">{t.chartLineWidth}</p>
      <div className="hybrid-style-row" role="group" aria-label={t.chartLineWidth}>
        {LINE_WIDTHS.map((width) => (
          <button
            key={width}
            type="button"
            className={strokeWidth === width ? "hybrid-style-btn active" : "hybrid-style-btn"}
            onPointerDown={(event) => {
              event.preventDefault();
              onSelectWidth(width);
            }}
            title={`${t.chartLineWidth} ${width}`}
          >
            <span className="hybrid-width-mark" style={{ height: Math.max(1, width) }} />
          </button>
        ))}
      </div>
      <p className="hybrid-tool-group-label">{t.chartLineStyle}</p>
      <div className="hybrid-style-row" role="group" aria-label={t.chartLineStyle}>
        {LINE_STYLES.map((row) => (
          <button
            key={row.id}
            type="button"
            className={lineStyle === row.id ? "hybrid-style-btn active" : "hybrid-style-btn"}
            onPointerDown={(event) => {
              event.preventDefault();
              onSelectStyle(row.id);
            }}
            title={t[`chartStyle_${row.id}`] || row.id}
          >
            <svg viewBox="0 0 22 8" aria-hidden="true">
              <line
                x1="1"
                y1="4"
                x2="21"
                y2="4"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeDasharray={row.dash || undefined}
              />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ChartTools({
  tool,
  color,
  strokeWidth,
  lineStyle,
  magnet,
  stay,
  t,
  onSelectTool,
  onSelectColor,
  onSelectWidth,
  onSelectStyle,
  onUndo,
  onClear,
  onToggleMagnet,
  onToggleStay,
}) {
  const rail = useRef(null);
  const [panel, setPanel] = useState(false);
  const [lastTool, setLastTool] = useState(() =>
    Object.fromEntries(TOOL_GROUPS.map((group) => [group.id, group.tools[0].id]))
  );
  const activeGroup = groupForTool(tool).id;
  const remembered = { ...lastTool, [activeGroup]: tool };
  const flyoutGroup = TOOL_GROUPS.find((group) => group.id === activeGroup && group.id !== "pointer");
  const open = panel && Boolean(flyoutGroup);

  useEffect(() => {
    if (!panel) return undefined;
    function onDoc(event) {
      if (rail.current?.contains(event.target)) return;
      if (tool === "cursor") setPanel(false);
    }
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [panel, tool]);

  function remember(id) {
    if (id === "cursor") return;
    const group = groupForTool(id);
    setLastTool((current) => ({ ...current, [group.id]: id }));
  }

  function pickRail(id) {
    const group = groupForTool(id);
    if (open && activeGroup === group.id) {
      setPanel(false);
      return;
    }
    remember(id);
    onSelectTool(id);
    setPanel(toolMeta(id).clicks > 0);
  }

  function pickFlyout(id) {
    if (tool === id) {
      setPanel(false);
      return;
    }
    remember(id);
    onSelectTool(id);
    setPanel(toolMeta(id).clicks > 0);
  }

  return (
    <aside className="hybrid-tools" aria-label={t.chartTools} ref={rail}>
      {TOOL_GROUPS.map((group) => {
        const shown = group.tools.find((row) => row.id === remembered[group.id]) || group.tools[0];
        const active = activeGroup === group.id && (group.id === "pointer" ? tool === "cursor" : tool !== "cursor");
        return (
          <button
            key={group.id}
            type="button"
            className={active ? "hybrid-tool active" : "hybrid-tool"}
            style={active && shown.colors !== false ? { borderColor: color, color } : undefined}
            onPointerDown={(event) => {
              event.preventDefault();
              pickRail(shown.id);
            }}
            title={t[group.labelKey] || group.id}
          >
            <ToolIcon name={shown.icon} />
          </button>
        );
      })}
      {open ? (
        <div className="hybrid-tool-flyout" role="dialog" aria-label={t[flyoutGroup.labelKey] || flyoutGroup.id}>
          <div className="hybrid-flyout-group">
            <p className="hybrid-tool-group-label">{t[flyoutGroup.labelKey] || flyoutGroup.id}</p>
            <div className="hybrid-flyout-tools">
              {flyoutGroup.tools.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className={tool === row.id ? "hybrid-flyout-tool active" : "hybrid-flyout-tool"}
                  style={tool === row.id && row.colors !== false ? { borderColor: color, color } : undefined}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    pickFlyout(row.id);
                  }}
                  title={t[row.labelKey] || row.id}
                >
                  <ToolIcon name={row.icon} />
                  <span>{t[row.labelKey] || row.id}</span>
                </button>
              ))}
            </div>
          </div>
          <DrawStyle
            color={color}
            strokeWidth={strokeWidth}
            lineStyle={lineStyle}
            t={t}
            onSelectColor={onSelectColor}
            onSelectWidth={onSelectWidth}
            onSelectStyle={onSelectStyle}
          />
        </div>
      ) : null}
      <div className="hybrid-tool-group is-edit">
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
        <button
          type="button"
          className={stay ? "hybrid-tool active" : "hybrid-tool"}
          onPointerDown={(event) => {
            event.preventDefault();
            onToggleStay();
          }}
          title={t.chartStayDraw}
        >
          <ToolIcon name="stay" />
        </button>
      </div>
      <div className="hybrid-tool-pair" role="group" aria-label={t.chartEdit}>
        <button
          type="button"
          className="hybrid-tool is-undo"
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
