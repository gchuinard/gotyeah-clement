const fs = require('fs');
const path = require('path');
const { inlineCss } = require('./lib/inline-css');
const { versionAssets } = require('./lib/version-assets');

const ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'index.html');
const CSS_PATH = path.join(ROOT, 'styles.css');

function fmtKB(bytes) {
  return (bytes / 1024).toFixed(1) + ' Ko';
}

const original = fs.readFileSync(HTML_PATH, 'utf8');

console.log('▸ Étape 1 : inline CSS');
const inlineResult = inlineCss(original, CSS_PATH);
console.log(`  CSS injecté : ${fmtKB(inlineResult.size)}`);

console.log('');
console.log('▸ Étape 2 : versioning des assets');
const versionResult = versionAssets(inlineResult.html, ROOT);
console.log(`  ${versionResult.versionedCount} assets versionnés`);

const final = versionResult.html;
const changed = final !== original;
if (changed) {
  fs.writeFileSync(HTML_PATH, final);
}

console.log('');
console.log('━━━ Résumé build ━━━');
console.log(`  Assets versionnés : ${versionResult.versionedCount}`);
if (versionResult.missingCount > 0) {
  console.log(`  ⚠ ${versionResult.missingCount} assets introuvables`);
} else {
  console.log(`  Assets introuvables : 0`);
}
console.log(changed ? '  index.html mis à jour' : '  index.html inchangé');
