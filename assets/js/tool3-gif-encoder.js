/* Incremental GIF89a encoder. Shared by the worker and the file:// fallback. */
(function (root) {
  'use strict';
  const palette = new Uint8Array(768);
  for (let i = 0; i < 32; i++) palette.fill(Math.round(i * 255 / 31), i * 3, i * 3 + 3);
  let index = 32;
  for (let r = 0; r < 6; r++) for (let g = 0; g < 6; g++) for (let b = 0; b < 6; b++) {
    palette.set([r * 51, g * 51, b * 51], index++ * 3);
  }
  ['922b3e','30648a','0f172a','dc2626','2563eb','64748b','94a3b8','475569'].forEach(hex => {
    palette.set([0,2,4].map(i => parseInt(hex.slice(i,i+2),16)), index++ * 3);
  });
  let colorLookup;
  function makeLookup() {
    if (colorLookup) return colorLookup;
    colorLookup = new Uint8Array(32768);
    for (let key = 0; key < 32768; key++) {
      const r = ((key >> 10) & 31) * 8 + 4, g = ((key >> 5) & 31) * 8 + 4, b = (key & 31) * 8 + 4;
      let best = 0, distance = Infinity;
      for (let i = 0; i < 256; i++) {
        const dr = r - palette[i*3], dg = g - palette[i*3+1], db = b - palette[i*3+2];
        const d = dr*dr + dg*dg + db*db;
        if (d < distance) { best = i; distance = d; }
      }
      colorLookup[key] = best;
    }
    return colorLookup;
  }
  function indexedPixels(rgba) {
    const lookup = makeLookup(), out = new Uint8Array(rgba.length / 4);
    for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
      const a = rgba[i+3] / 255;
      const r = Math.round(rgba[i] * a + 255 * (1-a));
      const g = Math.round(rgba[i+1] * a + 255 * (1-a));
      const b = Math.round(rgba[i+2] * a + 255 * (1-a));
      out[j] = Math.max(r,g,b) - Math.min(r,g,b) < 8
        ? Math.round((r+g+b) / 3 * 31 / 255)
        : lookup[((r>>3)<<10) | ((g>>3)<<5) | (b>>3)];
    }
    return out;
  }
  function lzw(pixels) {
    const bytes = [];
    let bits = 0, pending = 0, codeSize = 9, decoderNext = 258, hasPrevious = false;
    const write = code => {
      pending |= code << bits;
      bits += codeSize;
      while (bits >= 8) { bytes.push(pending & 255); pending >>>= 8; bits -= 8; }
    };
    const writeData = code => {
      write(code);
      if (hasPrevious && decoderNext < 4096) {
        decoderNext++;
        if (decoderNext === (1 << codeSize) && codeSize < 12) codeSize++;
      }
      hasPrevious = true;
    };
    let dictionary = new Map(), next = 258;
    const clear = () => {
      write(256);
      dictionary.clear(); next = 258;
      codeSize = 9; decoderNext = 258; hasPrevious = false;
    };
    clear();
    if (pixels.length) {
      let prefix = pixels[0];
      for (let i = 1; i < pixels.length; i++) {
        const byte = pixels[i], key = prefix * 256 + byte;
        const found = dictionary.get(key);
        if (found !== undefined) { prefix = found; continue; }
        writeData(prefix);
        if (next < 4096) dictionary.set(key, next++);
        else clear();
        prefix = byte;
      }
      writeData(prefix);
    }
    write(257);
    if (bits) bytes.push(pending & 255);
    return Uint8Array.from(bytes);
  }
  function le16(n) { return Uint8Array.of(n & 255, (n >> 8) & 255); }
  function createEncoder(width, height) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 4096 || height > 4096 || width*height > 8000000) throw new Error('Unsupported GIF dimensions. Use a smaller resolution.');
    const parts = [Uint8Array.of(71,73,70,56,57,97),le16(width),le16(height),Uint8Array.of(0xf7,0,0),palette.slice(),Uint8Array.of(0x21,0xff,11,78,69,84,83,67,65,80,69,50,46,48,3,1,0,0,0)];
    let frameCount = 0, finished = false;
    return {
      addFrame(rgba, delayCs) {
        if (finished) throw new Error('GIF export has already finished.');
        if (rgba.length !== width*height*4) throw new Error('Frame size does not match the GIF.');
        const compressed = lzw(indexedPixels(rgba));
        parts.push(Uint8Array.of(0x21,0xf9,4,4),le16(Math.max(2,Math.round(delayCs))),Uint8Array.of(0,0),Uint8Array.of(0x2c),le16(0),le16(0),le16(width),le16(height),Uint8Array.of(0,8));
        for (let i = 0; i < compressed.length; i += 255) {
          const block = compressed.subarray(i,i+255);
          parts.push(Uint8Array.of(block.length),block);
        }
        parts.push(Uint8Array.of(0));
        frameCount++;
      },
      finish() {
        if (finished || !frameCount) throw new Error('No GIF frames are available.');
        finished = true; parts.push(Uint8Array.of(0x3b));
        const output = new Uint8Array(parts.reduce((sum,part)=>sum+part.length,0));
        let offset = 0;
        for (const part of parts) { output.set(part,offset); offset += part.length; }
        parts.length = 0;
        return output;
      }
    };
  }
  root.Tool3GifEncoder = { createEncoder };
})(typeof self !== 'undefined' ? self : globalThis);
