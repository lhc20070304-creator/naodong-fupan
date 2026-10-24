#!/usr/bin/env node
/* 把 index.html + css/style.css + js/data.js + js/main.js + js/easter.js 内联成单文件离线版 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

const html = read('index.html');
const css = read('css/style.css');
const data = read('js/data.js');
const main = read('js/main.js');
const easter = read('js/easter.js');

if (/<\/style/i.test(css)) throw new Error('CSS 含有 </style>，无法安全内联');
if (/<\/script/i.test(data + main + easter)) throw new Error('JS 含有 </script>，无法安全内联');

const out = html
  .replace('<link rel="stylesheet" href="css/style.css">', () => '<style>\n' + css + '\n</style>')
  .replace('<script src="js/data.js"></script>', () => '<script>\n' + data + '\n</script>')
  .replace('<script src="js/main.js"></script>', () => '<script>\n' + main + '\n</script>')
  .replace('<script src="js/easter.js"></script>', () => '<script>\n' + easter + '\n</script>');

if (out.includes('css/style.css') || out.includes('js/data.js') || out.includes('js/main.js') || out.includes('js/easter.js')) {
  throw new Error('仍有外部资源引用，构建失败');
}

const dist = path.join(root, 'dist');
fs.mkdirSync(dist, { recursive: true });
const target = path.join(dist, '脑洞复盘指挥中心-离线版.html');
fs.writeFileSync(target, out, 'utf8');
console.log('已生成：' + target);
console.log('大小：' + (Buffer.byteLength(out, 'utf8') / 1024).toFixed(1) + ' KB');
