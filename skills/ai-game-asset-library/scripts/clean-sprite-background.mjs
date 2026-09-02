#!/usr/bin/env node

import sharp from "sharp";

const [input, output, columnsArg = "6", rowsArg = "4", thresholdArg = "6"] = process.argv.slice(2);

if (!input || !output) {
  console.error("Usage: node scripts/clean-sprite-background.mjs <input> <output> [columns] [rows] [threshold]");
  process.exit(1);
}

const columns = Number(columnsArg);
const rows = Number(rowsArg);
const threshold = Number(thresholdArg);
const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const frameWidth = Math.floor(info.width / columns);
const frameHeight = Math.floor(info.height / rows);
const outputPixels = Buffer.from(data);

const colorDistance = (left, right) => {
  const dr = data[left] - data[right];
  const dg = data[left + 1] - data[right + 1];
  const db = data[left + 2] - data[right + 2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
};

for (let frameY = 0; frameY < rows; frameY += 1) {
  for (let frameX = 0; frameX < columns; frameX += 1) {
    const originX = frameX * frameWidth;
    const originY = frameY * frameHeight;
    const visited = new Uint8Array(frameWidth * frameHeight);
    const queue = new Int32Array(frameWidth * frameHeight);
    let head = 0;
    let tail = 0;

    const enqueue = (x, y) => {
      const local = y * frameWidth + x;
      if (visited[local]) return;
      visited[local] = 1;
      queue[tail] = local;
      tail += 1;
    };

    for (let x = 0; x < frameWidth; x += 1) {
      enqueue(x, 0);
      enqueue(x, frameHeight - 1);
    }
    for (let y = 1; y < frameHeight - 1; y += 1) {
      enqueue(0, y);
      enqueue(frameWidth - 1, y);
    }

    while (head < tail) {
      const local = queue[head];
      head += 1;
      const x = local % frameWidth;
      const y = Math.floor(local / frameWidth);
      const sourceOffset = ((originY + y) * info.width + originX + x) * 4;

      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= frameWidth || ny >= frameHeight) continue;
        const neighborLocal = ny * frameWidth + nx;
        if (visited[neighborLocal]) continue;
        const neighborOffset = ((originY + ny) * info.width + originX + nx) * 4;
        if (colorDistance(sourceOffset, neighborOffset) <= threshold) enqueue(nx, ny);
      }
    }

    for (let y = 0; y < frameHeight; y += 1) {
      for (let x = 0; x < frameWidth; x += 1) {
        const local = y * frameWidth + x;
        const offset = ((originY + y) * info.width + originX + x) * 4;
        const frameGutter = x < 3 || y < 3 || x >= frameWidth - 3 || y >= frameHeight - 3;
        if (visited[local] || frameGutter) outputPixels[offset + 3] = 0;
      }
    }
  }
}

await sharp(outputPixels, { raw: info }).png({ compressionLevel: 9 }).toFile(output);
console.log(`Wrote transparent atlas: ${output}`);
