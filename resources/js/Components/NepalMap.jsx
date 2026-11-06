import { useLayoutEffect, useRef, useState, useEffect } from 'react';
import { animate } from 'motion';
import { DESTINATIONS } from '../content';
import { asset } from '../asset';

const VIEW = { x: 0, y: 25, w: 1240, h: 780 };
const MAP_MASK = `url(${asset('/images/nepal-districts.svg')}) center / contain no-repeat`;
const HOME = 'sunsari';
const PHOTO = asset('/images/pawal.webp');
const HOME_FALLBACK = { x: 1040, y: 692 }; // Sunsari centre before the district shapes load
const pct = (c) => ({ x: ((c.x - VIEW.x) / VIEW.w) * 100, y: ((c.y - VIEW.y) / VIEW.h) * 100 });
const INTRO_MS = 1900;
// Resolves when the photo has landed on Itahari (or the intro was skipped); the hero waits for it.
let landed;
export const photoLanded = new Promise((resolve) => (landed = resolve));
// The intro plays once per browser session; later loads show the avatar already in place.
const seenIntro = () => {
    try {
        if (sessionStorage.photoIntro) return true;
        sessionStorage.photoIntro = '1';
    } catch {}
    return false;
};
const START_STYLE = { left: `${pct(HOME_FALLBACK).x}%`, top: `${pct(HOME_FALLBACK).y}%` };

/**
 * Hero map of Nepal's 77 districts (outlines from sdoc.gov.np). Server render and first paint show the
 * static outline mask; the district shapes load from /data/nepal-districts.json and take over.
 * Hover, tap or focus a district to see its name, province and well-known travel destinations.
 * Districts with destinations get a dot and are keyboard-focusable; the rest are hover-only.
 */
export default function NepalMap() {
    const [districts, setDistricts] = useState(null);
    const [active, setActive] = useState(null);
    const [pinned, setPinned] = useState(null);
    const [centres, setCentres] = useState({});
    const paths = useRef({});

    useEffect(() => {
        let alive = true;
        fetch(asset('/data/nepal-districts.json'))
            .then((r) => r.json())
            .then((d) => alive && setDistricts(d))
            .catch(() => {});
        return () => (alive = false);
    }, []);

    // Dot and card anchor for each district: centre of its bounding box, as % of the map.
    useLayoutEffect(() => {
        if (!districts) return;
        const c = {};
        for (const [id, el] of Object.entries(paths.current)) {
            if (!el) continue;
            const b = el.getBBox();
            c[id] = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
        }
        setCentres(c);
    }, [districts]);

    // Clicking outside the map clears a pinned district.
    useEffect(() => {
        if (!pinned) return;
        const off = (e) => !e.target.closest?.('.nepal-map') && setPinned(null);
        document.addEventListener('pointerdown', off);
        return () => document.removeEventListener('pointerdown', off);
    }, [pinned]);

    const shown = active || pinned;
    const info = shown && districts?.find((d) => d.id === shown);
    const at = shown && centres[shown];

    return (
        <div className="nepal-map absolute inset-0" onPointerLeave={() => setActive(null)}>
            {!districts && <div aria-hidden="true" className="hero-map-lines absolute inset-0" style={{ mask: MAP_MASK, WebkitMask: MAP_MASK }} />}
            <svg className="absolute inset-0 size-full overflow-visible" viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`} role="group" aria-label="Map of Nepal. Choose a district to see popular travel destinations.">
                {districts?.map((d) => {
                    const spots = DESTINATIONS[d.id];
                    return (
                        <path
                            key={d.id}
                            ref={(el) => (paths.current[d.id] = el)}
                            d={d.d}
                            className={`district${spots ? ' has-spots' : ''}${d.id === shown ? ' is-active' : ''}${d.id === HOME ? ' is-home' : ''}`}
                            tabIndex={spots ? 0 : -1}
                            role={spots ? 'button' : undefined}
                            aria-label={spots ? `${d.name}: ${spots.join(', ')}` : undefined}
                            aria-pressed={spots ? pinned === d.id : undefined}
                            onPointerEnter={(e) => e.pointerType === 'mouse' && setActive(d.id)}
                            onFocus={() => setActive(d.id)}
                            onBlur={() => setActive(null)}
                            onClick={() => setPinned(pinned === d.id ? null : d.id)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setPinned(pinned === d.id ? null : d.id);
                                }
                                if (e.key === 'Escape') {
                                    setPinned(null);
                                    e.currentTarget.blur();
                                }
                            }}
                        />
                    );
                })}
                {/* Home: the plain pin on phones (the photo pin below takes over from 640px).
                    Static until the shapes load, then a dot per destination district. */}
                {!districts && <circle cx="1040" cy="692" r="6" className="hero-map-pin" />}
                {Object.entries(centres).map(([id, c]) =>
                    id === HOME ? (
                        <g key={id} aria-hidden="true">
                            <circle cx={c.x} cy={c.y} r="6" className="hero-map-pin" />
                            <circle cx={c.x} cy={c.y} r="6" className="hero-map-ping" />
                        </g>
                    ) : DESTINATIONS[id] ? (
                        <circle key={id} aria-hidden="true" cx={c.x} cy={c.y} r="3.5" className={`spot-dot${id === shown ? ' is-active' : ''}`} />
                    ) : null,
                )}
            </svg>

            {/* The avatar covers most of Sunsari, so hovering it opens Sunsari's card (with the photo). */}
            <MePin at={pct(centres[HOME] || HOME_FALLBACK)} ready={!!centres[HOME]} onHover={(on) => setActive(on ? HOME : null)} />

            {info && at && (
                <div
                    role="status"
                    className="map-card"
                    data-side={(at.x - VIEW.x) / VIEW.w > 0.62 ? 'right' : (at.x - VIEW.x) / VIEW.w < 0.3 ? 'left' : 'center'}
                    data-below={(at.y - VIEW.y) / VIEW.h < 0.3 || undefined}
                    data-home={info.id === HOME || undefined}
                    style={{ left: `${((at.x - VIEW.x) / VIEW.w) * 100}%`, top: `${((at.y - VIEW.y) / VIEW.h) * 100}%` }}
                >
                    {info.id === HOME && <img src={PHOTO} alt="Pawal Karki Dholi" width="480" height="600" className="me-card-photo mb-3 aspect-[4/5] w-52 rounded-lg object-cover object-top" />}
                    <p className="text-sm font-semibold text-fg">
                        {info.name}
                        {info.id === HOME && <span className="ml-2 rounded-full bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent">Home</span>}
                    </p>
                    <p className="text-xs text-muted">{info.province}</p>
                    {DESTINATIONS[info.id] && (
                        <ul className="mt-2 space-y-1 text-[13px] text-fg">
                            {DESTINATIONS[info.id].map((s) => (
                                <li key={s} className="flex gap-2">
                                    <span aria-hidden="true" className="mt-[0.45rem] size-1 shrink-0 rounded-full bg-accent-solid" />
                                    {s}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}

/**
 * Intro: the photo appears first, framed like a vision model's detection (brackets, scan line,
 * face box, coordinates), while the map is dimmed. Then the photo flies along an arc to Itahari,
 * shrinking into a round avatar pin, and the map lights up. Without JS, or with reduced motion, or
 * when the page loads already scrolled, or after the first view this session, the avatar simply sits
 * on the pin. Desktop and tablet only: phones keep the plain SVG pin. The cursors building the hero
 * wait for the landing (`photoLanded`).
 */
function MePin({ at, ready, onHover }) {
    const ref = useRef(null);
    const target = useRef(at);
    target.current = at;

    const place = () => {
        const el = ref.current;
        el.style.left = `${target.current.x}%`;
        el.style.top = `${target.current.y}%`;
    };

    const fly = async () => {
        const el = ref.current;
        if (el.dataset.phase !== 'intro') return;
        el.dataset.phase = 'fly';
        await animate(
            el,
            { left: `${target.current.x}%`, top: `${target.current.y}%`, width: '44px', height: '44px', borderRadius: '22px' },
            // Different easing on each axis bends the straight line into an arc.
            { duration: 1.25, ease: [0.65, 0, 0.35, 1], left: { duration: 1.25, ease: [0.45, 0, 0.2, 1] }, top: { duration: 1.25, ease: [0.8, 0, 0.5, 1] } },
        );
        el.dataset.phase = 'landed';
        el.dataset.flew = ''; // shows the "Itahari · Home" label once
        el.closest('.nepal-map').dataset.intro = 'done';
        landed();
    };

    useEffect(() => {
        const el = ref.current;
        const map = el.closest('.nepal-map');
        // Phones keep the plain pin (CSS hides this one below 640px), so no intro there.
        if (matchMedia('(max-width: 639px), (prefers-reduced-motion: reduce)').matches || window.scrollY > 200 || seenIntro()) {
            el.dataset.phase = 'landed';
            map.dataset.intro = 'done';
            return landed();
        }
        // Start centred on the part of the map that is on screen, clear of the floating nav.
        const box = map.getBoundingClientRect();
        const small = innerWidth < 640;
        const [w, h] = small ? [160, 200] : [200, 250];
        const cx = (Math.max(box.left, 0) + Math.min(box.right, innerWidth)) / 2;
        const cy = Math.max((Math.max(box.top, 0) + Math.min(box.bottom, innerHeight)) / 2, 96 + h / 2);
        Object.assign(el.style, {
            left: `${((cx - box.left) / box.width) * 100}%`,
            top: `${((cy - box.top) / box.height) * 100}%`,
            width: `${w}px`,
            height: `${h}px`,
            borderRadius: '16px',
        });
        el.dataset.phase = 'intro';
        el.dataset.t0 = performance.now();
        const fallback = setTimeout(fly, 4500); // district data failed or is slow: fly to the fallback point
        return () => clearTimeout(fallback);
    }, []);

    // Fly once the real Sunsari centre is known and the intro has had its moment.
    useEffect(() => {
        const el = ref.current;
        if (el.dataset.phase === 'landed') return place();
        if (!ready || el.dataset.phase !== 'intro') return;
        const t = setTimeout(fly, Math.max(0, INTRO_MS - (performance.now() - Number(el.dataset.t0))));
        return () => clearTimeout(t);
    }, [ready, at.x, at.y]);

    // Constant style so React never overwrites the positions the effects set.
    return (
        <div
            ref={ref}
            className="me-pin"
            aria-hidden="true"
            style={START_STYLE}
            onPointerEnter={(e) => e.pointerType === 'mouse' && onHover(true)}
            onPointerLeave={() => onHover(false)}
        >
            <span className="me-photo">
                <img src={PHOTO} alt="" width="480" height="600" />
                <span className="me-scan" />
            </span>
            <span className="me-bracket is-tl" />
            <span className="me-bracket is-tr" />
            <span className="me-bracket is-bl" />
            <span className="me-bracket is-br" />
            <span className="me-face">
                <span>pawal · 0.99</span>
            </span>
            <span className="me-caption">
                <i /> Locating · Itahari, Nepal · 26.66°N 87.27°E
            </span>
            <span className="me-home">Itahari · Home</span>

        </div>
    );
}
