// Clean a page image up before OCR, on this computer: even out uneven light
// (phone photos, shadows) and straighten a page that sits at a slight angle.
// Plain canvas code, no libraries.

// Divide each pixel by an estimate of the paper's brightness around it, so a
// shadowed corner becomes white paper again and the text stays dark.
export function evenLight(img) {
  const { data, width: w, height: h } = img;
  const s = 24;
  const bw = Math.ceil(w / s);
  const bh = Math.ceil(h / s);
  let bg = new Float32Array(bw * bh);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const v = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const b = ((y / s) | 0) * bw + ((x / s) | 0);
      if (v > bg[b]) bg[b] = v;
    }
  }
  // The paper is the brightest thing nearby: widen each block's max, then smooth.
  const pass = (src, f) => {
    const out = new Float32Array(src.length);
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        let acc = f === 'max' ? 0 : 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const yy = y + dy, xx = x + dx;
            if (yy < 0 || yy >= bh || xx < 0 || xx >= bw) continue;
            const v = src[yy * bw + xx];
            if (f === 'max') acc = Math.max(acc, v); else { acc += v; n++; }
          }
        }
        out[y * bw + x] = f === 'max' ? acc : acc / n;
      }
    }
    return out;
  };
  bg = pass(pass(bg, 'max'), 'max');
  bg = pass(pass(bg, 'avg'), 'avg');
  const at = (x, y) => {
    const fx = Math.min(bw - 1, Math.max(0, x / s - 0.5));
    const fy = Math.min(bh - 1, Math.max(0, y / s - 0.5));
    const x0 = fx | 0, y0 = fy | 0, x1 = Math.min(bw - 1, x0 + 1), y1 = Math.min(bh - 1, y0 + 1);
    const ax = fx - x0, ay = fy - y0;
    return (bg[y0 * bw + x0] * (1 - ax) + bg[y0 * bw + x1] * ax) * (1 - ay) + (bg[y1 * bw + x0] * (1 - ax) + bg[y1 * bw + x1] * ax) * ay;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const v = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const p = Math.max(1, at(x, y));
      const n = Math.max(0, Math.min(255, (v / p) * 255));
      data[i] = data[i + 1] = data[i + 2] = n;
    }
  }
  return img;
}

// Skew in degrees (−8…8): the angle at which the rows of dark pixels line up
// best, i.e. the row-count profile is the most peaked.
export function skewAngle(img) {
  const { data, width: w, height: h } = img;
  const step = Math.max(1, Math.round(w / 900));
  const pts = [];
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      if (data[(y * w + x) * 4] < 110) pts.push(x / step, y / step);
    }
  }
  if (pts.length < 200) return 0;
  const rows = Math.ceil((h + w) / step) + 2;
  const score = (deg) => {
    const t = (deg * Math.PI) / 180;
    const sn = Math.sin(t), cs = Math.cos(t);
    const prof = new Float64Array(rows * 2);
    for (let k = 0; k < pts.length; k += 2) prof[(pts[k + 1] * cs - pts[k] * sn + rows) | 0]++;
    let sum = 0;
    for (let r = 1; r < prof.length; r++) { const d = prof[r] - prof[r - 1]; sum += d * d; }
    return sum;
  };
  let best = 0, bestScore = -1;
  for (let a = -8; a <= 8.001; a += 0.5) { const sc = score(a); if (sc > bestScore) { bestScore = sc; best = a; } }
  const coarse = best;
  for (let a = coarse - 0.5; a <= coarse + 0.5001; a += 0.1) { const sc = score(a); if (sc > bestScore) { bestScore = sc; best = a; } }
  return Math.abs(best) < 0.15 ? 0 : best;
}

// canvas → a new, cleaned canvas (the same object type it was given).
export function prepareForOcr(canvas) {
  const g = canvas.getContext('2d', { willReadFrequently: true });
  const img = evenLight(g.getImageData(0, 0, canvas.width, canvas.height));
  g.putImageData(img, 0, 0);
  const deg = skewAngle(img);
  if (!deg) return canvas;
  const out = typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas
    ? new OffscreenCanvas(canvas.width, canvas.height)
    : Object.assign(document.createElement('canvas'), { width: canvas.width, height: canvas.height });
  const o = out.getContext('2d');
  o.fillStyle = '#fff';
  o.fillRect(0, 0, out.width, out.height);
  o.translate(out.width / 2, out.height / 2);
  o.rotate((-deg * Math.PI) / 180);
  o.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  return out;
}
