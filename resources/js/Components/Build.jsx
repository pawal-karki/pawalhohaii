import { useEffect, useRef } from 'react';
import { animate } from 'motion';
import { CURSORS, claim, click, follow, moveTo, release, setMode } from '../swarm';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// Hydrated after the CSS failsafe (app.css, build-failsafe at 3.5s) may already have shown content: don't hide it again.
const LATE_MS = 3000;

/**
 * A box the swarm builds when it scrolls into view: a cursor drags out the frame (with a live size
 * badge), types the heading, then the body fades in. Server-rendered content is complete; the
 * hiding only happens via CSS under `html.js` + no reduced-motion, and every path ends in data-stage="done".
 */
export default function Build({ as: Tag = 'div', title, heading: H = 'h2', headingClass = '', bodyClass = '', className = '', delay = 0, onBuilt, children, ...rest }) {
    const ref = useRef(null);
    const frame = useRef(null);
    const badge = useRef(null);
    const live = useRef(null);
    const caret = useRef(null);

    useEffect(() => {
        const el = ref.current;
        if (el.dataset.stage === 'done') return;
        let c = null;
        let over = false;
        let watchdog;
        const finish = () => {
            if (over) return;
            over = true;
            clearTimeout(watchdog);
            release(c);
            c = null;
            el.dataset.stage = 'done';
            onBuilt?.();
        };
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) return finish();

        const late = performance.now() > LATE_MS;
        let first = true;
        el.dataset.stage = 'wait'; // cancels the CSS failsafe: JS is alive and owns this box now
        // Huge top margin: boxes above the viewport also count, so ones scrolled (or jumped) past still finish.
        const io = new IntersectionObserver(
            ([e]) => {
                const initial = first;
                first = false;
                if (!e.isIntersecting) return;
                io.disconnect();
                if (e.boundingClientRect.bottom < 0 || document.hidden || (late && initial)) return finish();
                run().catch(finish);
            },
            { rootMargin: '100000px 0px -8% 0px' },
        );
        io.observe(el);

        const box = () => el.getBoundingClientRect();
        const size = (v) => {
            const b = box();
            if (!frame.current) return;
            frame.current.style.width = `${b.width * v}px`;
            frame.current.style.height = `${b.height * v}px`;
            badge.current.textContent = `${Math.round(b.width * v)} × ${Math.round(b.height * v)}`;
        };

        async function run() {
            // Whatever happens (stalled timers, lost cursor, hidden tab), the box shows up.
            watchdog = setTimeout(finish, delay + 2600);
            await wait(delay);
            if (over) return;
            c = await claim();
            if (over) {
                release(c);
                c = null;
                return;
            }
            const brand = CURSORS[c ? c.i : 0];
            // --c brand, --cf its dark-theme stand-in (near-black brands), --ct readable text on --c
            el.style.setProperty('--c', brand.color);
            el.style.setProperty('--cf', brand.frame || brand.color);
            el.style.setProperty('--ct', brand.text);

            // 1. fly to the top-left corner and click
            await moveTo(c, () => ({ x: box().left, y: box().top }));
            if (over) return;
            click(c);

            // 2. drag out the frame with a crosshair, live size badge and corner handles
            setMode(c, 'drag');
            el.dataset.stage = 'drag';
            let p = 0;
            follow(c, () => {
                const b = box();
                return { x: b.left + b.width * p, y: b.top + b.height * p };
            });
            const drag = animate(0, 1, {
                duration: 0.65,
                ease: [0.65, 0, 0.35, 1],
                onUpdate: (v) => {
                    p = v;
                    size(v);
                },
            });
            // motion's animate runs on rAF, which stalls in background tabs: never wait on it alone.
            await Promise.race([drag, wait(900)]);
            drag.stop();
            if (over) return;
            p = 1;
            size(1);
            frame.current.style.width = frame.current.style.height = '100%';
            setMode(c, null);
            click(c);

            // 3. type the heading, cursor riding the caret
            if (title && live.current) {
                el.dataset.stage = 'type';
                follow(c, () => {
                    const b = caret.current?.getBoundingClientRect();
                    return b && { x: b.right + 2, y: b.bottom - 4 };
                });
                const step = Math.min(55, Math.max(18, 800 / title.length));
                for (let i = 1; i <= title.length; i++) {
                    if (over || document.hidden) break;
                    live.current.textContent = title.slice(0, i);
                    await wait(step * (0.6 + Math.random() * 0.8));
                }
                if (!over && !document.hidden) await wait(140);
            }

            finish();
        }

        return () => {
            io.disconnect();
            clearTimeout(watchdog);
            over = true;
            release(c);
            c = null;
        };
    }, []);

    return (
        <Tag ref={ref} className={`build ${className}`} {...rest}>
            <span ref={frame} className="build-frame" aria-hidden="true">
                <span className="build-handle" data-h="tl" />
                <span className="build-handle" data-h="tr" />
                <span className="build-handle" data-h="bl" />
                <span className="build-handle" data-h="br" />
                <span ref={badge} className="build-badge" />
            </span>
            {title && (
                <H className={`build-head ${headingClass}`}>
                    <span className="type-full">{title}</span>
                    <span className="type-live" aria-hidden="true">
                        <span ref={live} />
                        <span ref={caret} className="caret" />
                    </span>
                </H>
            )}
            <div className={`build-body ${bodyClass}`}>{children}</div>
        </Tag>
    );
}
