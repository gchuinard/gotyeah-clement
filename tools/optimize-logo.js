const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SRC = path.resolve(__dirname, '..', 'assets', 'logo-c.png');
const OUT_DIR = path.resolve(__dirname, '..', 'assets');

const SIZES = [68, 102];
const WEBP_QUALITY = 75;

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

  for (const size of SIZES) {
    const webpOut = path.join(OUT_DIR, `logo-c-${size}.webp`);
    await sharp(SRC)
      .resize({ width: size, height: size, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toFile(webpOut);
    results.push({ file: webpOut, size: fs.statSync(webpOut).size });

    const pngOut = path.join(OUT_DIR, `logo-c-${size}.png`);
    await sharp(SRC)
      .resize({ width: size, height: size, withoutEnlargement: true })
      .png({ compressionLevel: 9, palette: true })
      .toFile(pngOut);
    results.push({ file: pngOut, size: fs.statSync(pngOut).size });
  }

  console.log('Sorties :');
  let total = 0;
  for (const r of results) {
    console.log(`  ${path.relative(process.cwd(), r.file).padEnd(36)} ${fmtKB(r.size)}`);
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
