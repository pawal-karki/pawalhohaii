// Cursor swarm: plain objects + one requestAnimationFrame loop. No React state.
// Builders `claim` a cursor, steer it with `moveTo`/`follow`, then `release` it back to the flock.

export const CURSORS = [
    // Brand colours. `text` is the readable label/outline colour on top; `frame` (optional) replaces
    // near-black brand colours for the build frame so it still shows on the dark theme.
    { key: 'laravel', name: 'Laravel', color: '#FF2D20', text: '#0C0D11' },
    { key: 'php', name: 'PHP', color: '#777BB4', text: '#0C0D11' },
    { key: 'nextdotjs', name: 'Next.js', color: '#000000', text: '#FFFFFF', frame: '#FFFFFF' },
    { key: 'typescript', name: 'TypeScript', color: '#3178C6', text: '#FFFFFF' },
    { key: 'anthropic', name: 'Claude', color: '#D97757', text: '#0C0D11' },
    { key: 'prisma', name: 'Prisma', color: '#2D3748', text: '#FFFFFF', frame: '#A0AEC0' },
    { key: 'mysql', name: 'MySQL', color: '#4479A1', text: '#FFFFFF' },
    { key: 'react', name: 'React', color: '#61DAFB', text: '#0C0D11' },
];

const cursors = [];
const waiting = [];
let mouse = null;
let following = false;
let lastSeen = 0;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Where the flock idles: top-right on wide screens, bottom-right on phones so it never covers text.
const restPoint = (W, H) => (W < 640 ? { x: W - 120, y: H - 110 } : { x: W * 0.8, y: Math.min(170, H * 0.25) });

export function claim(timeout = 400) {
    const free = cursors.find((c) => !c.busy);
    if (free) {
        free.busy = true;
        return Promise.resolve(free);
    }
    // All busy (or swarm not started): wait briefly, then let the caller build without a cursor.
    return new Promise((resolve) => {
        const w = { resolve };
        waiting.push(w);
        setTimeout(() => {
            const i = waiting.indexOf(w);
            if (i >= 0) {
                waiting.splice(i, 1);
                resolve(null);
            }
        }, timeout);
    });
}

export function release(c) {
    if (!c) return;
    c.target = null;
    c.snap = false;
    c.arrive = null;
    setMode(c, null);
    const next = waiting.shift();
    if (next) next.resolve(c);
    else c.busy = false;
}

/** Glide to a (live) viewport point; resolves on arrival or after `timeout` ms. */
export function moveTo(c, getPoint, timeout = 520) {
    if (!c) return Promise.resolve();
    c.target = getPoint;
    c.snap = false;
    return new Promise((resolve) => {
        c.arrive = resolve;
        setTimeout(resolve, timeout);
    });
}

/** Stick tightly to a point (used while dragging a box or typing). */
export function follow(c, getPoint) {
    if (!c) return;
    c.target = getPoint;
    c.snap = true;
}

/** Cursor glyph: default arrow, or 'drag' for a crosshair. */
export function setMode(c, mode) {
    if (!c) return;
    if (mode) c.el.dataset.mode = mode;
    else delete c.el.dataset.mode;
}

/** A small "click": ring ripple + glyph press. Web Animations, so it stays off the rAF loop. */
export function click(c) {
    if (!c?.ring?.animate) return;
    c.ring.animate(
        [
            { transform: 'scale(0.2)', opacity: 0.9 },
            { transform: 'scale(1)', opacity: 0 },
        ],
        { duration: 460, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' },
    );
    c.glyph?.animate([{ scale: '0.78' }, { scale: '1' }], { duration: 240, easing: 'cubic-bezier(0.3, 1.6, 0.5, 1)' });
}

/** Once the hero is built, the idle flock trails the visitor's pointer. */
export function startFollowing() {
    following = true;
}

export function start(elements) {
    const { x: rx, y: ry } = restPoint(window.innerWidth, window.innerHeight);
    elements.forEach((el, i) => {
        const a = (i / elements.length) * Math.PI * 2;
        cursors.push({
            el,
            i,
            glyph: el.querySelector('.swarm-glyph'),
            ring: el.querySelector('.swarm-ring'),
            busy: false,
            // Spawn inside the viewport around the rest spot, so the first moveTo is short.
            x: rx + Math.cos(a) * 60,
            y: ry + Math.sin(a) * 40,
            vx: 0,
            vy: 0,
            tilt: 0,
            target: null,
        });
    });
    // Hand waiting builders their cursors now that the swarm exists.
    while (waiting.length && cursors.some((c) => !c.busy)) {
        const c = cursors.find((c) => !c.busy);
        c.busy = true;
        waiting.shift().resolve(c);
    }

    // Touch has no hovering pointer to follow or dodge.
    const onPointer = (e) => {
        if (e.pointerType === 'touch') return;
        mouse = { x: e.clientX, y: e.clientY };
        lastSeen = performance.now();
    };
    const onOut = (e) => {
        if (!e.relatedTarget) mouse = null;
    };
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('pointerdown', onPointer, { passive: true });
    document.addEventListener('pointerout', onOut, { passive: true });

    let raf;
    let prev = performance.now();
    const tick = (now) => {
        // Schedule first: one bad frame must never stop the loop.
        raf = requestAnimationFrame(tick);
        const dt = clamp((now - prev) / 1000, 0.001, 1 / 40);
        prev = now;
        step(dt, now / 1000);
    };
    raf = requestAnimationFrame(tick);

    return () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('pointermove', onPointer);
        window.removeEventListener('pointerdown', onPointer);
        document.removeEventListener('pointerout', onOut);
        cursors.length = 0;
    };
}

function step(dt, t) {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const chasing = following && mouse && performance.now() - lastSeen < 4000;
    // Flock goal: below-right of the pointer once the page is built, otherwise the resting spot.
    const goal = chasing ? { x: mouse.x + 58, y: mouse.y + 52 } : restPoint(W, H);
    const n = cursors.length;

    for (const c of cursors) {
        let ax = 0;
        let ay = 0;
        const p = c.target?.();
        if (p) {
            const tx = clamp(p.x, 4, W - 4);
            const ty = clamp(p.y, 4, H - 4);
            if (c.snap) {
                // Stiff lerp: glued to a moving point (frame corner, caret).
                const k = 1 - Math.exp(-dt * 32);
                const nx = c.x + (tx - c.x) * k;
                const ny = c.y + (ty - c.y) * k;
                c.vx = (nx - c.x) / dt;
                c.vy = (ny - c.y) / dt;
                c.x = nx;
                c.y = ny;
            } else {
                // Critically damped spring: eases out of rest and settles without overshoot.
                const w = 15;
                ax = (tx - c.x) * w * w - c.vx * 2 * w;
                ay = (ty - c.y) * w * w - c.vy * 2 * w;
            }
            if (c.arrive && Math.hypot(tx - c.x, ty - c.y) < 8) {
                c.arrive();
                c.arrive = null;
            }
        } else {
            // Cohesion: a soft spring toward a slowly orbiting, breathing slot around the goal.
            const a = t * (0.3 + (c.i % 3) * 0.07) + (c.i / n) * Math.PI * 2;
            const r = 46 + (c.i % 3) * 20 + Math.sin(t * 0.8 + c.i * 1.7) * 8;
            const w = 5.5;
            ax = (goal.x + Math.cos(a) * r - c.x) * w * w - c.vx * 1.7 * w;
            ay = (goal.y + Math.sin(a) * r * 0.65 - c.y) * w * w - c.vy * 1.7 * w;
            // Separation from every other cursor (labels are wide, so the bubble is too).
            for (const o of cursors) {
                if (o === c) continue;
                const dx = c.x - o.x;
                const dy = c.y - o.y;
                const d2 = dx * dx + dy * dy;
                if (d2 < 3600 && d2 > 0.01) {
                    ax += (dx / d2) * 12000;
                    ay += (dy / d2) * 12000;
                }
            }
            // Keep clear of the visitor's own pointer (measured from the cursor + label centre).
            if (mouse) {
                const dx = c.x + 24 - mouse.x;
                const dy = c.y + 20 - mouse.y;
                const d = Math.hypot(dx, dy);
                if (d < 90 && d > 0.01) {
                    const f = (((90 - d) / 90) ** 2 * 6000) / d;
                    ax += dx * f;
                    ay += dy * f;
                }
            }
        }
        if (!p || !c.snap) {
            c.vx += ax * dt;
            c.vy += ay * dt;
            const s = Math.hypot(c.vx, c.vy);
            if (s > 2600) {
                c.vx *= 2600 / s;
                c.vy *= 2600 / s;
            }
            c.x += c.vx * dt;
            c.y += c.vy * dt;
        }
        // Lean into the direction of travel.
        c.tilt += (clamp(c.vx * 0.01, -12, 12) - c.tilt) * Math.min(1, dt * 10);
        c.el.style.transform = `translate3d(${c.x.toFixed(1)}px, ${c.y.toFixed(1)}px, 0)`;
        if (c.glyph) c.glyph.style.transform = `rotate(${c.tilt.toFixed(1)}deg)`;
    }
}
