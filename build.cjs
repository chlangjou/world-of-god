'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const css = '<style>\n' + read('style.css') + '\n</style>';
const scripts = '<script>\n' + read('sim.js') + '\n</script><script>\n' + read('app.js') + '\n</script>';
const source = read('index.html');
const result = source.replace('<link rel="stylesheet" href="style.css">', css)
  .replace('<script src="sim.js"></script><script src="app.js"></script>', scripts);
if (result === source || result.includes('src="sim.js"') || result.includes('href="style.css"'))
  throw new Error('Missing expected script/style markers in index.html');
const output = path.join(root, 'World-of-God-Web-MVP0.html');
fs.writeFileSync(output, result, 'utf8');
console.log('Offline single-file Web PoC built:', path.basename(output), Buffer.byteLength(result), 'bytes');
