import { useLayoutEffect, useRef, useState, useEffect } from 'react';
import { DESTINATIONS } from '../content';
import { asset } from '../asset';

const VIEW = { x: 0, y: 25, w: 1240, h: 780 };
const MAP_MASK = `url(${asset('/images/nepal-districts.svg')}) center / contain no-repeat`;
const HOME = 'sunsari';

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
                {/* Static home marker until the shapes load, then a dot per destination district. */}
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

            {info && at && (
                <div
                    role="status"
                    className="map-card"
                    data-side={(at.x - VIEW.x) / VIEW.w > 0.62 ? 'right' : (at.x - VIEW.x) / VIEW.w < 0.3 ? 'left' : 'center'}
                    data-below={(at.y - VIEW.y) / VIEW.h < 0.3 || undefined}
                    style={{ left: `${((at.x - VIEW.x) / VIEW.w) * 100}%`, top: `${((at.y - VIEW.y) / VIEW.h) * 100}%` }}
                >
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
