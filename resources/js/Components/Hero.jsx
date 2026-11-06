import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import Build from './Build';
import { MailIcon, SocialLinks } from './Contact';
import NepalMap, { photoLanded } from './NepalMap';
import { experience, profile } from '../content';
import { startFollowing } from '../swarm';
import { asset } from '../asset';


const now = experience[0];

export default function Hero() {
    const ref = useRef(null);
    const still = useReducedMotion();
    const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
    const mapY = useTransform(scrollYProgress, [0, 1], [0, still ? 0 : 60]);

    return (
        <section id="top" ref={ref} className="relative isolate flex min-h-[100svh] items-center overflow-hidden pt-32 pb-[32vw]">
            <motion.div style={{ y: mapY }} className="hero-map absolute top-28 right-[-45%] -z-10 aspect-[1240/780] w-[150vw] sm:top-32 sm:right-[-10%] sm:w-[min(95vw,900px)] xl:right-[-2%]">
                <NepalMap />
            </motion.div>
            {/* Pointer events pass through the empty space here so the map behind stays explorable. */}
            <div className="pointer-events-none mx-auto w-full max-w-6xl px-5 *:pointer-events-auto sm:px-8">
                <a href="#experience" className="group inline-flex items-center gap-2.5 rounded-full border border-line bg-bg py-1 pr-3.5 pl-3 text-sm text-muted transition-colors hover:border-line-strong hover:bg-surface-2">
                    <span className="live-dot" aria-hidden="true" />
                    <span>
                        Currently at <span className="font-medium text-fg">{now.org}</span>
                    </span>
                </a>

                <h1 className="hero-name mt-6 font-semibold">{profile.name}</h1>
                <p className="mt-4 text-lg text-muted sm:text-xl">
                    {profile.role} <span aria-hidden="true">·</span> {profile.location}
                </p>

                <Build title={profile.headline} heading="p" after={photoLanded} delay={150} onBuilt={startFollowing} className="mt-10 max-w-2xl" headingClass="text-[clamp(1.375rem,2.6vw,1.875rem)] leading-snug font-medium tracking-[-0.02em] text-fg" bodyClass="mt-4">
                    <p className="text-base text-muted sm:text-lg">{profile.intro}</p>
                    <div className="mt-8 flex flex-wrap items-center gap-3">
                        <a href="#work" className="inline-flex items-center gap-2 rounded-full bg-fg px-5 py-2.5 font-medium text-bg transition-opacity hover:opacity-85">
                            View work <span aria-hidden="true">→</span>
                        </a>
                        <a href={profile.cv} download className="inline-flex items-center gap-2 rounded-full border border-line bg-bg px-5 py-2.5 font-medium transition-colors hover:border-line-strong hover:bg-surface-2">
                            Download CV <span className="font-mono text-xs text-muted">PDF</span>
                        </a>
                        <div className="flex gap-2">
                            <SocialLinks icons className="flex-nowrap" />
                            <a
                                href={`mailto:${profile.email}`}
                                className="inline-flex size-10 items-center justify-center rounded-full border border-line text-muted transition-colors hover:border-line-strong hover:bg-surface-2 hover:text-fg"
                            >
                                <MailIcon className="size-4" />
                                <span className="sr-only">Email {profile.email}</span>
                            </a>
                        </div>
                    </div>
                </Build>
            </div>

            {/* Background skyline, full image at its natural size along the bottom of the hero: day in light
                mode, night in dark mode (the hidden one is never downloaded). Its top softly blurs and fades
                into the page so the text above stays readable. The section's bottom padding (32vw, about 85% of
                the image's 37.5vw height) keeps the buildings below the text; only sky and peaks sit behind it. */}
            <div aria-hidden="true" className="hero-sky pointer-events-none absolute inset-x-0 bottom-0 -z-20">
                {[
                    ['/images/nepal-skyline-colour.webp', 750, 'hero-sky-light'],
                    ['/images/nepal-skyline-colour-dark.webp', 667, 'hero-sky-dark'],
                ].map(([src, height, theme]) => (
                    <img key={theme} src={asset(src)} alt="" width="2000" height={height} loading="lazy" className={`${theme} absolute inset-x-0 bottom-0 h-auto w-full`} />
                ))}
                <div className="hero-sky-blur" />
            </div>
        </section>
    );
}
