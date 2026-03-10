/**
 * @file src/lib/robot.js
 * @description Avi — canonical brand mascot and terminal renderer.
 *
 * This is the single source of truth for all robot poses, animations, and
 * terminal rendering. Every interface (CLI, TUI chat, web playground) imports
 * from here — the web playground uses renderSvg(), the terminal uses render().
 *
 * Rendering technique: half-block characters (▀ ▄ █) pack two pixel rows into
 * one terminal row, giving the correct ~1:1 aspect ratio in monospace terminals.
 * 24-bit ANSI color via chalk.rgb() for teal/cyan body colors.
 *
 * @module robot
 */

import chalk from 'chalk';

// ─── Brand color values (RGB triples) ────────────────────────────────────────
export const COLORS = {
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
 * @type {Object.<string, number[]|null>}
 */
export const PALETTE = {
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

// ─── Pose definitions ─────────────────────────────────────────────────────────
/**
 * Each pose is an object with:
 *   label    {string}    Human-readable name
 *   desc     {string}    Usage context
 *   gridSize {number}    Width/height of the pixel grid (default 16)
 *   frames   {string[][]} Array of frames, each frame is an array of row strings
 *   fps      {number}    Animation speed (frames per second)
 *   sequence {number[]}  Optional: frame index sequence for non-linear animation
 *
 * @type {Object.<string, PoseDef>}
 */
export const POSES = {

  // ── idle ────────────────────────────────────────────────────────────────────
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

  // ── blink ───────────────────────────────────────────────────────────────────
  blink: {
    label: 'Blink',
    desc: 'Idle with periodic eye blink — long-running waits, screensaver',
    gridSize: 16,
    fps: 4,
    sequence: [0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0],
    frames: [
      // open
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
      // closed
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

  // ── thinking ─────────────────────────────────────────────────────────────
  thinking: {
    label: 'Thinking',
    desc: 'Processing — embedding, vector search, reranking, LLM call',
    gridSize: 16,
    fps: 3,
    sequence: [0, 1, 2, 1],
    frames: [
      // look left
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
      // center
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
      // look right
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

  // ── success ──────────────────────────────────────────────────────────────
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

  // ── error ────────────────────────────────────────────────────────────────
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

  // ── wave ─────────────────────────────────────────────────────────────────
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

  // ── search ───────────────────────────────────────────────────────────────
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
 *
 * This packs two pixel rows into one terminal row, giving correct aspect ratio.
 *
 * @param {string} topRow    - Row string from pixel grid (top of pair)
 * @param {string} botRow    - Row string from pixel grid (bottom of pair)
 * @param {number} [indent]  - Leading spaces before each line
 * @returns {string}         - Colored terminal string for one output line
 */
function renderRowPair(topRow, botRow, indent = 0) {
  const pad = ' '.repeat(indent);
  let line = pad;

  const len = Math.max(topRow.length, botRow?.length ?? 0);
  for (let x = 0; x < len; x++) {
    const topKey = topRow[x] ?? '_';
    const botKey = botRow?.[x] ?? '_';
    const topRgb = PALETTE[topKey];
    const botRgb = PALETTE[botKey];

    if (!topRgb && !botRgb) {
      // both transparent — just a space
      line += ' ';
    } else if (topRgb && !botRgb) {
      // only top pixel — upper half block, bg = terminal default
      line += chalk.rgb(...topRgb)('▀');
    } else if (!topRgb && botRgb) {
      // only bottom pixel — lower half block
      line += chalk.rgb(...botRgb)('▄');
    } else {
      // both pixels — upper half block with fg=top, bg=bottom
      line += chalk.rgb(...topRgb).bgRgb(...botRgb)('▀');
    }
  }
  return line;
}

/**
 * Renders a single pixel grid frame to a terminal string using half-blocks.
 *
 * @param {string[]} grid    - Array of row strings (the pixel grid)
 * @param {Object}  [opts]
 * @param {number}  [opts.indent=2]    - Leading spaces per line
 * @param {boolean} [opts.color=true]  - Use 24-bit color (false = grayscale)
 * @returns {string}  Ready to console.log() or process.stdout.write()
 */
export function renderFrame(grid, { indent = 2, color = true } = {}) {
  if (!color) {
    // Graceful fallback: ASCII block art
    return renderAscii(grid, indent);
  }

  const lines = [];
  for (let y = 0; y < grid.length; y += 2) {
    lines.push(renderRowPair(grid[y], grid[y + 1], indent));
  }
  return lines.join('\n');
}

/**
 * Renders a pose's first frame as a static terminal string.
 *
 * @param {string} poseName  - Key from POSES
 * @param {Object} [opts]    - Passed to renderFrame
 * @returns {string}
 */
export function render(poseName, opts = {}) {
  const pose = POSES[poseName];
  if (!pose) throw new Error(`Unknown pose: ${poseName}`);
  return renderFrame(pose.frames[0], opts);
}

// ─── ASCII fallback renderer ──────────────────────────────────────────────────
/**
 * Renders a grid as ASCII/Unicode block characters without ANSI color.
 * Safe for terminals without color support or for piped output.
 *
 * @param {string[]} grid
 * @param {number} [indent=2]
 * @returns {string}
 */
export function renderAscii(grid, indent = 2) {
  const ASCII = { T: '█', C: '▓', B: '░', D: '▒', W: '█', R: '█', Y: '█', G: '█', _: ' ' };
  const pad = ' '.repeat(indent);
  return grid.map(row =>
    pad + [...row].map(ch => ASCII[ch] ?? ' ').join('')
  ).join('\n');
}

// ─── SVG renderer (for web playground + Electron) ────────────────────────────
/**
 * Renders a pixel grid frame as an SVG string.
 * Used by the web playground and Electron app — NOT used in the terminal.
 *
 * @param {string[]} grid
 * @param {number}   [pixelSize=4]   Pixels per grid cell
 * @returns {string}  SVG markup string
 */
export function renderSvg(grid, pixelSize = 4) {
  const gridSize = grid.length;
  const size = gridSize * pixelSize;
  const rects = [];

  grid.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const rgb = PALETTE[ch];
      if (rgb) {
        const hex = `#${rgb.map(v => v.toString(16).padStart(2,'0')).join('')}`;
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
 * @param {string}   poseName          - Key from POSES
 * @param {Object}  [opts]
 * @param {number}  [opts.indent=2]    - Leading spaces
 * @param {string}  [opts.label='']    - Text shown to the right of the robot
 * @returns {{ stop: (finalPose?: string) => void }}
 *
 * @example
 * const anim = animateRobot('thinking', { label: 'Searching vai-docs…' });
 * await doExpensiveWork();
 * anim.stop('success');
 */
export function animateRobot(poseName, { indent = 2, label = '' } = {}) {
  const pose = POSES[poseName];
  if (!pose) throw new Error(`Unknown pose: ${poseName}`);

  const { frames, fps, sequence } = pose;
  const seq = sequence ?? frames.map((_, i) => i);
  const frameLines = Math.ceil((pose.gridSize ?? 16) / 2);
  const intervalMs = 1000 / fps;

  let seqIdx = 0;
  let stopped = false;

  // Move cursor up N lines utility
  const moveUp = (n) => process.stdout.write(`\x1b[${n}A`);
  const clearLine = () => process.stdout.write('\x1b[2K\r');

  // Initial render
  const draw = () => {
    const frame = frames[seq[seqIdx % seq.length]];
    const rendered = renderFrame(frame, { indent });
    const lines = rendered.split('\n');

    // Add label to the right of the robot's middle line
    const midLine = Math.floor(lines.length / 2);
    if (label) {
      lines[midLine] += `  ${chalk.rgb(...COLORS.teal)(label)}`;
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
    // clear each line before redraw
    for (let i = 0; i < frameLines; i++) {
      clearLine();
      if (i < frameLines - 1) process.stdout.write('\n');
    }
    moveUp(frameLines - 1);
    draw();
  }, intervalMs);

  return {
    /**
     * Stop the animation and optionally show a final static pose.
     * @param {string} [finalPose] - Optional pose name to show when stopped
     */
    stop(finalPose) {
      stopped = true;
      clearInterval(timer);
      // Restore cursor
      process.stdout.write('\x1b[?25h');
      if (finalPose) {
        moveUp(frameLines);
        for (let i = 0; i < frameLines; i++) {
          clearLine();
          if (i < frameLines - 1) process.stdout.write('\n');
        }
        moveUp(frameLines - 1);
        const frame = render(finalPose, { indent });
        process.stdout.write(frame + '\n');
      }
    },
  };
}

// ─── Utility: print a static pose with optional message ──────────────────────
/**
 * Print a static robot pose to stdout with an optional message beside/below it.
 *
 * @param {string} poseName
 * @param {string} [message]
 * @param {Object} [opts]
 * @param {number} [opts.indent=2]
 */
export function printRobot(poseName, message = '', opts = {}) {
  const rendered = render(poseName, opts);
  process.stdout.write(rendered + '\n');
  if (message) {
    const indent = ' '.repeat(opts.indent ?? 2);
    process.stdout.write(`${indent}${message}\n`);
  }
}

export default {
  POSES,
  COLORS,
  PALETTE,
  render,
  renderFrame,
  renderAscii,
  renderSvg,
  animateRobot,
  printRobot,
};