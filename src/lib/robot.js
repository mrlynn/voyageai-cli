'use strict';

/**
 * @file src/lib/robot.js
 * @description Avi — canonical brand mascot and terminal renderer.
 *
 * Single source of truth for all robot poses, animations, and terminal rendering.
 * Uses raw ANSI 24-bit escape codes for half-block pixel rendering (no chalk dependency).
 *
 * Rendering technique: half-block characters (▀ ▄ █) pack two pixel rows into
 * one terminal row, giving the correct ~1:1 aspect ratio in monospace terminals.
 *
 * @module robot
 */

// ─── Brand color values (RGB triples) ────────────────────────────────────────
const COLORS = {
  teal:   [0,   212, 170],   // #00D4AA — primary body
  cyan:   [64,  224, 255],   // #40E0FF — eyes, V chest, accents
  bg:     [13,  17,  23],    // #0D1117 — cutouts / transparent
  dark:   [10,  22,  40],    // #0A1628 — chest panel shadow
  white:  [230, 237, 243],   // #E6EDF3 — highlight pixels
  red:    [248, 81,  73],    // #F85149 — error state
  yellow: [210, 153, 34],    // #D29922 — warning state
  green:  [63,  185, 80],    // #3FB950 — success mouth
};

/**
 * Pixel color key — maps single characters in grid strings to RGB triples.
 * '_' maps to null (transparent — no character rendered).
 */
const PALETTE = {
  T: COLORS.teal,
  C: COLORS.cyan,
  B: COLORS.bg,
  D: COLORS.dark,
  W: COLORS.white,
  R: COLORS.red,
  Y: COLORS.yellow,
  G: COLORS.green,
  _: null,
};

// ─── Raw ANSI 24-bit color helpers ───────────────────────────────────────────
const fg = (r, g, b) => `\x1b[38;2;${r};${g};${b}m`;
const bg24 = (r, g, b) => `\x1b[48;2;${r};${g};${b}m`;
const RESET = '\x1b[0m';

/**
 * Wrap text in 24-bit foreground color.
 * @param {number[]} rgb
 * @param {string} text
 * @returns {string}
 */
function colorize(rgb, text) {
  return `${fg(rgb[0], rgb[1], rgb[2])}${text}${RESET}`;
}

// ─── Pose definitions ─────────────────────────────────────────────────────────
const POSES = {

  idle: {
    label: 'Idle',
    desc: 'Default resting state — startup, config display, help header',
    gridSize: 16,
    fps: 1,
    frames: [[
      '________________',
      '________________',
      '____TTTTTTTT____',
      '___TTTTTTTTTT___',
      '___TT_BB__BB_TT_',
      '___TT_BC__BC_TT_',
      '___TTTTTTTTTT___',
      '___TTTTTTTTTT___',
      '__TTTTTTTTTTTT__',
      '__TT__BBBBBB_TT_',
      '__TT__BTCBT__TT_',
      '__TT__BBTBB__TT_',
      '__TTTTTTTTTTTT__',
      '____TTTT_TTTT___',
      '____TTTT_TTTT___',
      '________________',
    ]],
  },

  blink: {
    label: 'Blink',
    desc: 'Idle with periodic eye blink — long-running waits, screensaver',
    gridSize: 16,
    fps: 4,
    sequence: [0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0],
    frames: [
      [
        '________________',
        '________________',
        '____TTTTTTTT____',
        '___TTTTTTTTTT___',
        '___TT_BB__BB_TT_',
        '___TT_BC__BC_TT_',
        '___TTTTTTTTTT___',
        '___TTTTTTTTTT___',
        '__TTTTTTTTTTTT__',
        '__TT__BBBBBB_TT_',
        '__TT__BTCBT__TT_',
        '__TT__BBTBB__TT_',
        '__TTTTTTTTTTTT__',
        '____TTTT_TTTT___',
        '____TTTT_TTTT___',
        '________________',
      ],
      [
        '________________',
        '________________',
        '____TTTTTTTT____',
        '___TTTTTTTTTT___',
        '___TT_BB__BB_TT_',
        '___TT_TT__TT_TT_',
        '___TTTTTTTTTT___',
        '___TTTTTTTTTT___',
        '__TTTTTTTTTTTT__',
        '__TT__BBBBBB_TT_',
        '__TT__BTCBT__TT_',
        '__TT__BBTBB__TT_',
        '__TTTTTTTTTTTT__',
        '____TTTT_TTTT___',
        '____TTTT_TTTT___',
        '________________',
      ],
    ],
  },

  thinking: {
    label: 'Thinking',
    desc: 'Processing — embedding, vector search, reranking, LLM call',
    gridSize: 16,
    fps: 3,
    sequence: [0, 1, 2, 1],
    frames: [
      [
        '________________',
        '________________',
        '____TTTTTTTT____',
        '___TTTTTTTTTT___',
        '___TT_CB__BB_TT_',
        '___TT_BB__BB_TT_',
        '___TTTTTTTTTT___',
        '___TTTTTTTTTT___',
        '__TTTTTTTTTTTT__',
        '__TT__BBBBBB_TT_',
        '__TT__BTCBT__TT_',
        '__TT__BBTBB__TT_',
        '__TTTTTTTTTTTT__',
        '____TTTT_TTTT___',
        '____TTTT_TTTT___',
        '________________',
      ],
      [
        '________________',
        '________________',
        '____TTTTTTTT____',
        '___TTTTTTTTTT___',
        '___TT_BB__BB_TT_',
        '___TT_BC__BC_TT_',
        '___TTTTTTTTTT___',
        '___TTTTTTTTTT___',
        '__TTTTTTTTTTTT__',
        '__TT__BBBBBB_TT_',
        '__TT__BTCBT__TT_',
        '__TT__BBTBB__TT_',
        '__TTTTTTTTTTTT__',
        '____TTTT_TTTT___',
        '____TTTT_TTTT___',
        '________________',
      ],
      [
        '________________',
        '________________',
        '____TTTTTTTT____',
        '___TTTTTTTTTT___',
        '___TT_BB__CB_TT_',
        '___TT_BB__BB_TT_',
        '___TTTTTTTTTT___',
        '___TTTTTTTTTT___',
        '__TTTTTTTTTTTT__',
        '__TT__BBBBBB_TT_',
        '__TT__BTCBT__TT_',
        '__TT__BBTBB__TT_',
        '__TTTTTTTTTTTT__',
        '____TTTT_TTTT___',
        '____TTTT_TTTT___',
        '________________',
      ],
    ],
  },

  success: {
    label: 'Success',
    desc: 'Task complete — results found, pipeline finished, export done',
    gridSize: 16,
    fps: 1,
    frames: [[
      '________________',
      '____CC______CC__',
      '____TTTTTTTT____',
      '___TTTTTTTTTT___',
      '___TT_CC__CC_TT_',
      '___TT_CC__CC_TT_',
      '___TTTTTTTTTT___',
      '___TTTGGGGGTTT__',
      '__TTTTTTTTTTTT__',
      '__TT__BBBBBB_TT_',
      '__TT__BTCBT__TT_',
      '__TT__BBTBB__TT_',
      '__TTTTTTTTTTTT__',
      '___TTTTT_TTTT___',
      '_TTTTTT___TTTTT_',
      '________________',
    ]],
  },

  error: {
    label: 'Error',
    desc: 'Something went wrong — connection failure, API error, no results',
    gridSize: 16,
    fps: 2,
    sequence: [0, 1],
    frames: [
      [
        '________________',
        '________________',
        '____TTTTTTTT____',
        '___TTTTTTTTTT___',
        '___TT_RB__RB_TT_',
        '___TT_BR__BR_TT_',
        '___TTTTTTTTTT___',
        '___TTTRRRRRTTT__',
        '__TTTTTTTTTTTT__',
        '__TT__BBBBBB_TT_',
        '__TT__BRCBT__TT_',
        '__TT__BBTBB__TT_',
        '__TTTTTTTTTTTT__',
        '____TTTT_TTTT___',
        '____TTTT_TTTT___',
        '________________',
      ],
      [
        '________________',
        '________________',
        '____TTTTTTTT____',
        '___TTTTTTTTTT___',
        '___TT_BB__BB_TT_',
        '___TT_RR__RR_TT_',
        '___TTTTTTTTTT___',
        '___TTTRRRRRTTT__',
        '__TTTTTTTTTTTT__',
        '__TT__BBBBBB_TT_',
        '__TT__BRCBT__TT_',
        '__TT__BBTBB__TT_',
        '__TTTTTTTTTTTT__',
        '____TTTT_TTTT___',
        '____TTTT_TTTT___',
        '________________',
      ],
    ],
  },

  wave: {
    label: 'Wave',
    desc: 'Greeting — CLI startup, --help header, onboarding, first launch',
    gridSize: 16,
    fps: 3,
    sequence: [0, 1, 0, 1],
    frames: [
      [
        '________________',
        '________________',
        '____TTTTTTTT____',
        '___TTTTTTTTTT___',
        '___TT_BB__BB_TT_',
        '___TT_BC__BC_TT_',
        '___TTTTTTTTTT___',
        '___TTTTTTTTTT___',
        '__TTTTTTTTTTTTTT',
        '__TT__BBBBBB_TTT',
        '__TT__BTCBT__TTT',
        '__TT__BBTBB__TT_',
        '__TTTTTTTTTTTT__',
        '____TTTT_TTTT___',
        '____TTTT_TTTT___',
        '________________',
      ],
      [
        '________________',
        '_______________T',
        '____TTTTTTTT__TT',
        '___TTTTTTTTTTTT_',
        '___TT_BB__BB_TT_',
        '___TT_BC__BC_TT_',
        '___TTTTTTTTTT___',
        '___TTTTTTTTTT___',
        '__TTTTTTTTTTTTT_',
        '__TT__BBBBBB_TT_',
        '__TT__BTCBT__TT_',
        '__TT__BBTBB__TT_',
        '__TTTTTTTTTTTT__',
        '____TTTT_TTTT___',
        '____TTTT_TTTT___',
        '________________',
      ],
    ],
  },

  search: {
    label: 'Searching',
    desc: 'Vector search executing — scanning collection, top-k in progress',
    gridSize: 16,
    fps: 4,
    sequence: [0, 1, 2, 1],
    frames: [
      [
        '________________',
        '________________',
        '____TTTTTTTT____',
        '___TTTTTTTTTT___',
        '___TT_BB__CB_TT_',
        '___TT_BB__CC_TT_',
        '___TTTTTTTTTT___',
        '___TTTTTTTTTT___',
        '__TTTTTTTTTTTT__',
        '__TT__BBBBBB_TT_',
        '__TT__BTCBT__TT_',
        '__TT__BBTBB__TT_',
        '__TTTTTTTTTTTT__',
        '____TTTT_TTTT___',
        '____TTTT_TTTT___',
        '________________',
      ],
      [
        '________________',
        '________________',
        '____TTTTTTTT____',
        '___TTTTTTTTTT___',
        '___TT_BB__BB_TT_',
        '___TT_BC__CB_TT_',
        '___TTTTTTTTTT___',
        '___TTTTTTTTTT___',
        '__TTTTTTTTTTTT__',
        '__TT__BBBBBB_TT_',
        '__TT__BTCBT__TT_',
        '__TT__BBTBB__TT_',
        '__TTTTTTTTTTTT__',
        '____TTTT_TTTT___',
        '____TTTT_TTTT___',
        '________________',
      ],
      [
        '________________',
        '________________',
        '____TTTTTTTT____',
        '___TTTTTTTTTT___',
        '___TT_CB__BB_TT_',
        '___TT_CC__BB_TT_',
        '___TTTTTTTTTT___',
        '___TTTTTTTTTT___',
        '__TTTTTTTTTTTT__',
        '__TT__BBBBBB_TT_',
        '__TT__BTCBT__TT_',
        '__TT__BBTBB__TT_',
        '__TTTTTTTTTTTT__',
        '____TTTT_TTTT___',
        '____TTTT_TTTT___',
        '________________',
      ],
    ],
  },
};

// ─── Half-block terminal renderer ─────────────────────────────────────────────

/**
 * Converts a pixel row pair into a string of half-block characters with ANSI
 * 24-bit color. Uses ▀ (upper half) with fg=topPixel, bg=bottomPixel.
 */
function renderRowPair(topRow, botRow, indent) {
  const pad = ' '.repeat(indent);
  let line = pad;

  const len = Math.max(topRow.length, botRow?.length ?? 0);
  for (let x = 0; x < len; x++) {
    const topKey = topRow[x] ?? '_';
    const botKey = botRow?.[x] ?? '_';
    const topRgb = PALETTE[topKey];
    const botRgb = PALETTE[botKey];

    if (!topRgb && !botRgb) {
      line += ' ';
    } else if (topRgb && !botRgb) {
      line += `${fg(topRgb[0], topRgb[1], topRgb[2])}▀${RESET}`;
    } else if (!topRgb && botRgb) {
      line += `${fg(botRgb[0], botRgb[1], botRgb[2])}▄${RESET}`;
    } else {
      line += `${fg(topRgb[0], topRgb[1], topRgb[2])}${bg24(botRgb[0], botRgb[1], botRgb[2])}▀${RESET}`;
    }
  }
  return line;
}

/**
 * Renders a single pixel grid frame to a terminal string using half-blocks.
 * @param {string[]} grid
 * @param {Object} [opts]
 * @param {number} [opts.indent=2]
 * @param {boolean} [opts.color=true]
 * @returns {string}
 */
function renderFrame(grid, { indent = 2, color = true } = {}) {
  if (!color) return renderAscii(grid, indent);

  const lines = [];
  for (let y = 0; y < grid.length; y += 2) {
    lines.push(renderRowPair(grid[y], grid[y + 1], indent));
  }
  return lines.join('\n');
}

/**
 * Renders a pose's first frame as a static terminal string.
 * @param {string} poseName
 * @param {Object} [opts]
 * @returns {string}
 */
function render(poseName, opts = {}) {
  const pose = POSES[poseName];
  if (!pose) throw new Error(`Unknown pose: ${poseName}`);
  return renderFrame(pose.frames[0], opts);
}

// ─── ASCII fallback renderer ──────────────────────────────────────────────────

function renderAscii(grid, indent = 2) {
  const ASCII = { T: '\u2588', C: '\u2593', B: '\u2591', D: '\u2592', W: '\u2588', R: '\u2588', Y: '\u2588', G: '\u2588', _: ' ' };
  const pad = ' '.repeat(indent);
  return grid.map(row =>
    pad + [...row].map(ch => ASCII[ch] ?? ' ').join('')
  ).join('\n');
}

// ─── SVG renderer (for web playground) ────────────────────────────────────────

function renderSvg(grid, pixelSize = 4) {
  const gridSize = grid.length;
  const size = gridSize * pixelSize;
  const rects = [];

  grid.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const rgb = PALETTE[ch];
      if (rgb) {
        const hex = `#${rgb.map(v => v.toString(16).padStart(2, '0')).join('')}`;
        rects.push(
          `  <rect x="${x * pixelSize}" y="${y * pixelSize}" ` +
          `width="${pixelSize}" height="${pixelSize}" fill="${hex}"/>`
        );
      }
    });
  });

  return [
    `<svg xmlns="http://www.w3.org/2000/svg"`,
    `     width="${size}" height="${size}"`,
    `     viewBox="0 0 ${size} ${size}"`,
    `     shape-rendering="crispEdges">`,
    ...rects,
    `</svg>`,
  ].join('\n');
}

// ─── Animated renderer for terminal ──────────────────────────────────────────

/**
 * Starts an animated robot in the terminal using in-place line overwriting.
 * Returns a stop() function — call it when the async operation completes.
 *
 * @param {string} poseName
 * @param {Object} [opts]
 * @param {number} [opts.indent=2]
 * @param {string} [opts.label='']
 * @returns {{ stop: (finalPose?: string) => void }}
 */
function animateRobot(poseName, { indent = 2, label = '', showElapsed = false } = {}) {
  const pose = POSES[poseName];
  if (!pose) throw new Error(`Unknown pose: ${poseName}`);

  const { frames, fps, sequence } = pose;
  const seq = sequence ?? frames.map((_, i) => i);
  const frameLines = Math.ceil((pose.gridSize ?? 16) / 2);
  const intervalMs = 1000 / fps;

  let seqIdx = 0;
  let stopped = false;
  const startTime = Date.now();

  const moveUp = (n) => process.stdout.write(`\x1b[${n}A`);
  const clearLine = () => process.stdout.write('\x1b[2K\r');

  const draw = () => {
    const frame = frames[seq[seqIdx % seq.length]];
    const rendered = renderFrame(frame, { indent });
    const lines = rendered.split('\n');

    const midLine = Math.floor(lines.length / 2);
    if (label || showElapsed) {
      let labelText = label ? `  ${colorize(COLORS.teal, label)}` : '';
      if (showElapsed) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        labelText += `  \x1b[2m${elapsed}s\x1b[0m`;
      }
      lines[midLine] += labelText;
    }

    process.stdout.write(lines.join('\n') + '\n');
    seqIdx++;
  };

  // Hide cursor during animation
  process.stdout.write('\x1b[?25l');
  draw();

  const timer = setInterval(() => {
    if (stopped) return;
    moveUp(frameLines);
    for (let i = 0; i < frameLines; i++) {
      clearLine();
      if (i < frameLines - 1) process.stdout.write('\n');
    }
    moveUp(frameLines - 1);
    draw();
  }, intervalMs);

  return {
    stop(finalPose) {
      stopped = true;
      clearInterval(timer);
      // Restore cursor
      process.stdout.write('\x1b[?25h');

      // Erase all robot frame lines
      moveUp(frameLines);
      for (let i = 0; i < frameLines; i++) {
        clearLine();
        if (i < frameLines - 1) process.stdout.write('\n');
      }
      moveUp(frameLines - 1);

      if (finalPose) {
        // Draw a replacement pose in place
        const frame = render(finalPose, { indent });
        process.stdout.write(frame + '\n');
      } else {
        // Collapse to a compact one-liner summary
        const rawLabel = (label || '').replace(/\x1b\[[0-9;]*m/g, '');
        let summary = `  \x1b[32m\u2713\x1b[0m ${rawLabel}`;
        if (showElapsed) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          summary += `  \x1b[2m${elapsed}s\x1b[0m`;
        }
        clearLine();
        process.stdout.write(summary + '\n');
      }
    },
  };
}

// ─── Utility: print a static pose with optional message ──────────────────────

function printRobot(poseName, message = '', opts = {}) {
  const rendered = render(poseName, opts);
  process.stdout.write(rendered + '\n');
  if (message) {
    const pad = ' '.repeat(opts.indent ?? 2);
    process.stdout.write(`${pad}${message}\n`);
  }
}

module.exports = {
  POSES,
  COLORS,
  PALETTE,
  colorize,
  render,
  renderFrame,
  renderAscii,
  renderSvg,
  animateRobot,
  printRobot,
};
