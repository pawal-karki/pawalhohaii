import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Color, Float32BufferAttribute, PlaneGeometry } from 'three';
import { asset } from '../asset';

const VIEW_W = 1240;
const VIEW_H = 780;
const RELIEF = 70; // Everest in map units: about 5x true scale, so the Himalaya reads at hero size
const TILT = [14, 24]; // degrees the map plate leans back: at rest, and once scrolled a screen down
const SWAY = 3; // degrees of cursor parallax

/**
 * 3D relief under the district map: a plane displaced by public/data/nepal-height.png (made by
 * scripts/nepal-heightmap.mjs in the same 1240x780 frame as the districts), masked to the district
 * outline. An orthographic camera looking straight down keeps it exactly under the SVG; the whole map tilts in CSS.
 * Loaded lazily by NepalMap, client only.
 */
export default function NepalRelief({ outline, view }) {
    const [map, setMap] = useState(null);
    const wrap = useRef(null);
    // Cut to Nepal's outline with a mask of the districts' union. (A clip-path: url(#…) is dropped by Chrome
    // once the map is tilted in 3D; a mask image isn't.)
    const mask = useMemo(() => {
        const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${view.x} ${view.y} ${view.w} ${view.h}' preserveAspectRatio='none'><path d='${outline}'/></svg>`;
        return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
    }, [outline]);

    useEffect(() => {
        const img = new Image();
        img.src = asset('/data/nepal-height.png');
        img.decode()
            .then(() => {
                const { width: w, height: h } = img;
                const ctx = Object.assign(document.createElement('canvas'), { width: w, height: h }).getContext('2d');
                ctx.drawImage(img, 0, 0);
                const px = ctx.getImageData(0, 0, w, h).data;
                const tone = new Float32Array(w * h); // 0..1, sqrt of elevation (as stored)
                for (let i = 0; i < tone.length; i++) tone[i] = px[i * 4] / 255;
                // Outside Nepal is 0. Spread the edge values a few cells outward so a tilted edge shows
                // no cliff inside the clip.
                for (let pass = 0; pass < 4; pass++) {
                    const prev = tone.slice();
                    for (let i = 0; i < tone.length; i++) {
                        if (prev[i]) continue;
                        const c = i % w;
                        const n = [c > 0 && prev[i - 1], c < w - 1 && prev[i + 1], prev[i - w], prev[i + w]].filter(Boolean);
                        if (n.length) tone[i] = n.reduce((a, b) => a + b) / n.length;
                    }
                }
                // At hero size each heightmap cell spans 3-4 px, so a vertex per cell shows as facets and a
                // stepped edge. Upsample 3x, smoothed, for a finer mesh with soft slopes.
                // Done in floats: a canvas would round the heights back to 8 bits and leave fine terraces.
                const S = 3;
                const [W, H] = [w * S, h * S];
                const at = (x, y) => tone[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
                const fine = new Float32Array(W * H);
                for (let y = 0; y < H; y++) {
                    const fy = (y + 0.5) / S - 0.5;
                    const y0 = Math.floor(fy);
                    const ty = fy - y0;
                    for (let x = 0; x < W; x++) {
                        const fx = (x + 0.5) / S - 0.5;
                        const x0 = Math.floor(fx);
                        const tx = fx - x0;
                        const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx;
                        const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx;
                        fine[y * W + x] = top + (bottom - top) * ty;
                    }
                }
                // Two box-blur passes round off the bilinear creases along the old cell lines.
                for (let pass = 0; pass < 2; pass++) {
                    const prev = fine.slice();
                    for (let y = 1; y < H - 1; y++)
                        for (let x = 1; x < W - 1; x++) {
                            const i = y * W + x;
                            fine[i] = (prev[i - W - 1] + prev[i - W] + prev[i - W + 1] + prev[i - 1] + prev[i] + prev[i + 1] + prev[i + W - 1] + prev[i + W] + prev[i + W + 1]) / 9;
                        }
                }
                setMap({ w: W, h: H, tone: fine });
            })
            .catch(() => {});
    }, []);

    return (
        <div ref={wrap} aria-hidden="true" className="hero-relief absolute inset-0" style={{ maskImage: mask, WebkitMaskImage: mask }}>
            <Canvas
                orthographic
                flat
                frameloop="demand"
                dpr={[1, 2]}
                gl={{ alpha: true, powerPreference: 'low-power' }}
                camera={{ position: [0, 0, 1000], near: 1, far: 2000 }}
                style={{ pointerEvents: 'none', opacity: map ? 1 : 0, transition: 'opacity 1.2s ease' }}
            >
                {map && <Terrain {...map} wrap={wrap} />}
            </Canvas>
        </div>
    );
}

// Site tokens, so the terrain follows the theme. Plain hex in app.css, which three parses directly.
const palette = () => {
    const css = getComputedStyle(document.documentElement);
    const token = (name) => new Color(css.getPropertyValue(name).trim());
    const dark = document.documentElement.dataset.theme !== 'light';
    const low = token('--surface-2');
    return {
        low,
        high: dark ? low.clone().lerp(token('--fg'), 0.32) : new Color('#ffffff'),
        shade: new Color('#ffffff').lerp(token('--accent'), dark ? 0.55 : 0.35), // ambient: shadows lean blue
        sun: dark ? 1.7 : 2.6,
        fill: dark ? 1.1 : 1.9,
    };
};

function Terrain({ w, h, tone, wrap }) {
    const { camera, size, invalidate } = useThree();
    const dpr = useThree((s) => s.viewport.dpr);
    const mesh = useRef(null);
    const [pal, setPal] = useState(palette);
    const target = useRef({ tilt: 0, x: 0, y: 0, on: true });
    const now = useRef({ tilt: 0, x: 0, y: 0 });
    const plate = useRef(null); // the .nepal-map box, tilted as a whole
    useEffect(() => {
        const el = (plate.current = wrap.current?.closest('.nepal-map'));
        return () => el && (el.style.transform = '');
    }, []);

    // Vertices sit on the heightmap's pixel centres; sqrt-stored heights are squared back.
    const geometry = useMemo(() => {
        const g = new PlaneGeometry((VIEW_W * (w - 1)) / w, (VIEW_H * (h - 1)) / h, w - 1, h - 1);
        const pos = g.attributes.position;
        for (let i = 0; i < pos.count; i++) pos.setZ(i, tone[i] * tone[i] * RELIEF);
        g.computeVertexNormals();
        g.setAttribute('color', new Float32BufferAttribute(new Float32Array(pos.count * 3), 3));
        return g;
    }, [w, h, tone]);
    useEffect(() => () => geometry.dispose(), [geometry]);

    // Low ground near --surface-2, rising to light peaks.
    useLayoutEffect(() => {
        const col = geometry.attributes.color;
        const c = new Color();
        for (let i = 0; i < col.count; i++) {
            const t = Math.min(1, Math.max(0, (tone[i] - 0.15) / 0.75));
            c.copy(pal.low).lerp(pal.high, t * t * (3 - 2 * t));
            col.setXYZ(i, c.r, c.g, c.b);
        }
        col.needsUpdate = true;
        invalidate();
    }, [geometry, pal]);

    // The 1240x780 frame fills the canvas (same aspect as the box). A resize or zoom (dpr) clears it: redraw.
    useLayoutEffect(() => {
        camera.zoom = size.width / VIEW_W;
        camera.updateProjectionMatrix();
        invalidate();
    }, [size.width, dpr]);

    // Redraw only on scroll, pointer or theme change, and only while the hero is on screen.
    useEffect(() => {
        const t = target.current;
        const kick = () => t.on && invalidate();
        const onScroll = () => {
            t.tilt = Math.min(1, scrollY / innerHeight);
            kick();
        };
        const onMove = (e) => {
            t.x = (e.clientX / innerWidth) * 2 - 1;
            t.y = (e.clientY / innerHeight) * 2 - 1;
            kick();
        };
        const io = new IntersectionObserver(([e]) => {
            t.on = e.isIntersecting;
            kick();
        });
        const theme = new MutationObserver(() => setPal(palette()));
        io.observe(wrap.current);
        theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
        addEventListener('scroll', onScroll, { passive: true });
        addEventListener('pointermove', onMove, { passive: true });
        onScroll();
        return () => {
            io.disconnect();
            theme.disconnect();
            removeEventListener('scroll', onScroll);
            removeEventListener('pointermove', onMove);
        };
    }, []);

    // Damped follow; keeps asking for frames until it settles.
    useFrame((_, dt) => {
        const t = target.current;
        const n = now.current;
        const k = 1 - Math.exp(-Math.min(dt, 0.1) * 4);
        let moving = false;
        for (const key of ['tilt', 'x', 'y']) {
            n[key] += (t[key] - n[key]) * k;
            if (Math.abs(t[key] - n[key]) > 1e-4) moving = true;
        }
        // The terrain is drawn straight on, so it sits exactly under the SVG outline. The tilt is a CSS 3D
        // transform on the whole map (terrain, outline, dots and pin together), so they can never drift apart.
        // North leans away as you scroll; the cursor adds a little sway.
        const rx = TILT[0] + (TILT[1] - TILT[0]) * n.tilt - n.y * SWAY * 0.75;
        const ry = n.x * SWAY;
        if (plate.current) plate.current.style.transform = `perspective(1400px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
        if (moving && t.on) invalidate();
    });

    return (
        <>
            <ambientLight color={pal.shade} intensity={pal.fill} />
            {/* Sun from the north-west, as on classic relief maps. */}
            <directionalLight position={[-1, 1, 1.1]} intensity={pal.sun} />
            <mesh ref={mesh} geometry={geometry}>
                <meshLambertMaterial vertexColors />
            </mesh>
        </>
    );
}
