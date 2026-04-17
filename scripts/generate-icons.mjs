import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = join(__dirname, 'logo-white.svg');
const svgBuffer = readFileSync(svgPath);

const sizes = [
  { name: 'icon-180.png', size: 180 },
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'icon-1024.png', size: 1024 },
  { name: 'icon-1024-light.png', size: 1024 },
];

for (const { name, size } of sizes) {
  const outPath = join(__dirname, '..', 'public', 'icons', name);
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(outPath);
  console.log(`✓ ${name} (${size}x${size})`);
}

// favicon-32x32 et favicon-16x16
for (const size of [16, 32]) {
  const outPath = join(__dirname, '..', 'public', `favicon-${size}x${size}.png`);
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(outPath);
  console.log(`✓ favicon-${size}x${size}.png`);
}

// apple-touch-icon (180px, fond blanc, pas de radius sur le PNG)
const atPath = join(__dirname, '..', 'public', 'apple-touch-icon.png');
await sharp(svgBuffer)
  .resize(180, 180)
  .png()
  .toFile(atPath);
console.log('✓ apple-touch-icon.png');

console.log('\nTous les icônes générés avec succès.');
