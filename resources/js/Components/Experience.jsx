import { useRef } from 'react';
import { motion, useScroll } from 'motion/react';
import Build from './Build';
import { StackChips } from './Projects';
import { experience } from '../content';

function NowChip() {
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2 py-0.5 text-xs font-medium text-fg">
            <span aria-hidden="true" className="relative flex size-1.5">
                <span className="absolute inset-0 rounded-full bg-success opacity-60 motion-safe:animate-ping" />
                <span className="relative size-1.5 rounded-full bg-success" />
            </span>
            Now
        </span>
    );
}

/** "Lead: rest" highlights get the lead set in the foreground colour. */
function Highlight({ text }) {
    const at = text.indexOf(': ');
    if (at < 0) return text;
    return (
        <>
            <span className="font-medium text-fg">{text.slice(0, at)}</span>
            {text.slice(at)}
        </>
    );
}

function Logo({ e }) {
    if (e.logoDark) {
        return (
            <>
                <img src={e.logoDark} alt={e.org} className="logo-on-dark h-[18px] w-auto" />
                <img src={e.logo} alt={e.org} className="logo-on-light h-[18px] w-auto" />
            </>
        );
    }
    if (e.logo) return <img src={e.logo} alt={e.org} className="h-8 w-auto rounded-md border border-line bg-white px-2 py-1" />;
    return <span className="font-medium">{e.org}</span>;
}

export default function Experience() {
    const rail = useRef(null);
    const { scrollYProgress } = useScroll({ target: rail, offset: ['start 75%', 'end 60%'] });

    return (
        <section id="experience" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-24 sm:px-8 sm:py-32">
            <Build title="Experience" headingClass="text-3xl font-semibold tracking-tight sm:text-4xl" bodyClass="mt-3 max-w-xl text-muted">
                <p>Where I've worked and what I shipped there.</p>
            </Build>
            <div ref={rail} className="xp relative mt-12">
                <span aria-hidden="true" className="xp-rail" />
                <motion.span aria-hidden="true" className="xp-progress" style={{ scaleY: scrollYProgress }} />
                <ol className="space-y-8 sm:space-y-10">
                    {experience.map((e, i) => {
                        const now = e.when.includes('now');
                        return (
                            <li key={e.org}>
                                <Build delay={i * 120} bodyClass="xp-item">
                                    <div className="xp-when flex flex-wrap items-center gap-3 font-mono text-sm text-muted md:flex-col md:items-end md:gap-2 md:pt-8">
                                        <span>{e.when}</span>
                                        {now && <NowChip />}
                                    </div>

                                    <span aria-hidden="true" className={`xp-node ${now ? 'is-now' : ''}`} />

                                    <div className="xp-main rounded-2xl border border-line bg-surface p-6 sm:p-7">
                                        <p className="flex min-h-8 items-center">
                                            <Logo e={e} />
                                        </p>
                                        <h3 className="mt-4 text-xl font-semibold tracking-tight text-fg">{e.role}</h3>
                                        <p className="mt-2 text-muted">{e.text}</p>
                                        <ul className="mt-5 max-w-2xl space-y-2.5 border-t border-line pt-5 text-[15px] leading-relaxed text-muted">
                                            {e.highlights.map((h) => (
                                                <li key={h} className="flex gap-3">
                                                    <span aria-hidden="true" className="mt-[0.65rem] size-1 shrink-0 rounded-full bg-muted/60" />
                                                    <span>
                                                        <Highlight text={h} />
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                        <StackChips keys={e.stack} className="mt-5" />
                                    </div>
                                </Build>
                            </li>
                        );
                    })}
                </ol>
            </div>
        </section>
    );
}
