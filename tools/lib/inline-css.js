const fs = require('fs');

const START = '<!-- INLINE_CSS_START -->';
const END = '<!-- INLINE_CSS_END -->';

function inlineCss(html, cssPath) {
  if (!fs.existsSync(cssPath)) {
    throw new Error(`Source CSS introuvable : ${cssPath}`);
  }

  const css = fs.readFileSync(cssPath, 'utf8');

  const startIdx = html.indexOf(START);
  const endIdx = html.indexOf(END);

  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error(
      `Marqueurs introuvables dans index.html. Attendu : ${START} ... ${END}`
    );
  }

  if (css.includes('</style>')) {
    throw new Error('styles.css contient "</style>", ce qui casserait le HTML.');
  }

  const before = html.slice(0, startIdx + START.length);
  const after = html.slice(endIdx);
  const block = `\n    <style>\n${css.trimEnd()}\n    </style>\n    `;

  return {
    html: before + block + after,
    size: Buffer.byteLength(css, 'utf8'),
  };
}

module.exports = { inlineCss };
