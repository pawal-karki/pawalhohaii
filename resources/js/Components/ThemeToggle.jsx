import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Warm the other theme's lazy skyline images so the wipe doesn't reveal an empty horizon.
function preload(theme) {
    const srcs = [...document.querySelectorAll(`.skyline-${theme}, .hero-sky-${theme} img`)].map((img) => img.currentSrc || img.src);
    return Promise.race([
        Promise.all(
            srcs.map((src) => {
                const img = new Image();
                img.src = src;
                return img.decode().catch(() => {});
            }),
        ),
        wait(150),
    ]);
}

export default function ThemeToggle() {
    const [theme, setTheme] = useState('dark');
    useEffect(() => setTheme(document.documentElement.dataset.theme || 'dark'), []);
    const next = theme === 'dark' ? 'light' : 'dark';

    const toggle = async () => {
        const root = document.documentElement;
        const apply = () => {
            root.dataset.theme = next;
            try {
                localStorage.theme = next;
            } catch {}
            setTheme(next);
        };

        // No View Transitions: colours cross-fade via a short-lived transition class instead.
        if (!document.startViewTransition) {
            root.classList.add('theme-shifting');
            apply();
            setTimeout(() => root.classList.remove('theme-shifting'), 500);
            return;
        }

        await preload(next);
        // Dawn rises from the horizon (bottom); dusk falls from the sky (top). See app.css "Theme shift".
        root.dataset.shift = next === 'light' ? 'dawn' : 'dusk';
        const t = document.startViewTransition(() => flushSync(apply));
        t.finished.finally(() => delete root.dataset.shift);
    };

    return (
        <button
            type="button"
            onClick={toggle}
            onPointerEnter={() => preload(next)}
            aria-label={`Switch to ${next} theme`}
            className="theme-toggle grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg"
        >
            {/* Both glyphs stay mounted; CSS swaps them on html[data-theme] (sun sets, moon rises). */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="overflow-visible">
                <g className="tt-sun">
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                </g>
                <path className="tt-moon" d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />
            </svg>
        </button>
    );
}
