import { useEffect, useRef, useState } from 'react';
import { LayoutGroup, MotionConfig, motion } from 'motion/react';
import Build from './Build';
import StackIcon from './StackIcon';
import { STACK, projects } from '../content';

const spring = { type: 'spring', stiffness: 300, damping: 34 };

export function StackChips({ keys, className = '' }) {
    return (
        <ul className={`flex flex-wrap gap-1.5 ${className}`} aria-label="Tech stack">
            {keys.map((k) => (
                <li key={k} className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2 py-1 font-mono text-[11px] leading-none text-muted">
                    <StackIcon name={k} className="size-3.5" />
                    {STACK[k]}
                </li>
            ))}
        </ul>
    );
}

/**
 * Pixora demo: a mini site builder that assembles itself. A cursor drags a Button from the element
 * panel onto the page, then resizes the selected hero block while the size badge counts live.
 * Pure CSS loop (sections-work.css "Pixora canvas"); paused off-screen; static for reduced motion.
 */
function PixoraCanvas() {
    const ref = useRef(null);
    useEffect(() => {
        const io = new IntersectionObserver(([e]) => (ref.current.dataset.play = e.isIntersecting ? 'on' : 'off'));
        io.observe(ref.current);
        return () => io.disconnect();
    }, []);

    return (
        <div ref={ref} aria-hidden="true" className="pc" data-play="off">
            <div className="pc-chrome">
                <span className="pc-dots">
                    <i />
                    <i />
                    <i />
                </span>
                <span className="pc-url">pawal.dev</span>
            </div>
            <div className="pc-body">
                <div className="pc-palette">
                    {['Text', 'Image', 'Button'].map((label) => (
                        <span key={label} className="pc-tool">
                            <i className={`pc-glyph is-${label.toLowerCase()}`} />
                            <span className="pc-label">{label}</span>
                        </span>
                    ))}
                </div>
                <div className="pc-nav">
                    <i />
                    <i />
                    <i />
                    <i />
                </div>
                <div className="pc-hero">
                    <i className="pc-line is-title" />
                    <i className="pc-line" />
                    <i className="pc-line is-short" />
                    <span className="pc-handle is-tl" />
                    <span className="pc-handle is-tr" />
                    <span className="pc-handle is-bl" />
                    <span className="pc-handle is-br" />
                    <span className="pc-badge" />
                </div>
                <div className="pc-cards">
                    <i />
                    <i />
                    <i />
                </div>
                <span className="pc-drop">Button</span>
                <span className="pc-cursor">
                    <svg width="14" height="16" viewBox="0 0 18 20">
                        <path d="M1.5 1.5 16 9l-6.6 1.9L6.6 18Z" />
                    </svg>
                    <span className="pc-ghost">Button</span>
                </span>
            </div>
        </div>
    );
}

/**
 * Vetted Work demo: a crane lifts each permit check that clears; the floor whose training has
 * expired is never built and gets taped off. Plays once when scrolled into view (CSS
 * "Permit crane" in sections-work.css); without JS or with reduced motion it shows the end state.
 */
const FLOORS = [
    ['Contractor qualified', 406],
    ['Insurance & EMR', 332],
    ['JSA acknowledged', 258],
];

function PermitCrane() {
    const ref = useRef(null);
    useEffect(() => {
        const el = ref.current;
        el.dataset.play = 'idle';
        // Start once the scene is on screen AND the swarm has finished building its card.
        const card = el.closest('.build');
        const built = () => !card || card.dataset.stage === 'done';
        let seen = false;
        const go = () => seen && built() && (el.dataset.play = 'on');
        const mo = new MutationObserver(go);
        if (card) mo.observe(card, { attributeFilter: ['data-stage'] });
        const io = new IntersectionObserver(
            ([e]) => {
                if (!e.isIntersecting) return;
                seen = true;
                io.disconnect();
                go();
            },
            { threshold: 0.4 },
        );
        io.observe(el);
        return () => {
            io.disconnect();
            mo.disconnect();
        };
    }, []);

    return (
        <figure ref={ref} className="crane">
            <svg viewBox="0 0 600 500" aria-hidden="true">
                <path className="ln" d="M0 480 H600" />
                {FLOORS.map(([label, y], i) => (
                    <g key={label} className={`floor f${i + 1}`}>
                        <rect x="30" y={y} width="370" height="74" rx="4" />
                        <text x="52" y={y + 46}>
                            {label}
                        </text>
                        <text className="ok" x="378" y={y + 46}>
                            Cleared
                        </text>
                    </g>
                ))}
                <g className="plan">
                    <rect x="30" y="184" width="370" height="74" rx="4" />
                    <text x="52" y="230">
                        Fire watch training
                    </text>
                    <text className="no" x="378" y="230">
                        Expired
                    </text>
                </g>
                <g className="tape">
                    <path className="ln under" d="M20 170 H410" />
                    <path className="ln" d="M20 170 H410" />
                </g>
                <g className="crane-rig">
                    <path className="ln" d="M470 480 V70 M500 480 V70" />
                    <path className="ln thin" d="M470 480 L500 450 L470 420 L500 390 L470 360 L500 330 L470 300 L500 270 L470 240 L500 210 L470 180 L500 150 L470 120 L500 90 L470 60" />
                    <path className="ln" d="M60 60 H560 M60 60 L100 76 H540 M100 76 L130 60 L160 76 L190 60 L220 76 L250 60 L280 76 L310 60 L340 76 L370 60 L400 76 L430 60 L460 76" />
                    <rect className="ln" x="505" y="40" width="26" height="20" rx="2" />
                    <rect className="fill" x="538" y="64" width="34" height="34" rx="2" />
                    <rect className="fill" x="203" y="66" width="24" height="12" rx="2" />
                </g>
                <rect className="cable" x="214" y="78" width="2" height="50" />
                <g className="hook">
                    <circle cx="215" cy="134" r="6" />
                    <path className="bar" d="M185 148 H245" />
                    <path className="sling" d="M200 140 L192 148 M230 140 L238 148" />
                </g>
            </svg>
            <figcaption className="mt-3 text-sm text-muted">
                <span className="font-semibold text-danger">Permit blocked.</span> Fire watch training has expired, so the worker can't start until it's renewed.
                <span className="mt-1 block text-xs">Illustrative example</span>
            </figcaption>
        </figure>
    );
}

/** SmartTube demo: the real home screen on a TV, with the focus ring stepping across cards like a D-pad. */
function SmartTubeTv() {
    return (
        <figure className="tv">
            <div className="tv-screen">
                <img src="/images/projects/smarttube-home.webp" alt="SmartTube home screen on a TV: sidebar, search and recommended videos" width="1600" height="900" loading="lazy" />
                <span aria-hidden="true" className="tv-focus" />
            </div>
            <span aria-hidden="true" className="tv-stand" />
        </figure>
    );
}

// Live demos shown inside a project's card, keyed by project slug.
const DEMOS = { pixora: PixoraCanvas, smarttube: SmartTubeTv, 'vetted-work': PermitCrane };

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-solid';
const linkClass = `inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-sm font-medium text-fg transition-colors hover:border-line-strong hover:bg-surface-2 ${focusRing}`;

function Links({ p, className = '' }) {
    if (!p.live && !p.href) return null;
    return (
        <div className={`flex flex-wrap gap-2 ${className}`}>
            {p.live && (
                <a href={p.live} target="_blank" rel="noreferrer" className={linkClass}>
                    Live<span className="sr-only"> site for {p.title} (opens in a new tab)</span>
                    <span aria-hidden="true" className="text-muted">
                        ↗
                    </span>
                </a>
            )}
            {p.href && (
                <a href={p.href} target="_blank" rel="noreferrer" className={linkClass}>
                    <StackIcon name="github" className="size-3.5" />
                    Source<span className="sr-only"> code for {p.title} on GitHub (opens in a new tab)</span>
                    <span aria-hidden="true" className="text-muted">
                        ↗
                    </span>
                </a>
            )}
        </div>
    );
}

function DetailList({ items, className = '' }) {
    return (
        <ul className={`space-y-2.5 text-sm leading-relaxed text-muted ${className}`}>
            {items.map((d) => (
                <li key={d} className="flex gap-3">
                    <span aria-hidden="true" className="mt-[0.6rem] size-1 shrink-0 rounded-full bg-muted/60" />
                    <span>{d}</span>
                </li>
            ))}
        </ul>
    );
}

function Card({ p, i, span, open, onToggle }) {
    const featured = p.featured;
    const Demo = DEMOS[p.slug];
    // Cards with a live demo are wide: intro + highlights on the left, the demo on the right.
    const wide = !!Demo;

    return (
        <motion.article layout transition={spring} className={span}>
            <Build
                delay={(i % 3) * 120}
                className="project-card h-full rounded-2xl border border-line bg-surface p-6 sm:p-7"
                bodyClass={`h-full ${wide ? 'grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-12' : 'flex flex-col'}`}
            >
                <motion.div layout="position" transition={spring}>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted">
                        {p.year && <span className="font-mono">{p.year}</span>}
                        {featured && <span className="rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent">Featured</span>}
                        {p.org && (
                            <span className="ml-auto inline-flex items-center gap-2">
                                Built at
                                <img src={p.org.logo} alt={p.org.name} width="849" height="391" className="h-6 w-auto rounded-md border border-line bg-white px-1.5 py-0.5" />
                            </span>
                        )}
                    </div>

                    <h3 className={`mt-5 font-semibold tracking-tight text-fg ${wide ? 'text-3xl sm:text-4xl' : 'text-xl'}`}>
                        {p.logo ? <img src={p.logo} alt={p.title} className={`h-auto w-auto ${wide ? 'max-h-12 max-w-52' : 'max-h-8 max-w-40'}`} /> : p.title}
                    </h3>
                    <p className={`mt-3 text-muted ${wide ? 'max-w-md text-lg' : 'text-[15px] leading-relaxed'}`}>{p.summary}</p>
                    <StackChips keys={p.stack} className="mt-5" />
                    {wide && <Links p={p} className="mt-6" />}
                    {wide && (
                        <>
                            <h4 className="mt-8 text-sm font-medium text-fg">Highlights</h4>
                            <DetailList items={p.details} className="mt-4" />
                        </>
                    )}
                </motion.div>

                {wide ? (
                    <div className="lg:self-center">
                        <Demo />
                    </div>
                ) : (
                    <motion.div layout="position" transition={spring} className="mt-auto pt-6">
                        <Links p={p} className="border-t border-line pt-4" />
                        {/* Native <details>: toggles without JS; React drives it so the card can animate. */}
                        <details open={open} className="group/d mt-3">
                            <summary
                                className={`inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md text-sm text-muted transition-colors hover:text-fg [&::-webkit-details-marker]:hidden ${focusRing}`}
                                onClick={(e) => {
                                    e.preventDefault();
                                    onToggle();
                                }}
                            >
                                <span className="group-open/d:hidden">Show details</span>
                                <span className="hidden group-open/d:inline">Hide details</span>
                                <span className="sr-only"> for {p.title}</span>
                                <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5 transition-transform group-open/d:rotate-180 motion-reduce:transition-none">
                                    <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </summary>
                            <DetailList items={p.details} className="mt-4" />
                        </details>
                    </motion.div>
                )}
            </Build>
        </motion.article>
    );
}

// Wide cards take a full row; the rest sit three to a row (lg) or two (md). A short last row is
// stretched so the grid never ends with a hole.
function spans() {
    const normal = projects.filter((p) => !DEMOS[p.slug]).map((p) => p.slug);
    const n = normal.length;
    return Object.fromEntries(
        projects.map((p) => {
            if (DEMOS[p.slug]) return [p.slug, 'md:col-span-2 lg:col-span-6'];
            const k = normal.indexOf(p.slug);
            const lg = n % 3 === 1 && k === n - 1 ? 'lg:col-span-6' : n % 3 === 2 && k >= n - 2 ? 'lg:col-span-3' : 'lg:col-span-2';
            const md = n % 2 === 1 && k === n - 1 ? 'md:col-span-2' : '';
            return [p.slug, `${md} ${lg}`];
        }),
    );
}
const SPAN = spans();

export default function Projects() {
    const [open, setOpen] = useState(null);
    return (
        <section id="work" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-24 sm:px-8 sm:py-32">
            <Build title="Selected work" headingClass="text-3xl font-semibold tracking-tight sm:text-4xl" bodyClass="mt-3 max-w-xl text-muted">
                <p>Products I've designed, built and kept running.</p>
            </Build>
            <MotionConfig reducedMotion="user">
                <LayoutGroup>
                    <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-6">
                        {projects.map((p, i) => (
                            <Card key={p.slug} p={p} i={i} span={SPAN[p.slug]} open={open === p.slug} onToggle={() => setOpen(open === p.slug ? null : p.slug)} />
                        ))}
                    </div>
                </LayoutGroup>
            </MotionConfig>
        </section>
    );
}
