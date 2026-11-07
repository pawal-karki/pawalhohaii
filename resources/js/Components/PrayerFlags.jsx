import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { BufferAttribute, BufferGeometry, CanvasTexture, DoubleSide, Mesh, ShaderMaterial, Vector3 } from 'three';
import { asset } from '../asset';

// Lungta order: blue (sky), white (air), red (fire), green (water), yellow (earth), in sRGB.
const LUNGTA = [
    [0.14, 0.3, 0.74],
    [0.97, 0.96, 0.93],
    [0.86, 0.17, 0.13],
    [0.12, 0.55, 0.27],
    [0.98, 0.83, 0.15],
];
// Which print atlas cell each colour carries: the wind horse (0) or the seated deity (1).
const FIGURE = [0, 1, 1, 1, 0];

// Strings in the skyline box's units (x -0.5..0.5 across, y -0.5..0.5 up), tied to landmarks in the
// skyline image as they are in real life: Boudhanath's spire (0.093, 0.14) out to the Dharahara tower
// and the bridge pylon, plus one from the pylon off the right edge. Both theme images share this layout.
const SPIRE = [0.093, 0.14];
const STRINGS = [
    { from: SPIRE, to: [-0.428, 0.2], sag: 0.07, count: 34 },
    { from: SPIRE, to: [0.412, 0.04], sag: 0.05, count: 22 },
    { from: [0.412, 0.04], to: [0.56, -0.02], sag: 0.025, count: 8 },
    // A darchor on the open ground among the trees left of the Dharahara, strung to the ground like at a pass.
    ...darchor(-0.469, -0.163, 0.167, [
        [-0.56, -0.02, 10],
        [-0.4, -0.16, 9],
    ]),
];
const PHONE_STRINGS = STRINGS.slice(0, 2).map((s) => ({ ...s, count: Math.round(s.count * 0.6) }));
// Farther strings, drawn smaller and hazier behind the main ones: the white memorial column's statue
// to the tall pagoda's finial, and the ornate temple's spire down to the bridge pylon's lower deck.
const BACK_STRINGS = [
    { from: [-0.226, 0.17], to: [-0.033, 0.124], sag: 0.02, count: 22 },
    { from: [0.311, 0.033], to: [0.412, -0.035], sag: 0.015, count: 12 },
    // A smaller, farther darchor in the gap between the memorial column and the pagoda courtyard, low enough
    // that the main string passes above its top.
    ...darchor(-0.189, -0.156, 0.035),
];

// A darchor: a tall pole at x from the ground up to top (box units), a long banner sewn down it in the five
// colours stacked as the elements are, sky at the top to earth at the foot (blue, white, red, green, yellow), and strings of small lungta from just under its top down to each guy's [x, y, count].
// The pole goes in as a straight string (it never sags or sways) so the cord and flag code carry it.
function darchor(x, ground, top, guys = []) {
    const tie = top - (top - ground) * 0.07;
    return [
        { pole: true, from: [x, top], to: [x, ground] },
        ...guys.map(([gx, gy, count]) => ({ from: [x, tie], to: [gx, gy], sag: 0.012, count })),
    ];
}
// The pole's top, as [distance down, half-width, part] in units of its half-width at the top: a brass
// finial knob over a small umbrella, a wooden neck, then the juniper bundle tied below. Repeated
// distances start a new part with a hard edge. Parts: 1 wood, 2 juniper, 3 brass.
const POLE_TOP = [
    [0, 0.3, 3], [0.7, 1.1, 3], [1.3, 0.6, 3], [1.7, 0.9, 3], [3.1, 3.3, 3], [3.3, 0.9, 3],
    [3.3, 0.9, 1], [4.3, 0.9, 1],
    [4.3, 1.5, 2], [5.5, 3.3, 2], [7.5, 3, 2], [9.5, 1.6, 2],
    [9.5, 0.9, 1],
];
const POLE_UNIT = 0.006; // the top half-width, of the pole's length; the foot is 1.6x as thick
// The banner: a long strip of cloth from under the juniper down nearly to the foot of the pole, BC x BR particles.
const BANNER = { t0: 0.07, t1: 0.86, width: 0.12 };
const BC = 16;
const BR = 5;

// Cloth: each flag is a C x R grid of particles (verlet), its top row sewn to the cord. Speeds and
// forces are in flag widths (w) so the small far flags behave like the near ones, just farther away.
const C = 6;
const R = 8;
const N = C * R;
const STEP = 1 / 60;
const ITERATIONS = 2;
const GRAVITY = 39; // w/s²: a 25 cm flag under 9.8 m/s²
const BREEZE = 5; // w/s, steady
const GUST = 26; // w/s on top at a gust's peak
const TURB = 6; // w/s of per-flag buffeting
const PRESSURE = 9; // 1/s: wind pushing on the cloth's face (what makes it lift and flap)
const DRAG = 0.8; // 1/s: wind dragging along the cloth
const DAMP = 0.992;
const WIND = new Vector3(0.62, 0.12, -0.78).normalize(); // east, and away from us
const SAMPLES = 8; // cord points per flag spacing (a knot sits on every 8th)
const POINTER_RADIUS = 1.4; // world units (~200px on a laptop)

const flagVertex = /* glsl */ `
    attribute vec3 aColor;
    attribute float aFade;
    attribute float aFigure;
    attribute float aSeed;
    attribute float aCurv;
    varying vec3 vColor;
    varying vec3 vNormal;
    varying vec2 vUv;
    varying float vFade;
    varying float vFigure;
    varying float vSeed;
    varying float vCurv;
    void main() {
        vColor = aColor;
        vNormal = normal; // world space: the layers are only ever translated
        vUv = uv;
        vFade = aFade;
        vFigure = aFigure;
        vSeed = aSeed;
        vCurv = aCurv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;
const flagFragment = /* glsl */ `
    uniform sampler2D uPrint;
    uniform vec3 uSun;
    uniform vec3 uSunColor;
    uniform vec3 uSkyLight;
    uniform vec3 uGroundLight;
    uniform vec3 uRim;
    uniform vec3 uHazeColor;
    uniform float uTrans;
    uniform float uHaze;
    uniform float uOpacity;
    varying vec3 vColor;
    varying vec3 vNormal;
    varying vec2 vUv;
    varying float vFade;
    varying float vFigure;
    varying float vSeed;
    varying float vCurv;
    float hash(float n) { return fract(sin(n) * 43758.5453); }
    float hash2(vec2 p) { return hash(dot(p, vec2(12.9898, 78.233))); }
    void main() {
        vec2 uv = vUv;
        float free = 1.0 - uv.y; // 0 at the cord, 1 at the free edge
        // Sun-bleached dye, palest at the free edge that flaps in the sun longest.
        float fade = clamp(vFade * mix(0.7, 1.4, free), 0.0, 0.85);
        // A darchor banner is five bands down the pole (uv.x runs from the top): blue sky, white air, red fire,
        // green water, yellow earth, the same dyes as LUNGTA, with a dark seam where each band is sewn on.
        vec3 base = vColor;
        if (vFigure > 1.5) {
            float b = uv.x * 5.0;
            base = b < 1.0 ? vec3(0.14, 0.3, 0.74) : b < 2.0 ? vec3(0.97, 0.96, 0.93) : b < 3.0 ? vec3(0.86, 0.17, 0.13) : b < 4.0 ? vec3(0.12, 0.55, 0.27) : vec3(0.98, 0.83, 0.15);
            float seam = min(fract(b), 1.0 - fract(b)) / 5.0;
            if (b > 0.5 && b < 4.5) base *= mix(0.7, 1.0, smoothstep(0.002, 0.006, seam));
        }
        vec3 dye = mix(base, vec3(0.92, 0.9, 0.84), fade);
        // White hem the cord runs through, with the dye wicked a little way up into it.
        float wick = smoothstep(0.945, 0.985, uv.y + 0.02 * hash2(floor(uv * vec2(70.0, 1.0)) + vSeed) - 0.01);
        vec3 cloth = mix(dye, mix(vec3(0.95, 0.94, 0.9), dye, 0.15), wick);
        // The woodblock print in faded ink.
        // A darchor banner (figure 2) has no figure, only rows of mantra across it all the way down: the
        // top text rows of the wind-horse cell, tiled along the pole (uv.x runs down it, uv.y out from it).
        vec2 at = vFigure > 1.5 ? vec2(0.03 + 0.43 * (1.0 - uv.y), 0.8 + 0.17 * fract(uv.x * 9.0)) : vec2((uv.x + vFigure) * 0.5, uv.y);
        float ink = 1.0 - texture2D(uPrint, at).r;
        cloth *= 1.0 - ink * (0.7 - fade * 0.5);

        // Light from the simulated cloth: the face we see, its folds, and the sun on either side of it.
        vec3 n = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
        float curv = gl_FrontFacing ? vCurv : -vCurv;
        // Creases and the cloth bunched under the cord sit in their own shadow.
        float ao = clamp(1.0 - max(curv, 0.0) * 5.0, 0.55, 1.0) * mix(0.82, 1.0, smoothstep(0.0, 0.15, free));
        float ndl = dot(n, uSun);
        vec3 ambient = mix(uGroundLight, uSkyLight, n.y * 0.5 + 0.5);
        vec3 col = cloth * (ambient + uSunColor * max(0.0, ndl * 0.7 + 0.3)) * ao;
        // Thin cotton: light behind it comes through, deepened by the dye.
        col += cloth * cloth * uSunColor * uTrans * pow(max(0.0, -ndl), 1.5);
        // Sky catching the cloth where it turns edge-on to us.
        col += uRim * pow(1.0 - abs(n.z), 3.0);
        gl_FragColor = vec4(mix(col, uHazeColor, uHaze), uOpacity);
    }
`;

const cordVertex = /* glsl */ `
    attribute float aAlong;
    attribute float aSide;
    attribute float aKnot;
    attribute float aPart;
    varying float vAlong;
    varying float vSide;
    varying float vKnot;
    varying float vPart;
    void main() {
        vAlong = aAlong;
        vSide = aSide;
        vKnot = aKnot;
        vPart = aPart;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;
const cordFragment = /* glsl */ `
    uniform vec3 uColor;
    uniform vec3 uPole;
    uniform vec3 uHazeColor;
    uniform float uHaze;
    uniform float uOpacity;
    varying float vAlong;
    varying float vSide;
    varying float vKnot;
    varying float vPart;
    float hash(float n) { return fract(sin(n) * 43758.5453); }
    void main() {
        float tube = 1.0 - vSide * vSide * 0.45;
        // Fuzzy, frayed edge: loose fibres of uneven length (or juniper twigs).
        float fibre = hash(floor(vAlong * 3.0) + 0.5);
        float a = 1.0 - smoothstep(0.45 + 0.5 * fibre, 1.0, abs(vSide));
        vec3 col;
        if (vPart < 0.5) {
            // Cord: twisted strands, diagonal stripes, darker where tied in a knot.
            float strand = 0.75 + 0.25 * sin((vAlong + vSide * 0.6) * 6.2832);
            col = uColor * strand * (1.0 - vKnot * 0.25);
            a *= uOpacity;
        } else {
            // Darchor pole: smooth wood, a brass top, the juniper bundle (keeps the fuzzy edge), all solid.
            col = vPart < 1.5 ? uPole : vPart < 2.5 ? uPole * vec3(0.55, 0.95, 0.5) : uPole * vec3(2.3, 1.8, 0.75);
            if (vPart < 1.5 || vPart > 2.5) a = 1.0 - smoothstep(0.75, 1.0, abs(vSide));
        }
        gl_FragColor = vec4(mix(col * tube, uHazeColor, uHaze), a);
    }
`;

// Per theme. Light: the sun is behind the flags (high, to the east, as on Everest in the image), so the
// cotton glows through, with a pale sky rim. Dark: no sun, the gold-lit city below warms the undersides
// and a cool, dim night sits above; dim overall so they stay inside the night scene.
const THEMES = {
    light: {
        sun: new Vector3(0.4, 0.55, -0.73).normalize(),
        sunColor: [0.62, 0.59, 0.53],
        skyLight: [0.86, 0.89, 0.96],
        groundLight: [0.76, 0.73, 0.68],
        trans: 1.2,
        rim: [0.16, 0.19, 0.24],
        haze: [0.84, 0.87, 0.92],
        cord: [0.37, 0.34, 0.31],
        cordOpacity: 0.8,
        pole: [0.3, 0.23, 0.17], // weathered wood against the bright sky
    },
    dark: {
        sun: new Vector3(0.1, -0.8, 0.6).normalize(),
        sunColor: [0.36, 0.24, 0.11],
        skyLight: [0.11, 0.12, 0.18],
        groundLight: [0.3, 0.22, 0.12],
        trans: 0.4,
        rim: [0.03, 0.04, 0.07],
        haze: [0.05, 0.07, 0.13],
        cord: [0.48, 0.4, 0.28],
        cordOpacity: 0.75,
        pole: [0.34, 0.25, 0.15], // warmed by the city's light
    },
};

// What lungta carry, from Mipham Rinpoche's Daily Lungta Recitation: the lungta mantra, Om mani padme hum,
// the call to the four animals (tiger, snow lion, garuda, dragon) and Avalokiteshvara as the windhorse's jewel.
const MANTRAS = '༄༅། ཨོཾ་སརྦ་གྲ་ཧ་ནཱཀྵ་ཏྲ་དྷྱ་མི་ཀ་ར་ཎི་སྭཱ་ཧཱ། ཨོཾ་མ་ཎི་པདྨེ་ཧཱུྂ། ཨོཾ་ཨཱཿཧཱུྂ་ཧོ་ཧེ་སྟག་སེང་ཁྱུང་འབྲུག་འདིར་ཡར་བསྐྱེད། ཨོཾ་པདྨ་ཙིནྟ་མ་ཎི་ཛྭ་ལ་ཧཱུྂ།';
// Each syllable keeps its tsheg (or shad, at the end of a mantra) so rows can break between syllables.
const SYLLABLES = MANTRAS.match(/[^་།\s]+(་|།\s*|\s+)?/g);
const TIBETAN_FONT = '"Kailasa", "Microsoft Himalaya", "Noto Sans Tibetan", "Noto Serif Tibetan", "Jomolhari", serif';

// The woodblock prints, drawn once into a two-cell atlas (each cell 4:5, like a real flag): a sewn hem
// the cord runs through, a double border, rows of mantra script and the central figure. Cell 0 carries the
// wind horse (lungta) with the wish-fulfilling jewel on its saddle; cell 1 a seated deity in a halo on a lotus.
// Ink is dark on white; the shader tints it.
function printTexture() {
    const c = Object.assign(document.createElement('canvas'), { width: 512, height: 320 });
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, 512, 320);
    // Tibetan only if some installed font has the glyphs; missing glyphs all measure alike.
    g.font = `10px ${TIBETAN_FONT}`;
    const tibetan = g.measureText('ཀཁགང').width !== g.measureText('\uE000\uE001\uE002\uE003').width;
    for (const cell of [0, 1]) {
        g.save();
        g.translate(cell * 256, 0);
        g.strokeStyle = g.fillStyle = '#000';
        // Hem folded over the cord, with its stitch line.
        g.fillStyle = '#d6d6d6';
        g.fillRect(0, 0, 256, 16);
        g.fillStyle = '#000';
        g.setLineDash([4, 3]);
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(4, 17);
        g.lineTo(252, 17);
        g.stroke();
        g.setLineDash([]);
        // Double border.
        g.lineWidth = 3;
        g.strokeRect(12, 26, 232, 282);
        g.lineWidth = 1;
        g.strokeRect(17, 31, 222, 272);
        // Mantra rows, as carved on the woodblock, syllable by syllable. Rows run full width above and below
        // the figure and as two side columns beside it.
        g.font = `10px ${TIBETAN_FONT}`;
        g.textBaseline = 'middle';
        g.lineWidth = 1.3;
        let n = cell * 17;
        for (let y = 44; y < 300; y += 14) {
            for (const [x0, x1] of y > 94 && y < 238 ? [[24, 66], [190, 232]] : [[24, 232]]) {
                for (let x = x0; ; ) {
                    const syllable = SYLLABLES[n % SYLLABLES.length];
                    const w = tibetan ? g.measureText(syllable).width : 6 + Math.random() * 14;
                    if (x + w > x1) break;
                    n++;
                    if (tibetan) g.fillText(syllable, x, y);
                    else {
                        // No Tibetan font: a headline with strokes hanging from it stands in for each syllable.
                        g.beginPath();
                        g.moveTo(x, y - 3);
                        g.lineTo(x + w, y - 3);
                        for (let lx = x + 2; lx < x + w; lx += 3 + Math.random() * 2) {
                            g.moveTo(lx, y - 3);
                            g.lineTo(lx + (Math.random() - 0.5) * 2, y + 1 + Math.random() * 4);
                        }
                        g.stroke();
                        g.fillRect(x + w + 2, y - 3, 1.6, 1.6);
                    }
                    x += w + (tibetan ? 0 : 6);
                }
            }
        }
        g.lineWidth = 2.5;
        g.lineJoin = g.lineCap = 'round';
        if (cell === 0) {
            // Wind horse galloping right: one foreleg raised, tail streaming behind.
            g.beginPath();
            g.ellipse(132, 168, 34, 15, -0.08, 0, Math.PI * 2);
            g.fill();
            g.fill(new Path2D('M148 162L158 146L174 116L188 124L174 170Z'));
            g.fill(new Path2D('M172 116L177 104L182 113L200 125L198 133L186 134Z'));
            g.lineWidth = 6;
            g.beginPath();
            for (const leg of [[106, 176, 96, 196, 88, 214], [118, 180, 120, 200, 112, 218], [160, 176, 178, 186, 172, 202], [150, 180, 160, 200, 168, 216]]) {
                g.moveTo(leg[0], leg[1]);
                g.lineTo(leg[2], leg[3]);
                g.lineTo(leg[4], leg[5]);
            }
            g.moveTo(100, 162);
            g.quadraticCurveTo(78, 150, 72, 178);
            g.stroke();
            // Mane along the neck.
            g.lineWidth = 2;
            g.beginPath();
            for (let i = 0; i < 6; i++) {
                g.moveTo(174 - i * 3, 120 + i * 6);
                g.lineTo(164 - i * 3, 118 + i * 6);
            }
            g.stroke();
            // Saddle cloth, and the wish-fulfilling jewel in flames on the saddle.
            g.fillStyle = '#fff';
            g.fillRect(120, 152, 26, 12);
            g.fillStyle = '#000';
            g.strokeRect(120, 152, 26, 12);
            g.fill(new Path2D('M133 152C123 148 123 136 128 130C129 136 131 136 133 120C136 134 139 134 139 128C144 138 142 148 133 152Z'));
        } else {
            // Seated deity: aureole and halo, head with topknot, robed body, crossed legs, lotus seat.
            g.beginPath();
            g.arc(128, 168, 62, Math.PI, 0);
            g.moveTo(152, 124);
            g.arc(128, 124, 24, 0, Math.PI * 2);
            g.stroke();
            g.beginPath();
            g.arc(128, 124, 12, 0, Math.PI * 2);
            g.arc(128, 108, 5, 0, Math.PI * 2);
            g.fill();
            g.fill(new Path2D('M116 138L140 138C152 142 156 160 152 180L164 196C150 206 106 206 92 196L104 180C100 160 104 142 116 138Z'));
            g.strokeStyle = '#fff';
            g.beginPath();
            g.moveTo(108, 190);
            g.quadraticCurveTo(128, 182, 148, 190);
            g.moveTo(128, 146);
            g.lineTo(128, 172);
            g.stroke();
            g.strokeStyle = '#000';
            g.beginPath();
            for (let i = 0; i < 7; i++) {
                const x = 84 + i * 14.7;
                g.moveTo(x - 7, 214);
                g.quadraticCurveTo(x, 196, x + 7, 214);
            }
            g.moveTo(80, 216);
            g.lineTo(176, 216);
            g.stroke();
        }
        g.restore();
    }
    const tex = new CanvasTexture(c);
    tex.anisotropy = 8;
    return tex;
}

// Gust strength 0..1 at x: fronts that roll east along the strings, so neighbours lift one after another,
// with lulls in between where the flags go slack.
function gustAt(x, t) {
    const a = 0.5 + 0.5 * Math.sin(t * 0.9 - x * 0.45 + Math.sin(t * 0.21) * 2);
    const b = 0.5 + 0.5 * Math.sin(t * 1.7 - x * 0.9 + 1.3);
    return a * a * a * (0.55 + 0.45 * b);
}

// A point on string s at t (0..1): the hung parabola (indistinguishable from a catenary at this sag),
// plus how far the wind has pushed and lifted it, and a small ripple running along it.
function cordAt(s, t, time, out, o) {
    const b = Math.sin(Math.PI * t);
    out[o] = s.x0 + (s.x1 - s.x0) * t;
    out[o + 1] = s.y0 + (s.y1 - s.y0) * t - s.sag * 4 * t * (1 - t) + b * (s.oy + s.ripple * Math.sin(t * 11 - time * 2.6));
    out[o + 2] = b * s.oz;
}

// Lays out every string, flag and particle once. All particles live in shared typed arrays; each layer
// (back, front) renders a slice of them.
function buildWorld(layerDefs, W, H, px) {
    const strings = [];
    const flags = [];
    const layers = [];
    let P = 0;
    let Q = 0;
    layerDefs.forEach((defs, back) => {
        const layer = { p0: P, q0: Q, flags: [], strings: [] };
        for (const d of defs) {
            const s = { x0: d.from[0] * W, y0: d.from[1] * H, x1: d.to[0] * W, y1: d.to[1] * H, sag: (d.sag ?? 0) * H, count: d.count };
            Object.assign(s, { oy: 0, oz: 0, vy: 0, vz: 0, ripple: 0, xm: (s.x0 + s.x1) / 2, half: (back ? 0.75 : 1.2) * px, q: Q, m: d.count * SAMPLES + 1 });
            s.len = Math.hypot(s.x1 - s.x0, s.y1 - s.y0);
            if (d.pole) {
                // A darchor pole: its samples follow the top's profile, then taper straight down to the foot.
                const u = Math.max(POLE_UNIT * s.len, 0.6 * px);
                const profile = [...POLE_TOP, [s.len / u, 1.6, 1]];
                Object.assign(s, { pole: true, m: profile.length, along: profile.map((p) => p[0]), ts: profile.map((p) => (p[0] * u) / s.len), widths: profile.map((p) => p[1] * u), parts: profile.map((p) => p[2]) });
            }
            Q += s.m;
            strings.push(s);
            layer.strings.push(s);
            if (d.pole) {
                const f = {
                    s, o: P, t0: BANNER.t0, t1: BANNER.t1, x: s.x0,
                    w: BANNER.width * s.len, cols: BC, rows: BR, banner: true,
                    seed: Math.random() * 100, color: LUNGTA[0], figure: 2, // the shader colours its bands
                    fade: Math.random() ** 1.6 * 0.4,
                };
                P += BC * BR;
                flags.push(f);
                layer.flags.push(f);
                continue;
            }
            // One or two flags lost to the wind, and now and then one blown up and wrapped around the cord.
            const pick = () => (d.count > 6 && Math.random() < 0.7 ? 2 + Math.floor(Math.random() * (d.count - 4)) : -1);
            const gaps = [pick(), d.count > 16 ? pick() : -1];
            const wrapped = pick();
            for (let i = 0; i < d.count; i++) {
                if (gaps.includes(i)) continue;
                const half = (0.43 * (0.92 + Math.random() * 0.12)) / d.count;
                const t = (i + 0.5) / d.count;
                // Blue to yellow reading left to right, whichever end the string starts from.
                const k = (s.x1 < s.x0 ? d.count - 1 - i : i) % 5;
                // Flags whose cord tilts up toward the sun bleach faster.
                const slope = Math.atan2(s.y1 - s.y0 - s.sag * 4 * (1 - 2 * t), s.x1 - s.x0);
                const toSun = Math.max(0, -Math.sin(slope) * 0.6 + Math.cos(slope) * 0.8 - 0.75);
                const f = {
                    s,
                    o: P,
                    t0: t - half,
                    t1: t + half,
                    x: s.x0 + (s.x1 - s.x0) * t,
                    w: 2 * half * s.len,
                    cols: C,
                    rows: R,
                    wrap: i === wrapped && !gaps.includes(i),
                    seed: Math.random() * 100,
                    color: LUNGTA[k],
                    figure: FIGURE[k],
                    // Some flags are new, most are a season or two in the sun.
                    fade: Math.random() ** 1.6 * 0.4 + toSun * 2,
                };
                P += N;
                flags.push(f);
                layer.flags.push(f);
            }
        }
        Object.assign(layer, { p1: P, q1: Q });
        layers.push(layer);
    });

    const world = {
        strings, flags, layers, time: 0,
        pos: new Float32Array(P * 3),
        prev: new Float32Array(P * 3),
        nrm: new Float32Array(P * 3),
        curv: new Float32Array(P),
        inv: new Float32Array(P),
        cord: new Float32Array(Q * 6), // two ribbon vertices per cord sample
        scratch: new Float32Array(Math.max(...strings.map((s) => s.m)) * 3),
    };

    // Hang each flag down from its cord (or a banner out from its pole), and tie its particles together at those rest lengths:
    // structural and shear constraints keep the cloth from stretching, weaker bend ones from crumpling.
    // Each constraint is stored ready for the solver: both offsets into pos, rest length², and how much
    // of the correction each end takes (0 for a pinned end, so the free one takes it all).
    const ends = [];
    const cons = [];
    const { pos, prev, inv } = world;
    const link = (a, b, k) => {
        const w = inv[a] + inv[b];
        if (!w) return;
        const r2 = (pos[a * 3] - pos[b * 3]) ** 2 + (pos[a * 3 + 1] - pos[b * 3 + 1]) ** 2 + (pos[a * 3 + 2] - pos[b * 3 + 2]) ** 2;
        ends.push(a * 3, b * 3);
        cons.push(r2, (2 * k * inv[a]) / w, (2 * k * inv[b]) / w);
    };
    for (const f of flags) {
        const { s, cols, rows } = f;
        // A flag hangs square to its cord, so one on a steep guy string is a rectangle, not a sheared
        // sliver; a banner starts out flat downwind of its pole.
        let hx = 1;
        let hy = 0;
        if (!f.banner) {
            const tx = s.x1 - s.x0;
            const ty = s.y1 - s.y0 - s.sag * 4 * (1 - f.t0 - f.t1);
            const l = Math.hypot(tx, ty);
            [hx, hy] = tx > 0 ? [ty / l, -tx / l] : [-ty / l, tx / l];
        }
        const dy = (f.banner ? f.w : f.w * 1.25) / (rows - 1);
        for (let c = 0; c < cols; c++) {
            const i = f.o + c;
            cordAt(s, f.t0 + ((f.t1 - f.t0) * c) / (cols - 1), 0, pos, i * 3);
            for (let r = 1; r < rows; r++) {
                const j = (i + r * cols) * 3;
                pos[j] = pos[i * 3] + r * dy * hx;
                pos[j + 1] = pos[i * 3 + 1] + r * dy * hy;
                pos[j + 2] = (Math.random() - 0.5) * 0.002;
            }
            for (let r = 0; r < rows; r++) inv[i + r * cols] = r && !f.wrap ? 1 : 0;
        }
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const i = f.o + r * cols + c;
                if (c < cols - 1) link(i, i + 1, 1);
                if (r < rows - 1) link(i, i + cols, 1);
                if (c < cols - 1 && r < rows - 1) {
                    link(i, i + cols + 1, 1);
                    link(i + 1, i + cols, 1);
                }
                if (c < cols - 2) link(i, i + 2, 0.3);
                if (r < rows - 2) link(i, i + 2 * cols, 0.3);
            }
        }
    }
    prev.set(pos);
    world.ends = Int32Array.from(ends);
    world.cons = Float32Array.from(cons);
    return world;
}

// One fixed step of the whole sim. `input` carries the pointer and scroll gusts; `still` holds a steady breeze.
function step(world, input, still) {
    const { pos, prev, nrm, ends, cons } = world;
    const t = (world.time += STEP);
    const dt2 = STEP * STEP;
    const extra = still ? 0 : input.gust;

    // The cord is a damped spring: pushed back and lifted a touch in a gust, sagging again in the lulls.
    for (const s of world.strings) {
        const g = still ? 0.15 : gustAt(s.xm, t) + extra;
        s.vy += ((s.sag * 0.2 * g - s.oy) * 5 - s.vy * 2) * STEP;
        s.vz += ((-s.sag * 0.6 * g - s.oz) * 5 - s.vz * 2) * STEP;
        s.oy += s.vy * STEP;
        s.oz += s.vz * STEP;
        s.ripple = still ? 0 : s.sag * 0.02 * (0.3 + g);
    }

    for (const f of world.flags) {
        const { s, o, w, cols } = f;
        if (f.wrap) {
            wrapPose(f, t, pos);
            continue;
        }
        // Top row sewn to the cord (a banner's side, to its pole).
        for (let c = 0; c < cols; c++) cordAt(s, f.t0 + ((f.t1 - f.t0) * c) / (cols - 1), t, pos, (o + c) * 3);

        // Wind at this flag: breeze + the passing gust + its own buffeting + any pointer or scroll gust.
        const g = still ? 0.15 : gustAt(f.x, t) + extra;
        const speed = (BREEZE + GUST * g) * w;
        let wx = WIND.x * speed;
        let wy = WIND.y * speed;
        let wz = WIND.z * speed;
        if (!still) {
            const k = f.seed;
            const tu = TURB * w * (0.4 + g);
            wx += tu * Math.sin(t * 1.9 + k) * Math.sin(t * 0.7 + k * 2.1);
            wy += tu * 0.6 * Math.sin(t * 2.3 + k * 1.3);
            wz += tu * Math.sin(t * 1.4 + k * 0.7);
            if (input.puff > 0.01) {
                const dx = f.x - input.x;
                const dy = pos[o * 3 + 1] - input.y;
                // Blows the way the pointer moved, and lifts the flags back off the cord like a real gust.
                const near = 1.5 * input.puff * Math.exp(-(dx * dx + dy * dy) / (POINTER_RADIUS * POINTER_RADIUS));
                wx += input.vx * near;
                wy += (input.vy + input.speed * 0.3) * near;
                wz -= input.speed * near * 0.6;
            }
        }

        // Verlet: velocity is the last step's move. The wind pushes on the cloth's face (along last frame's
        // normal) and drags along it, so a flag edge-on to the wind catches it, flips and flaps.
        for (let i = o + cols, end = o + cols * f.rows; i < end; i++) {
            const i3 = i * 3;
            const x = pos[i3];
            const y = pos[i3 + 1];
            const z = pos[i3 + 2];
            const vx = (x - prev[i3]) * DAMP;
            const vy = (y - prev[i3 + 1]) * DAMP;
            const vz = (z - prev[i3 + 2]) * DAMP;
            // Each particle flutters a little out of phase, so the cloth ripples instead of swinging as a board.
            const flutter = still ? 1 : 1 + 0.4 * Math.sin(t * 9 + (i - o) * 0.7 + f.seed);
            const rx = wx * flutter - vx / STEP;
            const ry = wy * flutter - vy / STEP;
            const rz = wz * flutter - vz / STEP;
            const nx = nrm[i3];
            const ny = nrm[i3 + 1];
            const nz = nrm[i3 + 2];
            const push = (nx * rx + ny * ry + nz * rz) * PRESSURE;
            prev[i3] = x;
            prev[i3 + 1] = y;
            prev[i3 + 2] = z;
            pos[i3] = x + vx + (push * nx + DRAG * rx) * dt2;
            pos[i3 + 1] = y + vy + (push * ny + DRAG * ry - GRAVITY * w) * dt2;
            pos[i3 + 2] = z + vz + (push * nz + DRAG * rz) * dt2;
        }
    }

    // Satisfy the distance constraints. Jakobsen's sqrt-free approximation, r²/(d²+r²) - ½ ≈ (r-d)/2r,
    // is plenty accurate for the small corrections each step makes.
    for (let it = 0; it < ITERATIONS; it++) {
        for (let j = 0, e = 0; j < cons.length; j += 3, e += 2) {
            const a = ends[e];
            const b = ends[e + 1];
            const r2 = cons[j];
            const dx = pos[b] - pos[a];
            const dy = pos[b + 1] - pos[a + 1];
            const dz = pos[b + 2] - pos[a + 2];
            const k = r2 / (dx * dx + dy * dy + dz * dz + r2) - 0.5;
            const ka = k * cons[j + 1];
            const kb = k * cons[j + 2];
            pos[a] -= dx * ka;
            pos[a + 1] -= dy * ka;
            pos[a + 2] -= dz * ka;
            pos[b] += dx * kb;
            pos[b + 1] += dy * kb;
            pos[b + 2] += dz * kb;
        }
    }
}

// A flag the wind has wrapped around its cord: the strip spirals tightly round it, short and twisted.
function wrapPose(f, t, pos) {
    const tw = f.t1 - f.t0;
    const rad = Math.max(f.s.half * 2.5, f.w * 0.12);
    for (let r = 0; r < R; r++) {
        const a = (r / (R - 1)) * Math.PI * 2.6 + 0.4;
        for (let c = 0; c < C; c++) {
            const i3 = (f.o + r * C + c) * 3;
            cordAt(f.s, f.t0 + tw * (0.15 + 0.5 * (c / (C - 1)) + 0.35 * (r / (R - 1))), t, pos, i3);
            pos[i3 + 1] += Math.cos(a) * rad;
            pos[i3 + 2] += Math.sin(a) * rad;
        }
    }
}

// Normals from each grid's neighbours, and curvature: how far a point sits behind the mean of its
// neighbours along the normal (positive = a crease seen from the front), for the shader's fold shadows.
function shade(world) {
    const { pos, nrm, curv } = world;
    for (const f of world.flags) {
        const { cols, rows } = f;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const i = f.o + r * cols + c;
                const l = (c > 0 ? i - 1 : i) * 3;
                const rr = (c < cols - 1 ? i + 1 : i) * 3;
                const u = (r > 0 ? i - cols : i) * 3;
                const d = (r < rows - 1 ? i + cols : i) * 3;
                const ax = pos[rr] - pos[l];
                const ay = pos[rr + 1] - pos[l + 1];
                const az = pos[rr + 2] - pos[l + 2];
                const bx = pos[d] - pos[u];
                const by = pos[d + 1] - pos[u + 1];
                const bz = pos[d + 2] - pos[u + 2];
                // down × across: faces +z (toward us) on a flag hanging flat.
                let nx = by * az - bz * ay;
                let ny = bz * ax - bx * az;
                let nz = bx * ay - by * ax;
                const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
                nx /= len;
                ny /= len;
                nz /= len;
                const i3 = i * 3;
                nrm[i3] = nx;
                nrm[i3 + 1] = ny;
                nrm[i3 + 2] = nz;
                const lx = (pos[l] + pos[rr] + pos[u] + pos[d]) / 4 - pos[i3];
                const ly = (pos[l + 1] + pos[rr + 1] + pos[u + 1] + pos[d + 1]) / 4 - pos[i3 + 1];
                const lz = (pos[l + 2] + pos[rr + 2] + pos[u + 2] + pos[d + 2]) / 4 - pos[i3 + 2];
                curv[i] = (lx * nx + ly * ny + lz * nz) / f.w;
            }
        }
    }
}

// The cord as a flat ribbon a couple of pixels thick (the camera never moves, so it never shows its
// edge), wider at the knots tied between flags.
function updateCords(world) {
    const { cord, scratch, time } = world;
    for (const s of world.strings) {
        const m = s.m;
        for (let j = 0; j < m; j++) cordAt(s, s.pole ? s.ts[j] : j / (m - 1), time, scratch, j * 3);
        for (let j = 0; j < m; j++) {
            const a = Math.max(j - 1, 0) * 3;
            const b = Math.min(j + 1, m - 1) * 3;
            const tx = scratch[b] - scratch[a];
            const ty = scratch[b + 1] - scratch[a + 1];
            const half = s.pole ? s.widths[j] : s.half * (j % SAMPLES === 0 && j && j < m - 1 ? 2.2 : 1);
            const k = half / (Math.sqrt(tx * tx + ty * ty) || 1);
            const o = (s.q + j) * 6;
            const p = j * 3;
            // Just in front of the hems, which it runs through.
            cord[o] = scratch[p] + ty * k;
            cord[o + 1] = scratch[p + 1] - tx * k;
            cord[o + 2] = scratch[p + 2] + 0.004;
            cord[o + 3] = scratch[p] - ty * k;
            cord[o + 4] = scratch[p + 1] + tx * k;
            cord[o + 5] = scratch[p + 2] + 0.004;
        }
    }
}

// One mesh of all of a layer's flags, its positions and normals views onto the shared sim arrays.
function flagGeometry(world, layer) {
    const { p0, p1 } = layer;
    const n = p1 - p0;
    const geo = new BufferGeometry();
    const uv = new Float32Array(n * 2);
    const color = new Float32Array(n * 3);
    const fade = new Float32Array(n);
    const figure = new Float32Array(n);
    const seed = new Float32Array(n);
    const index = [];
    for (const f of layer.flags) {
        const { cols, rows } = f;
        const b = f.o - p0;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const v = b + r * cols + c;
                uv[v * 2] = c / (cols - 1);
                uv[v * 2 + 1] = 1 - r / (rows - 1);
                color.set(f.color, v * 3);
                fade[v] = f.fade;
                figure[v] = f.figure;
                seed[v] = f.seed;
                if (r < rows - 1 && c < cols - 1) index.push(v, v + cols, v + 1, v + cols, v + cols + 1, v + 1);
            }
        }
    }
    const dynamic = (array, size) => new BufferAttribute(array.subarray(p0 * size, p1 * size), size).setUsage(35048); // DynamicDrawUsage
    geo.setAttribute('position', dynamic(world.pos, 3));
    geo.setAttribute('normal', dynamic(world.nrm, 3));
    geo.setAttribute('aCurv', dynamic(world.curv, 1));
    geo.setAttribute('uv', new BufferAttribute(uv, 2));
    geo.setAttribute('aColor', new BufferAttribute(color, 3));
    geo.setAttribute('aFade', new BufferAttribute(fade, 1));
    geo.setAttribute('aFigure', new BufferAttribute(figure, 1));
    geo.setAttribute('aSeed', new BufferAttribute(seed, 1));
    geo.setIndex(index);
    return geo;
}

function cordGeometry(world, layer, px) {
    const { q0, q1 } = layer;
    const n = q1 - q0;
    const along = new Float32Array(n * 2);
    const side = new Float32Array(n * 2);
    const knot = new Float32Array(n * 2);
    const part = new Float32Array(n * 2);
    const index = [];
    for (const s of layer.strings) {
        for (let j = 0; j < s.m; j++) {
            const v = (s.q - q0 + j) * 2;
            // Strand stripes every ~3px along the cord; juniper twigs every third of the pole's top width.
            along[v] = along[v + 1] = s.pole ? s.along[j] : (j / (s.m - 1)) * (s.len / px / 3);
            side[v] = -1;
            side[v + 1] = 1;
            knot[v] = knot[v + 1] = !s.pole && j % SAMPLES === 0 ? 1 : 0;
            part[v] = part[v + 1] = s.pole ? s.parts[j] : 0;
            if (j < s.m - 1) index.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
        }
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(world.cord.subarray(q0 * 6, q1 * 6), 3).setUsage(35048));
    geo.setAttribute('aAlong', new BufferAttribute(along, 1));
    geo.setAttribute('aSide', new BufferAttribute(side, 1));
    geo.setAttribute('aKnot', new BufferAttribute(knot, 1));
    geo.setAttribute('aPart', new BufferAttribute(part, 1));
    geo.setIndex(index);
    return geo;
}

function Scene({ still }) {
    const { viewport, size, gl, invalidate } = useThree();
    const phone = size.width < 640;
    const { width: W, height: H } = viewport;
    const groups = useRef([]);
    // Pointer and scroll gusts, and parallax, fed by window listeners (the canvas takes no pointer events).
    const input = useRef({ x: 0, y: 0, vx: 0, vy: 0, speed: 0, puff: 0, gust: 0, nx: 0, scroll: 0 }).current;

    const materials = useMemo(() => {
        // The print atlas: one texture, two 4:5 cells side by side (wind horse, deity), dark ink on white.
        const print = printTexture();
        const flag = (haze) =>
            new ShaderMaterial({
                uniforms: {
                    uPrint: { value: print },
                    uSun: { value: new Vector3() },
                    uSunColor: { value: new Vector3() },
                    uSkyLight: { value: new Vector3() },
                    uGroundLight: { value: new Vector3() },
                    uRim: { value: new Vector3() },
                    uHazeColor: { value: new Vector3() },
                    uTrans: { value: 1 },
                    uHaze: { value: haze },
                    uOpacity: { value: haze ? 0.8 : 1 },
                },
                vertexShader: flagVertex,
                fragmentShader: flagFragment,
                transparent: true,
                depthWrite: false,
                side: DoubleSide,
            });
        const cord = (haze) =>
            new ShaderMaterial({
                uniforms: { uColor: { value: new Vector3() }, uPole: { value: new Vector3() }, uHazeColor: { value: new Vector3() }, uHaze: { value: haze }, uOpacity: { value: 1 } },
                vertexShader: cordVertex,
                fragmentShader: cordFragment,
                transparent: true,
                depthWrite: false,
                side: DoubleSide, // strings run either way, so the ribbon's winding does too
            });
        // Front layer, then the hazier back one.
        return [
            [flag(0), cord(0)],
            [flag(0.45), cord(0.5)],
        ];
    }, []);

    // Theme: light and lighting per data-theme on <html>.
    useEffect(() => {
        const html = document.documentElement;
        const apply = () => {
            const th = THEMES[html.dataset.theme === 'light' ? 'light' : 'dark'];
            for (const [flag, cord] of materials) {
                const u = flag.uniforms;
                u.uSun.value.copy(th.sun);
                u.uSunColor.value.set(...th.sunColor);
                u.uSkyLight.value.set(...th.skyLight);
                u.uGroundLight.value.set(...th.groundLight);
                u.uRim.value.set(...th.rim);
                u.uHazeColor.value.set(...th.haze);
                u.uTrans.value = th.trans;
                cord.uniforms.uColor.value.set(...th.cord);
                cord.uniforms.uPole.value.set(...th.pole);
                cord.uniforms.uHazeColor.value.set(...th.haze);
                cord.uniforms.uOpacity.value = th.cordOpacity;
            }
            invalidate();
        };
        apply();
        const observer = new MutationObserver(apply);
        observer.observe(html, { attributes: true, attributeFilter: ['data-theme'] });
        return () => observer.disconnect();
    }, [materials, invalidate]);
    useEffect(
        () => () => {
            materials[0][0].uniforms.uPrint.value.dispose();
            materials.flat().forEach((m) => m.dispose());
        },
        [materials],
    );

    const { world, meshes } = useMemo(() => {
        const px = W / size.width;
        const world = buildWorld(phone ? [PHONE_STRINGS] : [STRINGS, BACK_STRINGS], W, H, px);
        const meshes = world.layers.map((layer, i) => {
            const flags = new Mesh(flagGeometry(world, layer), materials[i][0]);
            const cord = new Mesh(cordGeometry(world, layer, px), materials[i][1]);
            // Back layer first; each cord over its own flags' hems.
            flags.renderOrder = 4 - i * 2;
            cord.renderOrder = 5 - i * 2;
            flags.frustumCulled = cord.frustumCulled = false;
            return [flags, cord];
        });
        // Reduced motion: let the cloth settle once in a light breeze and keep that draped pose.
        if (still) for (let i = 0; i < 400; i++) step(world, input, true);
        shade(world);
        updateCords(world);
        return { world, meshes };
    }, [W, H, size.width, phone, still, materials, input]);

    useEffect(() => () => meshes.flat().forEach((m) => m.geometry.dispose()), [meshes]);

    // Pointer movement near the flags blows a local gust in its direction, as hard as it moves; fast
    // scrolling gusts the whole sky. Both also nudge the layers a few pixels apart for depth.
    useEffect(() => {
        if (still) return;
        let last = null;
        let lastScroll = scrollY;
        const move = (e) => {
            input.nx = e.clientX / innerWidth - 0.5;
            const rect = gl.domElement.getBoundingClientRect();
            const unit = W / rect.width;
            if (last) {
                const dt = Math.max(8, e.timeStamp - last.t) / 1000;
                const vx = ((e.clientX - last.x) / dt) * unit;
                const vy = (-(e.clientY - last.y) / dt) * unit;
                input.vx += (vx - input.vx) * 0.5;
                input.vy += (vy - input.vy) * 0.5;
                input.speed = Math.hypot(input.vx, input.vy);
                input.puff = Math.min(1, input.puff + 0.35);
            }
            input.x = ((e.clientX - rect.left) / rect.width - 0.5) * W;
            input.y = (0.5 - (e.clientY - rect.top) / rect.height) * H;
            last = { x: e.clientX, y: e.clientY, t: e.timeStamp };
        };
        const scroll = () => {
            input.gust = Math.min(1.2, input.gust + Math.abs(scrollY - lastScroll) * 0.003);
            lastScroll = scrollY;
        };
        addEventListener('pointermove', move, { passive: true });
        addEventListener('scroll', scroll, { passive: true });
        return () => {
            removeEventListener('pointermove', move);
            removeEventListener('scroll', scroll);
        };
    }, [still, gl, W, H, input]);

    const clock = useRef({ acc: 0 }).current;
    useFrame((_, delta) => {
        if (still) return;
        // Fixed steps; a long frame (or a resume after pausing) is capped instead of exploding the cloth.
        clock.acc = Math.min(clock.acc + delta, STEP * 3);
        for (; clock.acc >= STEP; clock.acc -= STEP) {
            step(world, input, false);
            const decay = Math.exp(-STEP * 1.5);
            input.puff *= decay;
            input.gust *= decay;
        }
        shade(world);
        updateCords(world);
        for (const [flags, cord] of meshes) {
            const a = flags.geometry.attributes;
            a.position.needsUpdate = a.normal.needsUpdate = a.aCurv.needsUpdate = true;
            cord.geometry.attributes.position.needsUpdate = true;
        }
        // Parallax: the near layer slides a few px with the pointer and scroll, the far one less.
        const px = W / size.width;
        input.scroll += (Math.min(scrollY, 800) - input.scroll) * 0.1;
        for (let i = 0; i < meshes.length; i++) {
            const g = groups.current[i];
            const depth = i ? 0.35 : 1;
            g.position.x += (-input.nx * 6 * depth * px - g.position.x) * 0.05;
            g.position.y = input.scroll * 0.01 * depth * px;
        }
    });

    return meshes.map(([flags, cord], i) => (
        <group key={i} ref={(g) => (groups.current[i] = g)}>
            <primitive object={flags} />
            <primitive object={cord} />
        </group>
    ));
}

function hasWebGL() {
    try {
        const canvas = document.createElement('canvas');
        return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
    } catch {
        return false;
    }
}

// Prayer flags strung from Boudhanath's spire across the hero skyline. Client-only: Hero lazy-loads this after first paint.
export default function PrayerFlags() {
    const box = useRef(null);
    const [webgl] = useState(hasWebGL);
    const [still] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
    const [live, setLive] = useState(true);

    // Stop rendering when the hero scrolls away or the tab is hidden.
    useEffect(() => {
        if (!box.current) return;
        let inView = true;
        const update = () => setLive(inView && !document.hidden);
        const observer = new IntersectionObserver(([entry]) => {
            inView = entry.isIntersecting;
            update();
        });
        observer.observe(box.current);
        document.addEventListener('visibilitychange', update);
        return () => {
            observer.disconnect();
            document.removeEventListener('visibilitychange', update);
        };
    }, []);

    if (!webgl) return null;

    // Reduced motion draws only on demand (once, and on theme or size changes).
    return (
        <div ref={box} aria-hidden="true" className="hero-flags pointer-events-none absolute inset-x-0 bottom-0 -z-15">
            <Canvas linear flat dpr={[1, 2]} frameloop={!live ? 'never' : still ? 'demand' : 'always'} camera={{ position: [0, 0, 10], fov: 30 }} gl={{ antialias: true, powerPreference: 'low-power' }} style={{ pointerEvents: 'none' }}>
                <Scene still={still} />
            </Canvas>
        </div>
    );
}
