import { useState, useEffect, useRef, useCallback } from "react";

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:       "#0D1117",
  panel:    "#161B22",
  panel2:   "#1C2128",
  border:   "#30363D",
  teal:     "#00D4AA",
  cyan:     "#40E0FF",
  dark:     "#0D2B22",
  text:     "#E6EDF3",
  dim:      "#8B949E",
  muted:    "#484F58",
  red:      "#F85149",
  yellow:   "#D29922",
  green:    "#3FB950",
};

// ─── Pixel color palette ──────────────────────────────────────────────────────
const PALETTE = {
  T: C.teal,     // teal body
  C: C.cyan,     // cyan accent (eyes, V)
  B: C.bg,       // black / transparent (cutouts)
  D: "#0A1628",  // dark blue-black (shadows)
  W: "#E6EDF3",  // white highlight
  R: C.red,      // red (error state)
  Y: C.yellow,   // yellow (warning)
  G: C.green,    // green (success)
  _: null,       // empty/transparent
};

// ─── Robot pose definitions (16×16 pixel grids) ───────────────────────────────
// Each row is 16 chars. Key maps to PALETTE above.
const POSES = {
  idle: {
    label: "Idle",
    desc: "Default resting state",
    frames: [[
      "________________",
      "________________",
      "____TTTTTTTT____",
      "___TTTTTTTTTT___",
      "___TT_BB__BB_TT_",  // eye sockets
      "___TT_BC__BC_TT_",  // eyes with cyan pupils
      "___TTTTTTTTTT___",
      "___TTTTTTTTTT___",  // head bottom
      "__TTTTTTTTTTTT__",  // shoulders
      "__TT__BBBBBB_TT_",  // chest with dark panel
      "__TT__BTCBT__TT_",  // chest V row 1
      "__TT__BBTBB__TT_",  // chest V row 2
      "__TTTTTTTTTTTT__",
      "____TTTT_TTTT___",
      "____TTTT_TTTT___",
      "________________",
    ]],
    fps: 1,
  },

  blink: {
    label: "Blink",
    desc: "Idle with eye blink animation",
    frames: [
      [
        "________________",
        "________________",
        "____TTTTTTTT____",
        "___TTTTTTTTTT___",
        "___TT_BB__BB_TT_",
        "___TT_BC__BC_TT_",
        "___TTTTTTTTTT___",
        "___TTTTTTTTTT___",
        "__TTTTTTTTTTTT__",
        "__TT__BBBBBB_TT_",
        "__TT__BTCBT__TT_",
        "__TT__BBTBB__TT_",
        "__TTTTTTTTTTTT__",
        "____TTTT_TTTT___",
        "____TTTT_TTTT___",
        "________________",
      ],
      [
        "________________",
        "________________",
        "____TTTTTTTT____",
        "___TTTTTTTTTT___",
        "___TT_BB__BB_TT_",
        "___TT_BB__BB_TT_",  // eyes closed
        "___TTTTTTTTTT___",
        "___TTTTTTTTTT___",
        "__TTTTTTTTTTTT__",
        "__TT__BBBBBB_TT_",
        "__TT__BTCBT__TT_",
        "__TT__BBTBB__TT_",
        "__TTTTTTTTTTTT__",
        "____TTTT_TTTT___",
        "____TTTT_TTTT___",
        "________________",
      ],
    ],
    fps: 4,
    sequence: [0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0], // mostly open, quick blink
  },

  thinking: {
    label: "Thinking",
    desc: "Processing / spinner state",
    frames: [
      // eyes look left
      [
        "________________",
        "________________",
        "____TTTTTTTT____",
        "___TTTTTTTTTT___",
        "___TT_CB__BB_TT_",
        "___TT_BB__BB_TT_",
        "___TTTTTTTTTT___",
        "___TTTTTTTTTT___",
        "__TTTTTTTTTTTT__",
        "__TT__BBBBBB_TT_",
        "__TT__BTCBT__TT_",
        "__TT__BBTBB__TT_",
        "__TTTTTTTTTTTT__",
        "____TTTT_TTTT___",
        "____TTTT_TTTT___",
        "________________",
      ],
      // eyes center
      [
        "________________",
        "________________",
        "____TTTTTTTT____",
        "___TTTTTTTTTT___",
        "___TT_BB__BB_TT_",
        "___TT_BC__BC_TT_",
        "___TTTTTTTTTT___",
        "___TTTTTTTTTT___",
        "__TTTTTTTTTTTT__",
        "__TT__BBBBBB_TT_",
        "__TT__BTCBT__TT_",
        "__TT__BBTBB__TT_",
        "__TTTTTTTTTTTT__",
        "____TTTT_TTTT___",
        "____TTTT_TTTT___",
        "________________",
      ],
      // eyes look right
      [
        "________________",
        "________________",
        "____TTTTTTTT____",
        "___TTTTTTTTTT___",
        "___TT_BB__CB_TT_",
        "___TT_BB__BB_TT_",
        "___TTTTTTTTTT___",
        "___TTTTTTTTTT___",
        "__TTTTTTTTTTTT__",
        "__TT__BBBBBB_TT_",
        "__TT__BTCBT__TT_",
        "__TT__BBTBB__TT_",
        "__TTTTTTTTTTTT__",
        "____TTTT_TTTT___",
        "____TTTT_TTTT___",
        "________________",
      ],
    ],
    fps: 3,
    sequence: [0,1,2,1],
  },

  success: {
    label: "Success",
    desc: "Task completed / found results",
    frames: [[
      "________________",
      "____CC______CC__",  // sparkles
      "____TTTTTTTT____",
      "___TTTTTTTTTT___",
      "___TT_CC__CC_TT_",  // bright cyan eyes
      "___TT_CC__CC_TT_",
      "___TTTTTTTTTT___",
      "___TTTGGGGGTTT__",  // green smile
      "__TTTTTTTTTTTT__",
      "__TT__BBBBBB_TT_",
      "__TT__BTCBT__TT_",
      "__TT__BBTBB__TT_",
      "__TTTTTTTTTTTT__",
      "___TTTTT_TTTT___",
      "_TTTTTT___TTTTT_",  // arms up
      "________________",
    ]],
    fps: 1,
  },

  error: {
    label: "Error",
    desc: "Something went wrong",
    frames: [
      [
        "________________",
        "________________",
        "____TTTTTTTT____",
        "___TTTTTTTTTT___",
        "___TT_RB__RB_TT_",  // red eyes
        "___TT_BR__BR_TT_",
        "___TTTTTTTTTT___",
        "___TTTRRRRRTTT__",  // red frown
        "__TTTTTTTTTTTT__",
        "__TT__BBBBBB_TT_",
        "__TT__BRCBT__TT_",
        "__TT__BBTBB__TT_",
        "__TTTTTTTTTTTT__",
        "____TTTT_TTTT___",
        "____TTTT_TTTT___",
        "________________",
      ],
      [
        "________________",
        "________________",
        "____TTTTTTTT____",
        "___TTTTTTTTTT___",
        "___TT_BB__BB_TT_",
        "___TT_RR__RR_TT_",  // dimmer red
        "___TTTTTTTTTT___",
        "___TTTRRRRRTTT__",
        "__TTTTTTTTTTTT__",
        "__TT__BBBBBB_TT_",
        "__TT__BRCBT__TT_",
        "__TT__BBTBB__TT_",
        "__TTTTTTTTTTTT__",
        "____TTTT_TTTT___",
        "____TTTT_TTTT___",
        "________________",
      ],
    ],
    fps: 2,
    sequence: [0, 1],
  },

  wave: {
    label: "Wave",
    desc: "Greeting / welcome",
    frames: [
      [
        "________________",
        "________________",
        "____TTTTTTTT____",
        "___TTTTTTTTTT___",
        "___TT_BB__BB_TT_",
        "___TT_BC__BC_TT_",
        "___TTTTTTTTTT___",
        "___TTTTTTTTTT___",
        "__TTTTTTTTTTTTTT",  // arm raised right
        "__TT__BBBBBB_TTT",
        "__TT__BTCBT__TTT",
        "__TT__BBTBB__TT_",
        "__TTTTTTTTTTTT__",
        "____TTTT_TTTT___",
        "____TTTT_TTTT___",
        "________________",
      ],
      [
        "________________",
        "_______________T",  // hand tip
        "____TTTTTTTT__TT",
        "___TTTTTTTTTTTT_",
        "___TT_BB__BB_TT_",
        "___TT_BC__BC_TT_",
        "___TTTTTTTTTT___",
        "___TTTTTTTTTT___",
        "__TTTTTTTTTTTTT_",
        "__TT__BBBBBB_TT_",
        "__TT__BTCBT__TT_",
        "__TT__BBTBB__TT_",
        "__TTTTTTTTTTTT__",
        "____TTTT_TTTT___",
        "____TTTT_TTTT___",
        "________________",
      ],
    ],
    fps: 3,
    sequence: [0,1,0,1],
  },

  search: {
    label: "Searching",
    desc: "Performing vector search",
    frames: [
      [
        "________________",
        "________________",
        "____TTTTTTTT____",
        "___TTTTTTTTTT___",
        "___TT_BB__CB_TT_",
        "___TT_BB__CC_TT_",  // looking right with magnify
        "___TTTTTTTTTT___",
        "___TTTTTTTTTT___",
        "__TTTTTTTTTTTT__",
        "__TT__BBBBBB_TT_",
        "__TT__BTCBT__TT_",
        "__TT__BBTBB__TT_",
        "__TTTTTTTTTTTT__",
        "____TTTT_TTTT___",
        "____TTTT_TTTT___",
        "________________",
      ],
      [
        "________________",
        "________________",
        "____TTTTTTTT____",
        "___TTTTTTTTTT___",
        "___TT_BB__BB_TT_",
        "___TT_BC__CB_TT_",  // eyes sweep
        "___TTTTTTTTTT___",
        "___TTTTTTTTTT___",
        "__TTTTTTTTTTTT__",
        "__TT__BBBBBB_TT_",
        "__TT__BTCBT__TT_",
        "__TT__BBTBB__TT_",
        "__TTTTTTTTTTTT__",
        "____TTTT_TTTT___",
        "____TTTT_TTTT___",
        "________________",
      ],
      [
        "________________",
        "________________",
        "____TTTTTTTT____",
        "___TTTTTTTTTT___",
        "___TT_CB__BB_TT_",
        "___TT_CC__BB_TT_",  // looking left
        "___TTTTTTTTTT___",
        "___TTTTTTTTTT___",
        "__TTTTTTTTTTTT__",
        "__TT__BBBBBB_TT_",
        "__TT__BTCBT__TT_",
        "__TT__BBTBB__TT_",
        "__TTTTTTTTTTTT__",
        "____TTTT_TTTT___",
        "____TTTT_TTTT___",
        "________________",
      ],
    ],
    fps: 4,
    sequence: [0,1,2,1],
  },

  tiny: {
    label: "Tiny (8×8)",
    desc: "Favicon / status bar size",
    frames: [[
      "________",
      "_TTTTTT_",
      "_TBBTBT_",  // eyes
      "_TTTTTT_",
      "_TCCTTT_",  // V chest
      "_TTTCTT_",
      "_TT_TT__",
      "________",
    ]],
    fps: 1,
    gridSize: 8,
  },

  large: {
    label: "Large (32×32)",
    desc: "Hero / splash screen size",
    frames: [[
      "________________________________",
      "________________________________",
      "________________________________",
      "_________TTTTTTTTTTTT___________",
      "________TTTTTTTTTTTTTT__________",
      "_______TTTTTTTTTTTTTTTT_________",
      "_______TTT_BBBB__BBBB_TTT_______",
      "_______TTT_BBBB__BBBB_TTT_______",
      "_______TTT_BCCC__BCCC_TTT_______",
      "_______TTT_BCCC__BCCC_TTT_______",
      "_______TTTTTTTTTTTTTTTT_________",
      "_______TTTTTTTTTTTTTTTT_________",
      "______TTTTTTTTTTTTTTTTTTT_______",
      "______TTTTTTTTTTTTTTTTTTT_______",
      "______TTT___BBBBBBBBBB_TTT______",
      "______TTT___BBBBBBBBBB_TTT______",
      "______TTT___BTCBBBCBT__TTT______",
      "______TTT___BBTBBBTTB__TTT______",
      "______TTT___BBBCBCBBB__TTT______",
      "______TTT___BBBBBBBBBB_TTT______",
      "______TTTTTTTTTTTTTTTTTTT_______",
      "______TTTTTTTTTTTTTTTTTTT_______",
      "________TTTTTTT_TTTTTTT_________",
      "________TTTTTTT_TTTTTTT_________",
      "________TTTTTTT_TTTTTTT_________",
      "________TTTTTTT_TTTTTTT_________",
      "________________________________",
      "________________________________",
      "________________________________",
      "________________________________",
      "________________________________",
      "________________________________",
    ]],
    fps: 1,
    gridSize: 32,
  },
};

// ─── Render a pixel grid to SVG rects ─────────────────────────────────────────
function renderGrid(grid, pixelSize = 4, palette = PALETTE) {
  const rects = [];
  grid.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const color = palette[ch];
      if (color) {
        rects.push(
          <rect
            key={`${x}-${y}`}
            x={x * pixelSize}
            y={y * pixelSize}
            width={pixelSize}
            height={pixelSize}
            fill={color}
          />
        );
      }
    });
  });
  return rects;
}

// ─── Animated robot renderer ──────────────────────────────────────────────────
function RobotRenderer({ pose, pixelSize = 6, playing = true }) {
  const { frames, fps, sequence, gridSize = 16 } = pose;
  const [frameIdx, setFrameIdx] = useState(0);
  const totalFrames = sequence ? sequence.length : frames.length;

  useEffect(() => {
    if (!playing || totalFrames <= 1) return;
    const interval = 1000 / fps;
    const t = setInterval(() => {
      setFrameIdx(i => (i + 1) % totalFrames);
    }, interval);
    return () => clearInterval(t);
  }, [playing, fps, totalFrames]);

  const currentFrame = sequence
    ? frames[sequence[frameIdx % sequence.length]]
    : frames[frameIdx % frames.length];

  const size = gridSize * pixelSize;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ imageRendering: "pixelated", display: "block" }}
    >
      {renderGrid(currentFrame, pixelSize)}
    </svg>
  );
}

// ─── ASCII export renderer ────────────────────────────────────────────────────
function toAscii(grid) {
  const ASCII_MAP = {
    T: "█", C: "▓", B: "░", D: "▒",
    W: "█", R: "█", Y: "█", G: "█", _: " ",
  };
  return grid.map(row =>
    [...row].map(ch => ASCII_MAP[ch] || " ").join("")
  ).join("\n");
}

function toUnicode(grid, palette = PALETTE) {
  return grid.map(row =>
    [...row].map(ch => palette[ch] ? "█" : " ").join("")
  ).join("\n");
}

function toSvgString(grid, pixelSize = 4, palette = PALETTE) {
  const gridSize = grid.length;
  const size = gridSize * pixelSize;
  const rects = [];
  grid.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const color = palette[ch];
      if (color) {
        rects.push(`  <rect x="${x * pixelSize}" y="${y * pixelSize}" width="${pixelSize}" height="${pixelSize}" fill="${color}"/>`);
      }
    });
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">\n${rects.join("\n")}\n</svg>`;
}

function toJsData(grid) {
  return JSON.stringify(grid, null, 2);
}

// ─── Copy button ──────────────────────────────────────────────────────────────
function CopyBtn({ text, label }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={copy} style={{
      fontFamily: "monospace", fontSize: 10,
      background: copied ? C.dark : C.panel2,
      border: `1px solid ${copied ? C.teal : C.border}`,
      color: copied ? C.teal : C.dim,
      borderRadius: 3, padding: "3px 10px", cursor: "pointer",
      transition: "all 0.15s",
    }}>
      {copied ? "✓ copied" : label}
    </button>
  );
}

// ─── Pose card ────────────────────────────────────────────────────────────────
function PoseCard({ poseKey, pose, selected, onSelect }) {
  return (
    <div
      onClick={() => onSelect(poseKey)}
      style={{
        border: `1px solid ${selected ? C.teal : C.border}`,
        borderRadius: 6,
        background: selected ? C.dark : C.panel,
        padding: "12px",
        cursor: "pointer",
        transition: "all 0.15s",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
      }}
    >
      <RobotRenderer pose={pose} pixelSize={4} playing={selected} />
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: "monospace", fontSize: 11, color: selected ? C.teal : C.text }}>
          {pose.label}
        </div>
        <div style={{ fontFamily: "monospace", fontSize: 9, color: C.muted, marginTop: 2 }}>
          {pose.frames.length > 1 ? `${pose.frames.length}f · ${pose.fps}fps` : "static"}
        </div>
      </div>
    </div>
  );
}

// ─── Export panel ─────────────────────────────────────────────────────────────
function ExportPanel({ pose }) {
  const frame = pose.frames[0];
  const [activeTab, setActiveTab] = useState("svg");

  const exports = {
    svg: { label: "SVG", content: toSvgString(frame, 4), lang: "xml" },
    ascii: { label: "ASCII", content: toAscii(frame), lang: "text" },
    unicode: { label: "Unicode", content: toUnicode(frame), lang: "text" },
    json: { label: "JSON Grid", content: toJsData(frame), lang: "json" },
    css: {
      label: "CSS Var",
      content: `:root {\n  --vai-robot-teal: ${C.teal};\n  --vai-robot-cyan: ${C.cyan};\n  --vai-robot-bg: ${C.bg};\n}`,
      lang: "css"
    },
  };

  return (
    <div style={{
      border: `1px solid ${C.border}`,
      borderRadius: 6, background: C.panel, overflow: "hidden",
    }}>
      <div style={{
        display: "flex", borderBottom: `1px solid ${C.border}`,
        background: C.panel2,
      }}>
        {Object.entries(exports).map(([key, { label }]) => (
          <button key={key} onClick={() => setActiveTab(key)} style={{
            fontFamily: "monospace", fontSize: 10,
            background: "transparent",
            borderRight: `1px solid ${C.border}`,
            borderTop: "none", borderLeft: "none", borderBottom: "none",
            color: activeTab === key ? C.teal : C.dim,
            padding: "6px 14px", cursor: "pointer",
            borderBottom: activeTab === key ? `2px solid ${C.teal}` : "2px solid transparent",
          }}>
            {label}
          </button>
        ))}
      </div>
      <div style={{ padding: 12 }}>
        <pre style={{
          fontFamily: "monospace", fontSize: 10,
          color: C.text, background: C.bg,
          border: `1px solid ${C.border}`,
          borderRadius: 4, padding: 10,
          overflowX: "auto", maxHeight: 180,
          margin: 0, lineHeight: 1.4,
          whiteSpace: "pre",
        }}>
          {exports[activeTab].content}
        </pre>
        <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
          <CopyBtn text={exports[activeTab].content} label={`copy ${exports[activeTab].label}`} />
        </div>
      </div>
    </div>
  );
}

// ─── Color swatch ─────────────────────────────────────────────────────────────
function Swatch({ name, value, role }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
      <div style={{
        width: 32, height: 32, borderRadius: 4,
        background: value,
        border: `1px solid ${C.border}`,
        flexShrink: 0,
      }} />
      <div>
        <div style={{ fontFamily: "monospace", fontSize: 11, color: C.text }}>{name}</div>
        <div style={{ fontFamily: "monospace", fontSize: 10, color: C.dim }}>{value}</div>
        <div style={{ fontFamily: "monospace", fontSize: 9, color: C.muted }}>{role}</div>
      </div>
      <CopyBtn text={value} label="copy" />
    </div>
  );
}

// ─── Size showcase ────────────────────────────────────────────────────────────
function SizeShowcase({ pose }) {
  const sizes = [
    { px: 2, label: "8px", desc: "favicon" },
    { px: 3, label: "12px", desc: "status bar" },
    { px: 4, label: "16px", desc: "sidebar" },
    { px: 6, label: "24px", desc: "nav icon" },
    { px: 8, label: "32px", desc: "card" },
    { px: 12, label: "48px", desc: "hero small" },
    { px: 18, label: "72px", desc: "hero large" },
  ];

  const frame = pose.frames[0];
  const gridSize = pose.gridSize || 16;

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
      {sizes.map(({ px, label, desc }) => (
        <div key={px} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <svg
            width={gridSize * px}
            height={gridSize * px}
            viewBox={`0 0 ${gridSize * px} ${gridSize * px}`}
            style={{ imageRendering: "pixelated", display: "block" }}
          >
            {renderGrid(frame, px)}
          </svg>
          <div style={{ fontFamily: "monospace", fontSize: 9, color: C.teal }}>{label}</div>
          <div style={{ fontFamily: "monospace", fontSize: 9, color: C.muted }}>{desc}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Animation timeline ───────────────────────────────────────────────────────
function AnimTimeline({ pose }) {
  const { frames, fps, sequence } = pose;
  if (frames.length <= 1) return (
    <div style={{ fontFamily: "monospace", fontSize: 11, color: C.muted }}>
      Static pose — no animation frames
    </div>
  );

  const seq = sequence || frames.map((_, i) => i);
  return (
    <div>
      <div style={{ fontFamily: "monospace", fontSize: 10, color: C.dim, marginBottom: 8 }}>
        {seq.length} frames · {fps} fps · {(seq.length / fps).toFixed(1)}s loop
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {seq.map((fi, i) => (
          <div key={i} style={{
            border: `1px solid ${C.border}`,
            borderRadius: 3, background: C.bg,
            padding: 4,
          }}>
            <svg
              width={16 * 3} height={16 * 3}
              viewBox={`0 0 ${16 * 3} ${16 * 3}`}
              style={{ imageRendering: "pixelated", display: "block" }}
            >
              {renderGrid(frames[fi], 3)}
            </svg>
            <div style={{ fontFamily: "monospace", fontSize: 8, color: C.muted, textAlign: "center", marginTop: 2 }}>
              f{i + 1}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────
function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, marginBottom: 16 }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{
          fontFamily: "monospace", fontSize: 11,
          background: "transparent", border: "none",
          borderBottom: active === t.id ? `2px solid ${C.teal}` : "2px solid transparent",
          color: active === t.id ? C.teal : C.dim,
          padding: "8px 16px", cursor: "pointer",
          transition: "all 0.15s",
        }}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────
function SectionHead({ children }) {
  return (
    <div style={{
      fontFamily: "monospace", fontSize: 10, color: C.teal,
      textTransform: "uppercase", letterSpacing: "0.1em",
      marginBottom: 10, marginTop: 4,
    }}>
      {children}
    </div>
  );
}

// ─── Main app ─────────────────────────────────────────────────────────────────
export default function VaiRobotDesignSystem() {
  const [selectedPose, setSelectedPose] = useState("idle");
  const [activeTab, setActiveTab] = useState("poses");
  const [playing, setPlaying] = useState(true);

  const pose = POSES[selectedPose];

  const tabs = [
    { id: "poses",  label: "Pose Library" },
    { id: "sizes",  label: "Size Scale" },
    { id: "anim",   label: "Animation" },
    { id: "export", label: "Export" },
    { id: "brand",  label: "Brand Tokens" },
  ];

  return (
    <div style={{
      background: C.bg, color: C.text,
      minHeight: "100vh", fontFamily: "monospace",
      padding: 0,
    }}>
      {/* Header */}
      <div style={{
        background: C.panel,
        borderBottom: `1px solid ${C.border}`,
        padding: "12px 20px",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <RobotRenderer pose={POSES.idle} pixelSize={4} playing={true} />
        <div>
          <div style={{ fontSize: 14, color: C.teal, fontWeight: 700, letterSpacing: "0.05em" }}>
            AVI
          </div>
          <div style={{ fontSize: 10, color: C.dim }}>
            Mascot Design System · v1.0
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => setPlaying(p => !p)}
            style={{
              fontFamily: "monospace", fontSize: 10,
              background: playing ? C.dark : C.panel2,
              border: `1px solid ${playing ? C.teal : C.border}`,
              color: playing ? C.teal : C.dim,
              borderRadius: 3, padding: "4px 12px", cursor: "pointer",
            }}
          >
            {playing ? "⏸ pause" : "▶ play"} animations
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ display: "flex", height: "calc(100vh - 65px)" }}>

        {/* Left: pose grid */}
        <div style={{
          width: 280, flexShrink: 0,
          borderRight: `1px solid ${C.border}`,
          overflowY: "auto", padding: 12,
          display: "flex", flexDirection: "column", gap: 8,
        }}>
          <SectionHead>poses · {Object.keys(POSES).length} total</SectionHead>
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr",
            gap: 8,
          }}>
            {Object.entries(POSES).map(([key, p]) => (
              <PoseCard
                key={key}
                poseKey={key}
                pose={p}
                selected={selectedPose === key}
                onSelect={setSelectedPose}
                playing={playing}
              />
            ))}
          </div>
        </div>

        {/* Right: detail panel */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>

          {/* Pose header */}
          <div style={{
            display: "flex", alignItems: "center", gap: 16, marginBottom: 20,
            paddingBottom: 16, borderBottom: `1px solid ${C.border}`,
          }}>
            <RobotRenderer pose={pose} pixelSize={10} playing={playing} />
            <div>
              <div style={{ fontSize: 16, color: C.teal, fontWeight: 700 }}>{pose.label}</div>
              <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{pose.desc}</div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
                {pose.gridSize || 16}×{pose.gridSize || 16} grid ·{" "}
                {pose.frames.length} frame{pose.frames.length > 1 ? "s" : ""} ·{" "}
                {pose.frames.length > 1 ? `${pose.fps} fps` : "static"}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <TabBar tabs={tabs} active={activeTab} onChange={setActiveTab} />

          {/* Pose library tab */}
          {activeTab === "poses" && (
            <div>
              <SectionHead>usage context</SectionHead>
              <div style={{
                background: C.panel, border: `1px solid ${C.border}`,
                borderRadius: 6, padding: 12, marginBottom: 16,
                fontFamily: "monospace", fontSize: 11, color: C.dim,
                lineHeight: 1.8,
              }}>
                <div style={{ color: C.text, marginBottom: 6 }}>
                  {pose.label} — recommended contexts
                </div>
                {selectedPose === "idle" && "Default state · sidebar header · app launch · config display"}
                {selectedPose === "blink" && "Long-running idle · screensaver · waiting for user input"}
                {selectedPose === "thinking" && "RAG retrieval in progress · embedding · reranking · LLM call"}
                {selectedPose === "success" && "Search complete · documents found · pipeline finished · export done"}
                {selectedPose === "error" && "Connection failed · no results · API error · timeout"}
                {selectedPose === "wave" && "CLI startup greeting · first launch · onboarding · --help output"}
                {selectedPose === "search" && "Vector search executing · scanning collection · top-k in progress"}
                {selectedPose === "tiny" && "Status bar · favicon · tab icon · compact mode · terminal prompt prefix"}
                {selectedPose === "large" && "Welcome screen · splash · README hero · Product Hunt thumbnail"}
              </div>

              <SectionHead>pixel grid data</SectionHead>
              <pre style={{
                fontFamily: "monospace", fontSize: 10, color: C.text,
                background: C.bg, border: `1px solid ${C.border}`,
                borderRadius: 4, padding: 10, overflowX: "auto",
                maxHeight: 240, lineHeight: 1.4,
              }}>
                {pose.frames[0].join("\n")}
              </pre>
              <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                <CopyBtn text={pose.frames[0].join("\n")} label="copy grid" />
                <CopyBtn text={JSON.stringify(pose.frames[0])} label="copy JSON" />
              </div>
            </div>
          )}

          {/* Sizes tab */}
          {activeTab === "sizes" && (
            <div>
              <SectionHead>size scale — {pose.label}</SectionHead>
              <SizeShowcase pose={pose} />
              <div style={{ marginTop: 20 }}>
                <SectionHead>recommended usage</SectionHead>
                <div style={{
                  background: C.panel, border: `1px solid ${C.border}`,
                  borderRadius: 6, padding: 12,
                  fontFamily: "monospace", fontSize: 10, color: C.dim,
                  lineHeight: 2,
                }}>
                  <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: "2px 16px" }}>
                    <span style={{ color: C.teal }}>8px</span><span>favicon.ico, browser tab, terminal prompt prefix char</span>
                    <span style={{ color: C.teal }}>12px</span><span>TUI status bar, compact sidebar label</span>
                    <span style={{ color: C.teal }}>16px</span><span>nav icon, session list item, inline status indicator</span>
                    <span style={{ color: C.teal }}>24px</span><span>sidebar header, panel title, tooltip avatar</span>
                    <span style={{ color: C.teal }}>32px</span><span>card mascot, chat welcome, desktop taskbar</span>
                    <span style={{ color: C.teal }}>48px</span><span>page section header, onboarding step</span>
                    <span style={{ color: C.teal }}>72px</span><span>hero area, splash screen, README, Product Hunt</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Animation tab */}
          {activeTab === "anim" && (
            <div>
              <SectionHead>frame sequence — {pose.label}</SectionHead>
              <AnimTimeline pose={pose} />
              {pose.frames.length > 1 && (
                <div style={{ marginTop: 16 }}>
                  <SectionHead>animation spec</SectionHead>
                  <div style={{
                    background: C.panel, border: `1px solid ${C.border}`,
                    borderRadius: 6, padding: 12,
                    fontFamily: "monospace", fontSize: 10, color: C.dim,
                    lineHeight: 1.8,
                  }}>
                    <div>fps: <span style={{ color: C.teal }}>{pose.fps}</span></div>
                    <div>frame_count: <span style={{ color: C.teal }}>{pose.frames.length}</span></div>
                    <div>sequence: <span style={{ color: C.teal }}>[{(pose.sequence || pose.frames.map((_,i)=>i)).join(", ")}]</span></div>
                    <div>loop_duration: <span style={{ color: C.teal }}>{((pose.sequence || pose.frames).length / pose.fps).toFixed(2)}s</span></div>
                    <div>loop: <span style={{ color: C.teal }}>true</span></div>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <CopyBtn
                      text={JSON.stringify({ fps: pose.fps, sequence: pose.sequence || pose.frames.map((_,i)=>i), frames: pose.frames }, null, 2)}
                      label="copy animation JSON"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Export tab */}
          {activeTab === "export" && (
            <div>
              <SectionHead>export — {pose.label} (frame 1)</SectionHead>
              <ExportPanel pose={pose} />
              <div style={{ marginTop: 16 }}>
                <SectionHead>terminal / ASCII preview</SectionHead>
                <pre style={{
                  fontFamily: "monospace", fontSize: 9, lineHeight: 1.1,
                  color: C.teal, background: "#000",
                  border: `1px solid ${C.border}`,
                  borderRadius: 4, padding: 10,
                  display: "inline-block",
                }}>
                  {toAscii(pose.frames[0])}
                </pre>
              </div>
            </div>
          )}

          {/* Brand tokens tab */}
          {activeTab === "brand" && (
            <div>
              <SectionHead>color tokens</SectionHead>
              <div style={{
                background: C.panel, border: `1px solid ${C.border}`,
                borderRadius: 6, padding: 16, marginBottom: 16,
              }}>
                <Swatch name="--vai-teal" value={C.teal} role="Primary body color · borders · active states" />
                <Swatch name="--vai-cyan" value={C.cyan} role="Accent · eyes · V chest · highlights" />
                <Swatch name="--vai-bg" value={C.bg} role="Background · cutouts · transparent pixels" />
                <Swatch name="--vai-panel" value={C.panel} role="Surface · card background" />
                <Swatch name="--vai-dark" value={C.dark} role="Selected state · chest panel background" />
                <Swatch name="--vai-red" value={C.red} role="Error state robot eyes / mouth" />
                <Swatch name="--vai-green" value={C.green} role="Success state mouth / indicators" />
              </div>

              <SectionHead>pixel key</SectionHead>
              <div style={{
                background: C.panel, border: `1px solid ${C.border}`,
                borderRadius: 6, padding: 12,
                display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8,
              }}>
                {Object.entries(PALETTE).filter(([k]) => k !== "_").map(([key, val]) => (
                  <div key={key} style={{
                    display: "flex", alignItems: "center", gap: 6,
                    fontFamily: "monospace", fontSize: 10,
                  }}>
                    <div style={{
                      width: 16, height: 16, background: val || "transparent",
                      border: `1px solid ${C.border}`, borderRadius: 2, flexShrink: 0,
                    }} />
                    <span style={{ color: C.teal }}>{key}</span>
                    <span style={{ color: C.muted, fontSize: 9 }}>{val?.slice(0,7)}</span>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 16 }}>
                <SectionHead>CSS variables</SectionHead>
                <pre style={{
                  fontFamily: "monospace", fontSize: 10,
                  color: C.text, background: C.bg,
                  border: `1px solid ${C.border}`,
                  borderRadius: 4, padding: 10, lineHeight: 1.7,
                }}>
{`:root {
  /* Avi Brand Tokens */
  --vai-teal:  ${C.teal};
  --vai-cyan:  ${C.cyan};
  --vai-bg:    ${C.bg};
  --vai-panel: ${C.panel};
  --vai-dark:  ${C.dark};
  --vai-red:   ${C.red};
  --vai-green: ${C.green};
  
  /* Gradient */
  --vai-gradient: linear-gradient(
    135deg, ${C.teal}, ${C.cyan}
  );
}`}
                </pre>
                <div style={{ marginTop: 8 }}>
                  <CopyBtn
                    text={`:root {\n  --vai-teal:  ${C.teal};\n  --vai-cyan:  ${C.cyan};\n  --vai-bg:    ${C.bg};\n  --vai-panel: ${C.panel};\n  --vai-dark:  ${C.dark};\n  --vai-red:   ${C.red};\n  --vai-green: ${C.green};\n  --vai-gradient: linear-gradient(135deg, ${C.teal}, ${C.cyan});\n}`}
                    label="copy CSS vars"
                  />
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
