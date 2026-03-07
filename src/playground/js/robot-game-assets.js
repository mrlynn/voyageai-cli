(() => {
  'use strict';

  const COLORS = {
    teal:   [0, 212, 170],
    cyan:   [64, 224, 255],
    bg:     [13, 17, 23],
    dark:   [10, 22, 40],
    white:  [230, 237, 243],
    red:    [248, 81, 73],
    yellow: [210, 153, 34],
    green:  [63, 185, 80],
  };

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

  const POSES = {
    idle: {
      label: 'Idle',
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
      gridSize: 16,
      fps: 4,
      sequence: [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
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

  function getPose(poseName) {
    return POSES[poseName] || POSES.idle;
  }

  function getFrame(poseName, tick = 0) {
    const pose = getPose(poseName);
    const seq = pose.sequence || pose.frames.map((_, index) => index);
    return pose.frames[seq[Math.abs(tick) % seq.length]];
  }

  function drawGrid(ctx, grid, {
    x = 0,
    y = 0,
    pixelSize = 4,
    alpha = 1,
    center = false,
    mirror = false,
  } = {}) {
    if (!ctx || !grid) return;

    const width = grid[0].length * pixelSize;
    const height = grid.length * pixelSize;
    const originX = center ? x - width / 2 : x;
    const originY = center ? y - height / 2 : y;

    ctx.save();
    ctx.globalAlpha *= alpha;

    grid.forEach((row, rowIndex) => {
      for (let colIndex = 0; colIndex < row.length; colIndex++) {
        const char = row[colIndex];
        const rgb = PALETTE[char];
        if (!rgb) continue;

        const drawX = mirror
          ? originX + ((row.length - 1 - colIndex) * pixelSize)
          : originX + (colIndex * pixelSize);

        ctx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
        ctx.fillRect(drawX, originY + (rowIndex * pixelSize), pixelSize, pixelSize);
      }
    });

    ctx.restore();
  }

  function drawPose(ctx, poseName, tick, options = {}) {
    drawGrid(ctx, getFrame(poseName, tick), options);
  }

  function renderSvg(grid, pixelSize = 4) {
    const size = grid.length * pixelSize;
    const rects = [];

    grid.forEach((row, y) => {
      [...row].forEach((char, x) => {
        const rgb = PALETTE[char];
        if (!rgb) return;
        const hex = `#${rgb.map(value => value.toString(16).padStart(2, '0')).join('')}`;
        rects.push(
          `<rect x="${x * pixelSize}" y="${y * pixelSize}" width="${pixelSize}" height="${pixelSize}" fill="${hex}"/>`
        );
      });
    });

    return [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">`,
      ...rects,
      '</svg>',
    ].join('');
  }

  function getDimensions(poseName, pixelSize = 4) {
    const pose = getPose(poseName);
    return {
      width: pose.gridSize * pixelSize,
      height: pose.gridSize * pixelSize,
    };
  }

  window.VAIRobotAssets = {
    COLORS,
    PALETTE,
    POSES,
    getPose,
    getFrame,
    drawGrid,
    drawPose,
    renderSvg,
    getDimensions,
  };
})();
