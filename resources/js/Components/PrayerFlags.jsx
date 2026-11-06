import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { BufferGeometry, CanvasTexture, DoubleSide, InstancedBufferAttribute, InstancedMesh, Line, LineBasicMaterial, Object3D, PlaneGeometry, ShaderMaterial, Vector2, Vector3 } from 'three';

// Lungta order: blue, white, red, green, yellow (sRGB, softened so they never shout over the skyline).
const LUNGTA = [
    [0.24, 0.47, 0.8],
    [0.96, 0.95, 0.91],
    [0.85, 0.28, 0.25],
    [0.22, 0.6, 0.38],
    [0.96, 0.77, 0.27],
];

// Strings in the skyline box's units (x -0.5..0.5 across, y -0.5..0.5 up), tied to landmarks in the
// skyline image as they are in real life: Boudhanath's spire (0.093, 0.14) out to the Dharahara tower
// and the bridge pylon, plus one from the pylon off the right edge. Both theme images share this layout.
const SPIRE = [0.093, 0.14];
const STRINGS = [
    { from: SPIRE, to: [-0.428, 0.2], sag: 0.07, count: 34 },
    { from: SPIRE, to: [0.412, 0.04], sag: 0.05, count: 22 },
    { from: [0.412, 0.04], to: [0.56, -0.02], sag: 0.025, count: 8 },
];
const PHONE_STRINGS = STRINGS.slice(0, 2).map((s) => ({ ...s, count: Math.round(s.count * 0.6) }));

const vertexShader = /* glsl */ `
    uniform float uTime;
    attribute vec3 aColor;
    attribute float aPhase;
    attribute float aFade;
    varying vec3 vColor;
    varying vec2 vUv;
    varying float vShade;
    varying float vFade;
    varying float vSeed;
    void main() {
        vec3 p = position;
        // 0 at the edge sewn to the string, 1 at the free edge: only the loose cloth moves.
        float k = 1.0 - uv.y;
        // Gusts roll along the string from the west, so neighbours lift one after another.
        float x = instanceMatrix[3].x;
        float gust = 0.5 + 0.5 * sin(uTime * 0.7 - x * 0.9 + sin(uTime * 0.23) * 2.0);
        gust *= gust;
        float amp = 0.06 + 0.2 * gust;
        float wave = uTime * (2.0 + 2.5 * gust) + aPhase - uv.x * 3.5 - k * 3.2;
        // Blown east and lifted in a gust; hanging slack and barely rippling in the lulls.
        p.x += k * k * 0.42 * gust;
        p.y += k * k * 0.16 * gust;
        p.z += sin(wave) * k * amp;
        // Light from the ripple's slope, so the cloth folds catch and lose the light.
        float slope = cos(wave) * k * amp * -3.2 + sin(wave) * amp;
        vShade = clamp(0.9 - 0.9 * slope, 0.6, 1.15);
        vColor = aColor;
        vUv = uv;
        vFade = aFade;
        vSeed = aPhase;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
    }
`;
const fragmentShader = /* glsl */ `
    uniform sampler2D uPrint;
    uniform vec3 uTint;
    uniform float uOpacity;
    varying vec3 vColor;
    varying vec2 vUv;
    varying float vShade;
    varying float vFade;
    varying float vSeed;
    float hash(float n) { return fract(sin(n) * 43758.5453); }
    void main() {
        // Frayed free edge: threads of uneven length.
        float thread = hash(floor(vUv.x * 26.0) * 12.9898 + vSeed * 78.233);
        if (vUv.y < thread * 0.07 * vFade * 2.5) discard;
        // Sun-bleached cloth with the woodblock print (wind horse and mantras) in faded ink.
        vec3 cloth = mix(vColor, vec3(0.92, 0.9, 0.84), vFade);
        float ink = 1.0 - texture2D(uPrint, vUv).r;
        cloth *= 1.0 - ink * (0.5 - vFade * 0.6);
        gl_FragColor = vec4(cloth * uTint * vShade, uOpacity);
    }
`;

// The woodblock print every lungta carries, drawn once: a wind horse in the middle, mantra lines above
// and below, and the four guardian animals as corner roundels. Ink is dark on white; the shader tints it.
function printTexture() {
    const c = Object.assign(document.createElement('canvas'), { width: 96, height: 120 });
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, 96, 120);
    g.strokeStyle = g.fillStyle = '#000';
    g.lineWidth = 2;
    g.strokeRect(6, 6, 84, 108);
    for (const [x, y] of [[18, 18], [78, 18], [18, 102], [78, 102]]) {
        g.beginPath();
        g.arc(x, y, 6, 0, Math.PI * 2);
        g.stroke();
    }
    // Wind horse: body, neck, legs and the jewel on its back.
    g.beginPath();
    g.ellipse(48, 62, 17, 8, 0, 0, Math.PI * 2);
    g.moveTo(60, 58);
    g.lineTo(68, 44);
    g.moveTo(36, 68);
    g.lineTo(32, 80);
    g.moveTo(42, 69);
    g.lineTo(42, 81);
    g.moveTo(56, 69);
    g.lineTo(58, 81);
    g.moveTo(61, 67);
    g.lineTo(65, 79);
    g.stroke();
    g.beginPath();
    g.arc(46, 50, 4, 0, Math.PI * 2);
    g.fill();
    // Mantra script: rows of short strokes.
    g.lineWidth = 1.5;
    for (const y of [30, 36, 88, 94]) {
        for (let x = 26; x < 72; x += 4 + Math.random() * 3) {
            g.beginPath();
            g.moveTo(x, y);
            g.lineTo(x + 2 + Math.random() * 2, y + (Math.random() - 0.5) * 2);
            g.stroke();
        }
    }
    const tex = new CanvasTexture(c);
    tex.anisotropy = 4;
    return tex;
}

// A unit flag hanging from its top edge (0..-1), scaled per instance.
function flagMesh(material, count) {
    const geo = new PlaneGeometry(1, 1, 8, 10).translate(0, -0.5, 0);
    geo.setAttribute('aColor', new InstancedBufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute('aPhase', new InstancedBufferAttribute(new Float32Array(count), 1));
    geo.setAttribute('aFade', new InstancedBufferAttribute(new Float32Array(count), 1));
    const mesh = new InstancedMesh(geo, material, count);
    mesh.frustumCulled = false;
    return mesh;
}

const dummy = new Object3D();

function FlagString({ from, to, sag, count, seed, material, lineMaterial }) {
    const { viewport } = useThree();
    const group = useRef(null);
    const { width: W, height: H } = viewport;

    const { mesh, line } = useMemo(() => {
        const [x0, y0, x1, y1] = [from[0] * W, from[1] * H, to[0] * W, to[1] * H];
        // A parabola is indistinguishable from a true catenary at this sag.
        const at = (t) => new Vector2(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - sag * H * 4 * t * (1 - t));
        const w = (Math.hypot(x1 - x0, y1 - y0) / count) * 0.86;
        const mesh = flagMesh(material, count);
        const { aColor, aPhase, aFade } = mesh.geometry.attributes;
        for (let i = 0; i < count; i++) {
            const t = (i + 0.5) / count;
            const p = at(t);
            const slope = at(t + 0.01).sub(p);
            // Sewn along the string at the top, the rest hangs under gravity: only a slight lean.
            const s = 0.92 + Math.random() * 0.12;
            dummy.position.set(p.x, p.y, (Math.random() - 0.5) * 0.02);
            dummy.rotation.set(0, 0, Math.atan2(slope.y, slope.x) * 0.25);
            dummy.scale.set(w * s, w * s * 1.2, w);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
            aColor.setXYZ(i, ...LUNGTA[i % 5]);
            aPhase.setX(i, seed + i * 0.45 + Math.random() * 0.8);
            // Some flags are new, most are a season or two in the sun.
            aFade.setX(i, Math.random() ** 1.6 * 0.4);
        }
        const points = Array.from({ length: 41 }, (_, i) => at(i / 40));
        const line = new Line(new BufferGeometry().setFromPoints(points), lineMaterial);
        return { mesh, line };
    }, [W, H, from, to, sag, count, seed, material, lineMaterial]);

    useEffect(() => () => {
        mesh.geometry.dispose();
        line.geometry.dispose();
    }, [mesh, line]);

    // The whole string breathes up and down a touch.
    useFrame(({ clock }) => {
        group.current.position.y = Math.sin(clock.elapsedTime * 0.5 + seed) * H * 0.006;
    });

    return (
        <group ref={group}>
            <primitive object={line} />
            <primitive object={mesh} />
        </group>
    );
}

function Scene() {
    const { size } = useThree();
    const phone = size.width < 640;

    const material = useMemo(() => new ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uTint: { value: new Vector3(1, 1, 1) }, uOpacity: { value: 0.95 }, uPrint: { value: printTexture() } },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
    }), []);
    const lineMaterial = useMemo(() => new LineBasicMaterial({ transparent: true }), []);

    // Light: bright but soft. Dark: dimmed and warmed so they sit inside the golden night scene.
    useEffect(() => {
        const html = document.documentElement;
        const apply = () => {
            const dark = html.dataset.theme !== 'light';
            material.uniforms.uTint.value.set(...(dark ? [0.6, 0.52, 0.4] : [0.97, 0.97, 0.97]));
            material.uniforms.uOpacity.value = dark ? 0.9 : 0.95;
            lineMaterial.color.set(dark ? '#7a6548' : '#5f5850');
            lineMaterial.opacity = dark ? 0.6 : 0.45;
        };
        apply();
        const observer = new MutationObserver(apply);
        observer.observe(html, { attributes: true, attributeFilter: ['data-theme'] });
        return () => {
            observer.disconnect();
            material.uniforms.uPrint.value.dispose();
            material.dispose();
            lineMaterial.dispose();
        };
    }, [material, lineMaterial]);

    useFrame(({ clock }) => {
        material.uniforms.uTime.value = clock.elapsedTime;
    });

    return (
        <>
            {(phone ? PHONE_STRINGS : STRINGS).map((s, i) => (
                <FlagString key={i} {...s} seed={i * 1.7} material={material} lineMaterial={lineMaterial} />
            ))}
        </>
    );
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

    return (
        <div ref={box} aria-hidden="true" className="hero-flags pointer-events-none absolute inset-x-0 bottom-0 -z-15">
            <Canvas linear flat dpr={[1, 1.5]} frameloop={live ? 'always' : 'never'} camera={{ position: [0, 0, 10], fov: 30 }} gl={{ antialias: true, powerPreference: 'low-power' }} style={{ pointerEvents: 'none' }}>
                <Scene />
            </Canvas>
        </div>
    );
}
