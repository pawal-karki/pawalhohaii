import { useEffect, useRef } from 'react';
import { motion, useSpring } from 'motion/react';
import Build from './Build';
import StackIcon from './StackIcon';
import { BRAND, STACK, skills } from '../content';

// Near-black brands (Next.js, Vercel, GitHub, Prisma, Django, Radix) would vanish on the dark theme.
const isDark = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.25;
};

const RADIUS = 140;
const MAX_PULL = 5;
const SPRING = { stiffness: 200, damping: 20, mass: 0.6 };

function Chip({ id, register }) {
    const ref = useRef(null);
    const x = useSpring(0, SPRING);
    const y = useSpring(0, SPRING);
    useEffect(() => register({ el: ref.current, x, y }), []);

    return (
        <motion.li ref={ref} style={{ x, y, '--brand': BRAND[id] }} data-dark-brand={isDark(BRAND[id]) || undefined} className="toolkit-chip">
            <StackIcon name={id} className="toolkit-icon size-4" />
            <span>{STACK[id]}</span>
        </motion.li>
    );
}

export default function Skills() {
    const chips = useRef([]);
    const register = (t) => {
        chips.current.push(t);
        return () => (chips.current = chips.current.filter((o) => o !== t));
    };

    // Chips lean a few px toward a nearby mouse pointer (skipped for touch and reduced motion).
    const pull = (e) => {
        if (e.pointerType !== 'mouse' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        for (const { el, x, y } of chips.current) {
            const r = el.getBoundingClientRect();
            const dx = e.clientX - (r.left + r.width / 2);
            const dy = e.clientY - (r.top + r.height / 2);
            const d = Math.hypot(dx, dy) || 1;
            const px = Math.max(0, 1 - d / RADIUS) ** 2 * Math.min(d * 0.4, MAX_PULL);
            x.set((dx / d) * px);
            y.set((dy / d) * px);
        }
    };
    const reset = () => chips.current.forEach(({ x, y }) => (x.set(0), y.set(0)));

    return (
        <section id="skills" onPointerMove={pull} onPointerLeave={reset} className="mx-auto max-w-6xl scroll-mt-24 px-5 py-24 sm:px-8 sm:py-32">
            <Build title="Toolkit" headingClass="text-3xl font-semibold tracking-tight text-fg sm:text-4xl" bodyClass="mt-3 max-w-xl text-muted">
                <p>The flock that built this page, plus a few friends.</p>
            </Build>
            <div className="mt-10 border-b border-line sm:mt-14">
                {skills.map((g, gi) => (
                    <Build key={g.group} title={g.group} heading="h3" delay={gi * 90} className="toolkit-row" headingClass="toolkit-group">
                        <ul className="toolkit-chips">
                            {g.items.map((id) => (
                                <Chip key={id} id={id} register={register} />
                            ))}
                        </ul>
                    </Build>
                ))}
            </div>
        </section>
    );
}
