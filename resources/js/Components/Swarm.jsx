import { useEffect, useRef } from 'react';
import StackIcon from './StackIcon';
import { CURSORS, start } from '../swarm';

export default function Swarm() {
    const els = useRef([]);

    useEffect(() => {
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        // Touch devices get a lighter flock.
        const active = els.current.slice(0, matchMedia('(pointer: coarse)').matches ? 4 : CURSORS.length);
        active.forEach((el) => (el.hidden = false));
        return start(active);
    }, []);

    return (
        <div className="swarm" aria-hidden="true">
            {CURSORS.map(({ key, name, color, text, frame }, i) => (
                <div key={key} ref={(el) => (els.current[i] = el)} className="swarm-cursor" style={{ '--c': color, '--ct': text, '--cf': frame || color }} hidden>
                    <span className="swarm-ring" />
                    <span className="swarm-glyph">
                        <svg width="18" height="20" viewBox="0 0 18 20">
                            <path d="M1.5 1.5 16 9l-6.6 1.9L6.6 18Z" fill="var(--c)" stroke="var(--ct)" strokeWidth="1.4" strokeLinejoin="round" />
                        </svg>
                    </span>
                    <svg className="swarm-cross" width="22" height="22" viewBox="-11 -11 22 22">
                        <path d="M0-10v6M0 4v6M-10 0h6M4 0h6" stroke="var(--ct)" strokeWidth="3.2" strokeLinecap="round" />
                        <path d="M0-10v6M0 4v6M-10 0h6M4 0h6" stroke="var(--c)" strokeWidth="1.5" strokeLinecap="round" />
                        <circle r="1.6" fill="var(--c)" stroke="var(--ct)" strokeWidth="0.8" />
                    </svg>
                    <span className="swarm-label">
                        <StackIcon name={key} className="size-3" />
                        {name}
                    </span>
                </div>
            ))}
        </div>
    );
}
