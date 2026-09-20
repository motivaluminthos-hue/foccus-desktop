// Gera build/icon.ico (PNG 256x256 embutido) a partir de build/icon.png. Uso: npx electron scripts/make-ico.js
const { app, nativeImage } = require('electron');
const fs = require('fs'), path = require('path');
app.whenReady().then(() => {
  const src = nativeImage.createFromPath(path.join(__dirname, '..', 'build', 'icon.png'));
  const png = src.resize({ width: 256, height: 256, quality: 'best' }).toPNG();
  const h = Buffer.alloc(22);
  h.writeUInt16LE(0, 0); h.writeUInt16LE(1, 2); h.writeUInt16LE(1, 4);
  h[6] = 0; h[7] = 0; h[8] = 0; h[9] = 0; h.writeUInt16LE(1, 10); h.writeUInt16LE(32, 12);
  h.writeUInt32LE(png.length, 14); h.writeUInt32LE(22, 18);
  fs.writeFileSync(path.join(__dirname, '..', 'build', 'icon.ico'), Buffer.concat([h, png]));
  app.quit();
});
