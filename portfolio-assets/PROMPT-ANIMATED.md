Build my developer portfolio in this Laravel 13 project (`pawal_portfolio`: Blade + Vite + Tailwind CSS 4). Content comes from `portfolio-assets/profile.json`; icons from `portfolio-assets/logos/` (copy the ones you use into `public/`). Render everything from the JSON, no hardcoded copy.

## Concept: "The page that builds itself" — a swarm of named cursors
Signature idea: a flock of multiplayer-style cursors (each with a name tag: "Laravel", "Next.js", "Claude", "Prisma", "Stripe"… my real stack) that assemble the portfolio live as you scroll — dragging crosshair boxes that become cards, typing headings with a blinking caret, snapping to ruler guides — then flock around the visitor's mouse once the page is done. Think Figma multiplayer, not particles.
IMPORTANT: `DhvanilPatel/swarm-cursors` is a Chrome extension (no npm package, no license) adapted from Joel Califa's Swarm site (also unlicensed). Do NOT copy or vendor its code. Use it only as inspiration for the idea, write an original implementation, and add a credit line in the footer: "Cursor-swarm idea inspired by Joel Califa's Swarm."

## Stack
- Add React 19 + `@vitejs/plugin-react` and the `motion` package (Framer Motion, import from `motion/react`) to Vite. Keep Blade for the page shell/SEO; mount React "islands" for: Swarm layer, Hero, Experience timeline, Projects, Skills. Data is passed from Laravel as JSON props.
- No other new libraries. No new PHP packages. Route `/` only.

## Color scheme: "Himalayan Dusk" (define as CSS variables in Tailwind 4 `@theme`)
- ink `#0C0D11` (dark base) · snow `#F4F1EA` (light base) · slate `#1A1C24` (surfaces)
- saffron `#FF6A2B` (primary accent, CTAs, my cursor) · glacier `#6EE7E0` (secondary) · prayer-violet `#8B7CFF` (tertiary) · lichen `#B7F06A` (success/links hover)
- Each swarm cursor takes one of the accents. Dark by default, light toggle, persisted in localStorage, respects `prefers-color-scheme`. Contrast AA minimum.

## Animation (Framer Motion)
- Page load: blank canvas → cursors fly in on spring paths, crosshair-drag rectangles with a live `W × H` badge, then content fades in from a gray placeholder.
- Headings typed by a cursor with caret; big headings scale up as they type.
- Scroll-driven: `useScroll` + `useTransform` for parallax, section reveals with `whileInView`, shared `layoutId` transitions when a project card expands to a detail view.
- Stack icons orbit/magnetize toward the real cursor (`useMotionValue` + `useSpring`); the swarm's flocking (separation, alignment, mouse-avoidance) runs in a single `requestAnimationFrame` loop outside React state for 60fps.
- Skills grid: staggered spring entrance, tooltip on hover, icons tinted via CSS mask/`currentColor`.
- Micro-interactions: magnetic buttons, custom cursor ring, subtle noise grain, view-transition feel between sections.
- Optional tiny Web Audio click/typing sounds, OFF by default with a toggle.
- Accessibility: honour `prefers-reduced-motion` (swarm replaced by a static, fully visible page), swarm layer is `aria-hidden`, content is real HTML readable without JS, keyboard focus states, mobile (touch devices get a lighter swarm of ≤4 cursors).

## Sections
Hero (name, role, summary, GitHub/LinkedIn/email, Download CV) → Experience timeline (company logo, initial fallback when `logo` is null, highlights, stack icons) → Projects (cards, stack icons, repo links) → Skills (grouped icon grid) → Education/certificates/achievements → Contact.

## Delivery
`npm run build` and `php artisan serve` must work. Check in a browser at 360px, 768px and 1440px, in dark and light, with reduced-motion on and off; keep Lighthouse performance ≥ 90 and no layout shift from the swarm. Fix anything that looks generic or "template-y" before finishing.
