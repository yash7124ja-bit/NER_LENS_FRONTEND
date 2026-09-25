const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const assetsDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Exact website logo path from web-pwa-reference/public/icon.svg
const pathD = "M 180 0 C 221.974 0 256 34.026 256 76 L 256 256 L 208 256 L 208 76 C 208 60.536 195.464 48 180 48 C 164.536 48 152 60.536 152 76 L 152 180 C 152 221.974 117.974 256 76 256 C 34.026 256 0 221.974 0 180 L 0 0 L 48 0 L 48 180 C 48 195.464 60.536 208 76 208 C 91.464 208 104 195.464 104 180 L 104 76 C 104 34.026 138.026 0 180 0 Z";

// 1. Full Icon (1024x1024)
const fullIconSvg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" rx="220" fill="#0C141F"/>
  <!-- Subtly elevated circle for HUD depth -->
  <circle cx="512" cy="512" r="380" fill="#131A26" stroke="#28354A" stroke-width="4"/>
  <!-- Gradient for the mark -->
  <defs>
    <linearGradient id="cyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#42FDD3"/>
      <stop offset="100%" stop-color="#00E5BC"/>
    </linearGradient>
  </defs>
  <!-- Scale 256x256 to ~460px centered at (512, 512) -->
  <g transform="translate(282, 282) scale(1.8)">
    <path d="${pathD}" fill="url(#cyanGrad)"/>
  </g>
</svg>
`;

// 2. Adaptive Icon Foreground (1024x1024 with safe zone inside central 66%)
const adaptiveForegroundSvg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="cyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#42FDD3"/>
      <stop offset="100%" stop-color="#00E5BC"/>
    </linearGradient>
  </defs>
  <!-- Scale 256x256 to ~384px inside 1024 safe area (translate ~320, 320, scale 1.5) -->
  <g transform="translate(320, 320) scale(1.5)">
    <path d="${pathD}" fill="url(#cyanGrad)"/>
  </g>
</svg>
`;

// 3. Adaptive Icon Background (1024x1024)
const adaptiveBackgroundSvg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" fill="#0C141F"/>
  <circle cx="512" cy="512" r="360" fill="#131A26" stroke="#28354A" stroke-width="3"/>
</svg>
`;

// 4. Monochrome Icon (1024x1024)
const monochromeSvg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(320, 320) scale(1.5)">
    <path d="${pathD}" fill="#FFFFFF"/>
  </g>
</svg>
`;

// 5. Splash Screen Icon
const splashSvg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="cyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#42FDD3"/>
      <stop offset="100%" stop-color="#00E5BC"/>
    </linearGradient>
  </defs>
  <g transform="translate(128, 128) scale(1.0)">
    <path d="${pathD}" fill="url(#cyanGrad)"/>
  </g>
</svg>
`;

async function generate() {
  console.log('Generating app icons from website logo SVG...');
  await sharp(Buffer.from(fullIconSvg)).png().toFile(path.join(assetsDir, 'icon.png'));
  console.log('Generated assets/icon.png');

  await sharp(Buffer.from(adaptiveForegroundSvg)).png().toFile(path.join(assetsDir, 'android-icon-foreground.png'));
  console.log('Generated assets/android-icon-foreground.png');

  await sharp(Buffer.from(adaptiveBackgroundSvg)).png().toFile(path.join(assetsDir, 'android-icon-background.png'));
  console.log('Generated assets/android-icon-background.png');

  await sharp(Buffer.from(monochromeSvg)).png().toFile(path.join(assetsDir, 'android-icon-monochrome.png'));
  console.log('Generated assets/android-icon-monochrome.png');

  await sharp(Buffer.from(splashSvg)).png().toFile(path.join(assetsDir, 'splash-icon.png'));
  console.log('Generated assets/splash-icon.png');

  await sharp(Buffer.from(fullIconSvg)).resize(192, 192).png().toFile(path.join(assetsDir, 'favicon.png'));
  console.log('Generated assets/favicon.png');

  console.log('All icons generated successfully!');
}

generate().catch(err => {
  console.error(err);
  process.exit(1);
});
