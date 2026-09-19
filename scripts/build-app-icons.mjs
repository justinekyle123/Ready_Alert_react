// scripts/build-app-icons.mjs
// Rasterizes the editable SVG brand artwork in assets/ into the PNG sources that
// @capacitor/assets turns into the native launcher icons and splash screens.
//
// Usage:  npm run icons        (rasterize + generate native assets)
//         node scripts/build-app-icons.mjs   (rasterize only)
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const assetsDir = path.resolve(import.meta.dirname, '..', 'assets');

/** `opaque` strips the alpha channel — required for iOS app icons. */
const TARGETS = [
  { svg: 'icon.svg', png: 'icon.png', size: 1024, opaque: true },
  { svg: 'icon-background.svg', png: 'icon-background.png', size: 1024, opaque: true },
  { svg: 'icon-foreground.svg', png: 'icon-foreground.png', size: 1024, opaque: false },
  { svg: 'splash.svg', png: 'splash.png', size: 2732, opaque: true },
  { svg: 'splash-dark.svg', png: 'splash-dark.png', size: 2732, opaque: true },
];

for (const target of TARGETS) {
  const svg = await readFile(path.join(assetsDir, target.svg));

  let pipeline = sharp(svg, { density: 384 }).resize(target.size, target.size);
  if (target.opaque) {
    pipeline = pipeline.flatten({ background: '#0f172a' }).removeAlpha();
  }

  const png = await pipeline.png().toBuffer();
  await writeFile(path.join(assetsDir, target.png), png);

  const { width, height, hasAlpha } = await sharp(png).metadata();
  console.log(
    `${target.png.padEnd(22)} ${width}x${height}${hasAlpha ? ' (alpha)' : ' (opaque)'}`
  );
}

console.log('\nNow run: npx capacitor-assets generate --android --ios');
