import Build from './Build';
import { achievements, certificates, education } from '../content';

const CARD = 'rounded-2xl border border-line bg-surface p-6 sm:p-8';
const COL = 'text-base font-semibold tracking-tight';

function Logo({ src, org }) {
    const name = org.split(' · ')[0];
    if (src) {
        return <img src={src} alt={`${name} logo`} width="44" height="44" loading="lazy" className="size-11 shrink-0 rounded-xl border border-line bg-white object-contain p-1.5" />;
    }
    return (
        <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-xl border border-line bg-surface-2 text-lg font-semibold text-muted">
            {name[0]}
        </span>
    );
}

export default function About() {
    return (
        <section id="about" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-24 sm:px-8 sm:py-32">
            <Build title="The paper trail" headingClass="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl" bodyClass="mt-3 max-w-xl text-muted">
                <p>Where I studied, what I certified, and where I put my projects in front of people.</p>
            </Build>

            <div className="mt-12 grid gap-4 sm:gap-6 lg:grid-cols-12">
                <Build title="Education" heading="h3" headingClass={COL} className={`${CARD} lg:col-span-7`} bodyClass="mt-6">
                    <ol className="space-y-6">
                        {education.map((e) => (
                            <li key={e.title} className="flex gap-4">
                                <Logo src={e.logo} org={e.org} />
                                <div>
                                    <p className="font-medium leading-snug">{e.title}</p>
                                    <p className="mt-1 text-sm text-muted">{e.org}</p>
                                    <p className="mt-1.5 font-mono text-xs text-muted">{e.when}</p>
                                    {e.awards && (
                                        <ul aria-label="Scholarships" className="mt-4 space-y-3 border-l border-line pl-4">
                                            {e.awards.map((a) => (
                                                <li key={a.title} className="flex flex-col gap-3 sm:flex-row sm:items-start">
                                                    {a.image && (
                                                        <img src={a.image} alt="AAA Scholarship, Itahari International College" width="1600" height="850" loading="lazy" className="w-full max-w-56 shrink-0 rounded-lg border border-line sm:w-36" />
                                                    )}
                                                    <div>
                                                        <p className="text-sm font-medium leading-snug">{a.title}</p>
                                                        {a.text && <p className="mt-1 text-sm text-muted">{a.text}</p>}
                                                        <p className="mt-1 font-mono text-xs text-muted">{a.when}</p>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ol>
                </Build>

                <div className="grid gap-4 sm:gap-6 lg:col-span-5">
                    <Build title="Certificates" heading="h3" headingClass={COL} className={CARD} bodyClass="mt-3" delay={120}>
                        <ul className="divide-y divide-line">
                            {certificates.map((c) => (
                                <li key={c.title}>
                                    <a href={c.href} target="_blank" rel="noopener noreferrer" className="group flex items-baseline justify-between gap-4 py-3 text-sm transition-colors hover:text-accent">
                                        <span>{c.title}</span>
                                        <span aria-hidden="true" className="text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent">
                                            ↗
                                        </span>
                                        <span className="sr-only"> (LinkedIn, opens in a new tab)</span>
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </Build>

                    <Build title="On stage" heading="h3" headingClass={COL} className={CARD} bodyClass="mt-4" delay={240}>
                        <ul className="space-y-3 text-sm">
                            {achievements.map((a) => (
                                <li key={a.title} className="grid gap-1 sm:grid-cols-[6rem_1fr] sm:gap-4">
                                    <span className="font-mono text-xs text-muted sm:pt-0.5">{a.when}</span>
                                    <span>{a.title}</span>
                                </li>
                            ))}
                        </ul>
                    </Build>
                </div>
            </div>
        </section>
    );
}
