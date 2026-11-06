import { useEffect, useRef, useState } from 'react';
import { Head } from '@inertiajs/react';
import { MotionConfig, motion, useScroll } from 'motion/react';
import Swarm from '../Components/Swarm';
import ThemeToggle from '../Components/ThemeToggle';
import Hero from '../Components/Hero';
import Projects from '../Components/Projects';
import Experience from '../Components/Experience';
import Skills from '../Components/Skills';
import About from '../Components/About';
import Contact, { SocialLinks } from '../Components/Contact';
import { profile } from '../content';

const NAV = [
    ['Work', 'work'],
    ['Experience', 'experience'],
    ['Toolkit', 'skills'],
    ['About', 'about'],
    ['Contact', 'contact'],
];

const initials = profile.name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('');

/** Id of the section crossing the middle of the viewport ('top' = hero, so no link is highlighted). */
function useActiveSection() {
    const [active, setActive] = useState(null);
    useEffect(() => {
        const io = new IntersectionObserver((entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)), { rootMargin: '-45% 0px -54% 0px' });
        ['top', ...NAV.map(([, id]) => id)].forEach((id) => {
            const el = document.getElementById(id);
            if (el) io.observe(el);
        });
        // The last section is too short to reach the mid-viewport band: at the bottom, it's active.
        const onScroll = () => innerHeight + scrollY >= document.documentElement.scrollHeight - 4 && setActive(NAV.at(-1)[1]);
        addEventListener('scroll', onScroll, { passive: true });
        return () => {
            io.disconnect();
            removeEventListener('scroll', onScroll);
        };
    }, []);
    return active;
}

function MobileMenu({ active, root }) {
    const [open, setOpen] = useState(false);
    const button = useRef(null);

    useEffect(() => {
        if (!open) return;
        const onKey = (e) => {
            if (e.key !== 'Escape') return;
            setOpen(false);
            button.current?.focus();
        };
        const onDown = (e) => {
            if (!root.current?.contains(e.target)) setOpen(false);
        };
        document.addEventListener('keydown', onKey);
        document.addEventListener('pointerdown', onDown);
        return () => {
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('pointerdown', onDown);
        };
    }, [open]);

    return (
        <div className="sm:hidden">
            <button
                ref={button}
                type="button"
                aria-expanded={open}
                aria-controls="mobile-nav"
                onClick={() => setOpen(!open)}
                className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
                <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 9h16M4 15h16" />}
                </svg>
            </button>
            <div id="mobile-nav" hidden={!open} className="absolute inset-x-0 top-full mt-2 rounded-2xl border border-line bg-bg p-2 shadow-[var(--shadow)]">
                <ul>
                    {NAV.map(([label, id]) => (
                        <li key={id}>
                            <a
                                href={`#${id}`}
                                onClick={() => setOpen(false)}
                                aria-current={active === id ? 'true' : undefined}
                                className={`flex items-center justify-between rounded-xl px-3 py-3 text-base font-medium transition-colors hover:bg-surface-2 hover:text-fg ${active === id ? 'text-fg' : 'text-muted'}`}
                            >
                                {label}
                                {active === id && <span aria-hidden="true" className="size-1.5 rounded-full bg-accent-solid" />}
                            </a>
                        </li>
                    ))}
                </ul>
                <a href={profile.cv} download onClick={() => setOpen(false)} className="mt-2 flex justify-center rounded-xl bg-fg px-4 py-2.5 text-sm font-medium text-bg transition-opacity hover:opacity-85">
                    Download resume
                </a>
            </div>
        </div>
    );
}

function NavBar() {
    const active = useActiveSection();
    const root = useRef(null);

    return (
        <header className="fixed inset-x-0 top-4 z-40 px-4">
            {/* Floating pill: the blur only keeps links legible over whatever scrolls underneath. */}
            <nav ref={root} aria-label="Primary" className="relative mx-auto flex items-center justify-between gap-1 rounded-full border border-line bg-bg/80 p-1.5 shadow-[var(--shadow)] backdrop-blur-md sm:w-fit">
                <a href="#main" className="flex items-center gap-2.5 rounded-full p-0.5 sm:mr-2 lg:pr-3">
                    <span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-fg text-xs font-semibold tracking-tight text-bg">
                        {initials}
                    </span>
                    <span className="pr-2 text-sm font-semibold tracking-tight sm:sr-only lg:not-sr-only lg:pr-0">{profile.short}</span>
                </a>
                <ul className="hidden items-center sm:flex">
                    {NAV.map(([label, id]) => (
                        <li key={id}>
                            <a
                                href={`#${id}`}
                                aria-current={active === id ? 'true' : undefined}
                                className={`relative isolate block rounded-full px-3 py-1.5 text-sm font-medium transition-colors hover:text-fg ${active === id ? 'text-fg' : 'text-muted'}`}
                            >
                                {active === id && (
                                    <motion.span layoutId="nav-active" aria-hidden="true" transition={{ type: 'spring', bounce: 0.18, duration: 0.45 }} className="absolute inset-0 -z-10 rounded-full bg-surface-2" />
                                )}
                                {label}
                            </a>
                        </li>
                    ))}
                </ul>
                <div className="flex items-center gap-1 sm:ml-2">
                    <ThemeToggle />
                    <a href={profile.cv} download className="hidden rounded-full bg-fg px-3.5 py-1.5 text-sm font-medium text-bg transition-opacity hover:opacity-85 md:inline-flex">
                        Resume
                    </a>
                    <MobileMenu active={active} root={root} />
                </div>
            </nav>
        </header>
    );
}

export default function Home() {
    const { scrollYProgress } = useScroll();

    return (
        <MotionConfig reducedMotion="user">
            <Head title={profile.role} />
            <a href="#main" className="sr-only z-[70] rounded-full bg-fg px-4 py-2 text-sm font-medium text-bg focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
                Skip to content
            </a>
            <motion.div aria-hidden="true" style={{ scaleX: scrollYProgress }} className="fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-accent-solid" />
            <NavBar />
            <main id="main">
                <Hero />
                <Projects />
                <Experience />
                <Skills />
                <About />
                <Contact />
            </main>
            <footer className="relative isolate overflow-hidden border-t border-line">
                {[
                    ['/images/nepal-skyline-reflection.jpg', 660, 'skyline-light'],
                    ['/images/nepal-skyline-reflection-dark.jpg', 620, 'skyline-dark'],
                ].map(([src, height, theme]) => (
                    <img
                        key={theme}
                        src={src}
                        alt=""
                        aria-hidden="true"
                        width="2000"
                        height={height}
                        loading="lazy"
                        className={`footer-skyline ${theme} pointer-events-none mx-auto -mb-24 block h-auto w-full max-w-[1600px] sm:-mb-40`}
                    />
                ))}
                <div className="relative mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1fr_auto] md:items-end">
                    <div>
                        <p className="text-lg font-semibold tracking-tight">{profile.name}</p>
                        <p className="mt-2 max-w-md text-sm text-muted">
                            Built with Laravel, Inertia and React, by a flock of cursors. Cursor-swarm idea inspired by{' '}
                            <a href="https://joelcalifa.com/" target="_blank" rel="noopener noreferrer" className="text-fg underline decoration-line-strong underline-offset-4 transition-colors hover:text-accent hover:decoration-current">
                                Joel Califa
                            </a>
                            ’s Swarm.
                        </p>
                        <SocialLinks className="mt-6" />
                    </div>
                    <nav aria-label="Footer" className="text-sm text-muted">
                        <ul className="flex flex-wrap gap-x-5 gap-y-2 md:justify-end">
                            {NAV.map(([label, id]) => (
                                <li key={id}>
                                    <a href={`#${id}`} className="transition-colors hover:text-fg">
                                        {label}
                                    </a>
                                </li>
                            ))}
                            <li>
                                <a href="#main" className="transition-colors hover:text-fg">
                                    Back to top <span aria-hidden="true">↑</span>
                                </a>
                            </li>
                        </ul>
                        <p className="mt-4 text-xs md:text-right">
                            © {new Date().getFullYear()} {profile.name}
                        </p>
                    </nav>
                </div>
            </footer>
            <Swarm />
        </MotionConfig>
    );
}
