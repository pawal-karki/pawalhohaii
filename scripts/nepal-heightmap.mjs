// One-off: builds public/data/nepal-height.png, a grayscale heightmap of Nepal in the same
// 1240x780 (y offset 25) frame as public/data/nepal-districts.json, for the hero's 3D relief.
// Elevation: AWS Terrain Tiles (Mapzen terrarium, keyless, public domain sources).
// Run: node scripts/nepal-heightmap.mjs   (needs network; no dependencies)
import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync, deflateSync } from 'node:zlib';

const VIEW = { x: 0, y: 25, w: 1240, h: 780 };
const W = 256, H = 161;
const Z = 9;
const MAX_M = 8849; // Everest; 255 in the output
const districts = JSON.parse(readFileSync(new URL('../public/data/nepal-districts.json', import.meta.url)));

// ---- SVG path -> polylines (curves sampled; arcs as straight lines, fine for a mask) ----
function polylines(d) {
    const out = [];
    let line = [], x = 0, y = 0, sx = 0, sy = 0, cx = 0, cy = 0, prev = '';
    const toks = d.match(/[a-zA-Z]|-?(?:\d*\.\d+|\d+\.?)(?:e-?\d+)?/g);
    let i = 0, cmd = '';
    const n = () => +toks[i++];
    const cubic = (x1, y1, x2, y2, ex, ey) => {
        for (let t = 0.125; t <= 1; t += 0.125) {
            const u = 1 - t;
            line.push([u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * ex, u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * ey]);
        }
        cx = x2; cy = y2; x = ex; y = ey;
    };
    while (i < toks.length) {
        if (/[a-zA-Z]/.test(toks[i])) cmd = toks[i++];
        const rel = cmd === cmd.toLowerCase(), ox = rel ? x : 0, oy = rel ? y : 0;
        switch (cmd.toLowerCase()) {
            case 'm':
                if (line.length) out.push(line);
                x = ox + n(); y = oy + n(); sx = x; sy = y; line = [[x, y]];
                cmd = rel ? 'l' : 'L';
                break;
            case 'l': x = ox + n(); y = oy + n(); line.push([x, y]); break;
            case 'h': x = ox + n(); line.push([x, y]); break;
            case 'v': y = oy + n(); line.push([x, y]); break;
            case 'c': { const a = [n(), n(), n(), n(), n(), n()]; cubic(ox + a[0], oy + a[1], ox + a[2], oy + a[3], ox + a[4], oy + a[5]); break; }
            case 's': {
                const [x1, y1] = /[cs]/i.test(prev) ? [2 * x - cx, 2 * y - cy] : [x, y];
                const a = [n(), n(), n(), n()]; cubic(x1, y1, ox + a[0], oy + a[1], ox + a[2], oy + a[3]); break;
            }
            case 'q': { // quadratic as cubic
                const qx = ox + n(), qy = oy + n(), ex = ox + n(), ey = oy + n();
                cubic(x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y), ex + (2 / 3) * (qx - ex), ey + (2 / 3) * (qy - ey), ex, ey); break;
            }
            case 'a': i += 5; x = ox + n(); y = oy + n(); line.push([x, y]); break;
            case 'z': line.push([sx, sy]); x = sx; y = sy; out.push(line); line = []; break;
        }
        prev = cmd;
    }
    if (line.length) out.push(line);
    return out;
}

const shapes = districts.map((d) => ({ id: d.id, lines: polylines(d.d) }));
const bbox = (lines) => {
    const b = [Infinity, Infinity, -Infinity, -Infinity];
    for (const l of lines) for (const [x, y] of l) b[0] = Math.min(b[0], x), b[1] = Math.min(b[1], y), b[2] = Math.max(b[2], x), b[3] = Math.max(b[3], y);
    return b;
};
const all = bbox(shapes.flatMap((s) => s.lines));

// ---- lon/lat <-> SVG: least-squares affine fit of district centroids ----
// The sdoc.gov.np outlines aren't in plain lon/lat or Mercator (fitting the outer bounds alone put the
// Himalaya mid-country), so match each district's centroid to the same district in geoBoundaries
// (gbOpen NPL ADM2, CC BY 4.0) and fit x, y = affine(lon, mercator(lat)). Rotation and skew come out too.
const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * (180 / Math.PI);
const centroid = (rings) => {
    let a = 0, cx = 0, cy = 0;
    for (const r of rings) {
        let ra = 0, rx = 0, ry = 0;
        for (let k = 0; k + 1 < r.length; k++) {
            const [x1, y1] = r[k], [x2, y2] = r[k + 1], f = x1 * y2 - x2 * y1;
            ra += f; rx += (x1 + x2) * f; ry += (y1 + y2) * f;
        }
        if (Math.abs(ra) < 1e-12) continue;
        a += Math.abs(ra); cx += (rx / (3 * ra)) * Math.abs(ra); cy += (ry / (3 * ra)) * Math.abs(ra);
    }
    return [cx / a, cy / a];
};
const GEO = 'https://github.com/wmgeolab/geoBoundaries/raw/main/releaseData/gbOpen/NPL/ADM2/geoBoundaries-NPL-ADM2_simplified.geojson';
const ALIAS = { chitawan: 'chitwan', kabherepalanchok: 'kavrepalanchok', makawanpur: 'makwanpur', synagja: 'syangja', tanahu: 'tanahun', baijura: 'bajura', dadeidhura: 'dadeldhura', kapilbastu: 'kapilvastu', rukume: 'eastern-rukum', rukumw: 'western-rukum', nawalapur: 'nawalpur', nawalparasi: 'parasi' };
const geo = await (await fetch(GEO)).json();
const pairs = [];
for (const f of geo.features) {
    const key = f.properties.shapeName.toLowerCase().replace(/[^a-z]/g, '');
    const s = shapes.find((sh) => sh.id === (ALIAS[key] || key));
    if (!s || pairs.some((p) => p.id === s.id)) continue; // unmatched or duplicated names are skipped
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    const ll = centroid(polys.map((p) => p[0].map(([lon, lat]) => [lon, merc(lat)])));
    pairs.push({ id: s.id, ll, xy: centroid(s.lines) });
}
// Normal equations for x = a*lon + b*m + c (and the same for y).
const solve3 = (M, v) => {
    const det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
    const d = det(M);
    return [0, 1, 2].map((j) => det(M.map((row, i) => row.map((c, k) => (k === j ? v[i] : c)))) / d);
};
const fit = (axis) => {
    const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], v = [0, 0, 0];
    for (const { ll: [u, m], xy } of pairs) {
        const r = [u, m, 1];
        for (let i = 0; i < 3; i++) { v[i] += r[i] * xy[axis]; for (let k = 0; k < 3; k++) M[i][k] += r[i] * r[k]; }
    }
    return solve3(M, v);
};
const [AX, AY] = [fit(0), fit(1)];
const toSvg = (lon, lat) => [AX[0] * lon + AX[1] * merc(lat) + AX[2], AY[0] * lon + AY[1] * merc(lat) + AY[2]];
const toLonLat = (x, y) => {
    const det = AX[0] * AY[1] - AX[1] * AY[0];
    const dx = x - AX[2], dy = y - AY[2];
    const lon = (dx * AY[1] - AX[1] * dy) / det, m = (AX[0] * dy - dx * AY[0]) / det;
    return [lon, (2 * Math.atan(Math.exp((m * Math.PI) / 180)) - Math.PI / 2) * (180 / Math.PI)];
};
const res = pairs.map((p) => Math.hypot(...toSvg(p.ll[0], (2 * Math.atan(Math.exp((p.ll[1] * Math.PI) / 180)) - Math.PI / 2) * (180 / Math.PI)).map((v, i) => v - p.xy[i])));
console.log(`fit on ${pairs.length} districts: mean error ${(res.reduce((a, b) => a + b) / res.length).toFixed(1)} px, max ${Math.max(...res).toFixed(1)} px`);
console.log('outline bounds', all.map((v) => v.toFixed(1)).join(' '));
// Sanity check: known points should land inside (or right at) their districts.
for (const [id, lon, lat] of [['kathmandu', 85.32, 27.7], ['sunsari', 87.27, 26.66], ['solukhumbu', 86.92, 27.99], ['kaski', 83.99, 28.21], ['taplejung', 88.15, 27.7], ['darchula', 80.55, 29.85]]) {
    const b = bbox(shapes.find((s) => s.id === id).lines);
    const [x, y] = toSvg(lon, lat);
    console.log(id.padEnd(11), 'point', x.toFixed(0), y.toFixed(0), ' district box', b.map((v) => v.toFixed(0)).join(' '));
}

// ---- mask: even-odd scanline per district per output row (a pixel is in if any district holds it) ----
const mask = new Uint8Array(W * H);
for (let r = 0; r < H; r++) {
    const y = VIEW.y + ((r + 0.5) / H) * VIEW.h;
    for (const s of shapes) {
        const ex = [];
        for (const l of s.lines) for (let k = 1; k < l.length; k++) {
            const [x1, y1] = l[k - 1], [x2, y2] = l[k];
            if ((y1 <= y) !== (y2 <= y)) ex.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
        }
        ex.sort((a, b) => a - b);
        for (let k = 0; k + 1 < ex.length; k += 2) {
            const c0 = Math.ceil(((ex[k] - VIEW.x) / VIEW.w) * W - 0.5), c1 = Math.floor(((ex[k + 1] - VIEW.x) / VIEW.w) * W - 0.5);
            for (let c = Math.max(0, c0); c <= Math.min(W - 1, c1); c++) mask[r * W + c] = 1;
        }
    }
}

// Shared borders leave 1px cracks between districts: a 3x3 closing (dilate, then erode) seals them
// without growing the outer outline.
const morph = (src, keep) => src.map((_, i) => {
    const r = (i / W) | 0, c = i % W;
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) n += src[Math.min(H - 1, Math.max(0, r + dy)) * W + Math.min(W - 1, Math.max(0, c + dx))];
    return keep(n) ? 1 : 0;
});
mask.set(morph(morph(mask, (n) => n > 0), (n) => n === 9));

// ---- tiny PNG codec (8-bit RGB/RGBA/gray, non-interlaced: all terrarium tiles are RGB) ----
function decodePng(buf) {
    let p = 8, w, h, ct, idat = [];
    while (p < buf.length) {
        const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len);
        if (type === 'IHDR') (w = data.readUInt32BE(0)), (h = data.readUInt32BE(4)), (ct = data[9]);
        if (type === 'IDAT') idat.push(data);
        p += 12 + len;
    }
    const bpp = { 0: 1, 2: 3, 4: 2, 6: 4 }[ct], raw = inflateSync(Buffer.concat(idat)), stride = w * bpp;
    const px = Buffer.alloc(h * stride);
    for (let y = 0; y < h; y++) {
        const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
        for (let x = 0; x < stride; x++) {
            const a = x >= bpp ? px[y * stride + x - bpp] : 0, b = y ? px[(y - 1) * stride + x] : 0, c = x >= bpp && y ? px[(y - 1) * stride + x - bpp] : 0;
            const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
            px[y * stride + x] = (row[x] + [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f]) & 255;
        }
    }
    return { w, h, bpp, px };
}
function encodeGray(w, h, px) {
    const crcT = Array.from({ length: 256 }, (_, n) => { for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
    const crc = (b) => { let c = ~0; for (const v of b) c = crcT[(c ^ v) & 255] ^ (c >>> 8); return ~c >>> 0; };
    const chunk = (type, data) => {
        const t = Buffer.concat([Buffer.from(type), data]), out = Buffer.alloc(t.length + 8);
        out.writeUInt32BE(data.length, 0); t.copy(out, 4); out.writeUInt32BE(crc(t), t.length + 4); return out;
    };
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 0;
    // "Up" filter on every row: smooth terrain compresses much better than raw.
    const raw = Buffer.alloc(h * (w + 1));
    for (let y = 0; y < h; y++) {
        raw[y * (w + 1)] = 2;
        for (let x = 0; x < w; x++) raw[y * (w + 1) + 1 + x] = (px[y * w + x] - (y ? px[(y - 1) * w + x] : 0)) & 255;
    }
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---- elevation: terrarium tiles at zoom Z, sampled bilinearly per output pixel ----
const tileXY = (lon, lat) => [((lon + 180) / 360) * 2 ** Z, ((1 - merc(lat) / 180) / 2) * 2 ** Z];
const tiles = new Map();
async function tile(tx, ty) {
    const k = `${tx}/${ty}`;
    if (!tiles.has(k)) {
        const res = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${tx}/${ty}.png`);
        if (!res.ok) throw new Error(`tile ${k}: ${res.status}`);
        tiles.set(k, decodePng(Buffer.from(await res.arrayBuffer())));
    }
    return tiles.get(k);
}
async function elevation(lon, lat) {
    const [fx, fy] = tileXY(lon, lat).map((v) => v * 256 - 0.5);
    let sum = 0;
    for (const [dx, dy, wt] of [[0, 0, (1 - (fx % 1)) * (1 - (fy % 1))], [1, 0, (fx % 1) * (1 - (fy % 1))], [0, 1, (1 - (fx % 1)) * (fy % 1)], [1, 1, (fx % 1) * (fy % 1)]]) {
        const gx = Math.floor(fx) + dx, gy = Math.floor(fy) + dy;
        const t = await tile(Math.floor(gx / 256), Math.floor(gy / 256)), o = ((gy & 255) * 256 + (gx & 255)) * t.bpp;
        sum += wt * (t.px[o] * 256 + t.px[o + 1] + t.px[o + 2] / 256 - 32768);
    }
    return sum;
}

// Each output pixel takes the max of a 3x3 sub-sample, so narrow ridges (and Everest) survive the downscale.
const out = new Uint8Array(W * H);
let top = 0;
for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
        if (!mask[r * W + c]) continue;
        let m = 0;
        for (const sy of [0.17, 0.5, 0.83]) for (const sx of [0.17, 0.5, 0.83]) {
            const [lon, lat] = toLonLat(VIEW.x + ((c + sx) / W) * VIEW.w, VIEW.y + ((r + sy) / H) * VIEW.h);
            m = Math.max(m, await elevation(lon, lat));
        }
        top = Math.max(top, m);
        // sqrt keeps the Terai/hills readable next to 8000 m peaks; the client squares it back.
        out[r * W + c] = Math.max(1, Math.round(Math.sqrt(Math.max(0, m) / MAX_M) * 255));
    }
}
const png = encodeGray(W, H, out);
writeFileSync(new URL('../public/data/nepal-height.png', import.meta.url), png);
console.log(`highest sample ${top.toFixed(0)} m, ${tiles.size} tiles, wrote ${png.length} bytes`);
