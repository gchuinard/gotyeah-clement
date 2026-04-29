const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SRC = path.resolve(__dirname, '..', 'assets', 'hero-massage.jpeg');
const OUT_DIR = path.resolve(__dirname, '..', 'assets');

const WIDTHS = [600, 900, 1200];
const WEBP_QUALITY = 75;
const JPEG_QUALITY = 80;
const JPEG_FALLBACK_WIDTHS = [900, 1200];

function fmtKB(bytes) {
  return (bytes / 1024).toFixed(1) + ' Ko';
}

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error('Source introuvable :', SRC);
    process.exit(1);
  }

  const srcStat = fs.statSync(SRC);
  const meta = await sharp(SRC).metadata();
  console.log(`Source : ${path.relative(process.cwd(), SRC)}`);
  console.log(`  ${meta.width}x${meta.height} — ${fmtKB(srcStat.size)}`);
  console.log('');

  const results = [];

  for (const w of WIDTHS) {
    const out = path.join(OUT_DIR, `hero-massage-${w}.webp`);
    await sharp(SRC)
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toFile(out);
    results.push({ file: out, size: fs.statSync(out).size });
  }

  for (const w of JPEG_FALLBACK_WIDTHS) {
    const out = path.join(OUT_DIR, `hero-massage-${w}.jpg`);
    await sharp(SRC)
      .resize({ width: w, withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true, progressive: true })
      .toFile(out);
    results.push({ file: out, size: fs.statSync(out).size });
  }

  console.log('Sorties :');
  let total = 0;
  for (const r of results) {
    console.log(`  ${path.relative(process.cwd(), r.file).padEnd(38)} ${fmtKB(r.size)}`);
    total += r.size;
  }
  console.log('');
  console.log(`Total généré : ${fmtKB(total)}`);
  console.log(`Original     : ${fmtKB(srcStat.size)} (conservé)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
