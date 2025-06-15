const chalk = require('chalk');
const kleur = require('kleur');
const gradient = require('gradient-string');
const {
  teen,
  cristal,
  rainbow,
  pastel,
  vice,
  mind,
  morning,
  instagram,
  atlas,
  retro,
  summer,
  fruit,
  passion } = gradient;
const util = require('util');

// ===== BASE SETUP ===== //
const format = (...args) => {
  return args.map(arg => {
    if (typeof arg === 'string') return arg;
    if (arg instanceof Error) return arg.stack || arg.message;
    return util.inspect(arg, { 
      colors: false, 
      depth: 4,
      showHidden: false
    });
  }).join(' ');
};

const supportsColor = chalk.supportsColor;
let COLOR_ENABLED = supportsColor.hasBasic;

// ===== MAIN LOGGER ===== //
const logger = (msg, style = x => x) => {
  if (!COLOR_ENABLED) style = x => x;
  console.log(style(format(msg)));
};

// ===== COLOR CONTROL ===== //
logger.enableColors = (enabled = true) => {
  COLOR_ENABLED = enabled;
  chalk.level = enabled ? (supportsColor.has16m ? 3 : 2) : 0;
  kleur.enabled = enabled;
};

// ===== CHALK INTEGRATION ===== //
const chalkStyles = {
  modifiers: ['bold', 'dim', 'italic', 'underline', 'inverse', 'strikethrough'],
  colors: ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white', 'gray'],
  backgrounds: ['bgBlack', 'bgRed', 'bgGreen', 'bgYellow', 'bgBlue', 'bgMagenta', 'bgCyan', 'bgWhite']
};

logger.chalk = {};
Object.entries(chalkStyles).forEach(([type, styles]) => {
  styles.forEach(style => {
    if (chalk[style]) {
      logger.chalk[style] = (...msgs) => logger(msgs, chalk[style]);
    }
  });
});

logger.chalk.hex = (hex) => ({
  print: (...msgs) => logger(msgs, chalk.hex(hex)),
  bg: (...msgs) => logger(msgs, chalk.bgHex(hex))
});

logger.chalk.rgb = (r, g, b) => ({
  print: (...msgs) => logger(msgs, chalk.rgb(r, g, b)),
  bg: (...msgs) => logger(msgs, chalk.bgRgb(r, g, b))
});

// ===== KLEUR INTEGRATION ===== //
const kleurStyles = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white', 'gray'];

logger.kleur = {};
kleurStyles.forEach(color => {
  if (kleur[color]) {
    logger.kleur[color] = (...msgs) => logger(msgs, kleur[color]);
    
    ['bold', 'italic', 'underline'].forEach(mod => {
      if (kleur[color][mod]) {
        logger.kleur[`${color}.${mod}`] = (...msgs) => logger(msgs, kleur[color][mod]);
      }
    });
  }
});

// ===== GRADIENT INTEGRATION ===== //
const gradientPresets = {
  teen,
  cristal,
  rainbow,
  pastel,
  vice,
  mind,
  morning,
  instagram,
  atlas,
  retro,
  summer,
  fruit,
  passion
};

logger.gradient = {};
Object.entries(gradientPresets).forEach(([name, grad]) => {
  logger.gradient[name] = (...msgs) => 
    COLOR_ENABLED 
      ? logger(msgs, typeof grad === 'function' ? grad : gradient(grad))
      : logger(msgs);
});

logger.createGradient = (colors) => ({
  print: (...msgs) => logger(msgs, gradient(colors)),
  multiline: (...msgs) => logger(msgs, gradient(colors).multiline)
});

// ===== UTILITIES ===== //
logger.error = (...errs) => {
  const message = errs.map(err => err instanceof Error ? err.stack || err.message : err).join(' ');
  logger(message, chalk.red.bold);
};

logger.success = (...msgs) => {
  logger(msgs, fruit);
};

logger.warn = (...msgs) => {
  logger(msgs, chalk.yellow.bold);
};

logger.info = (...msgs) => {
  logger(msgs, gradient.instagram);
};

logger.json = (obj) => {
  try {
    logger(JSON.stringify(obj, null, 2), chalk.cyan);
  } catch (e) {
    logger('Invalid JSON object', chalk.red);
  }
};

logger.progress = (percent, width = 20) => {
  const clamped = Math.min(1, Math.max(0, percent));
  const blocks = '█'.repeat(Math.round(clamped * width)).padEnd(width, '░');
  logger(`[${blocks}] ${Math.round(clamped * 100)}%`, chalk.green);
};

// ===== INIT ===== //
logger.enableColors(supportsColor.hasBasic);

module.exports = { logger };