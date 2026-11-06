Build my personal portfolio website in this Laravel 13 project (`pawal_portfolio`: Blade + Vite + Tailwind CSS 4).

Source of truth: `portfolio-assets/profile.json` (my CV details) and `portfolio-assets/logos/` (SVG tech-stack icons in `logos/stack/<name>.svg`, company/school logos in `logos/company/`). Copy the logos you use into `public/` and render everything from the JSON — no hardcoded copy in Blade.

One page, sections in this order:
1. Hero: name, role, one-line summary, buttons for GitHub / LinkedIn / email.
2. Experience: timeline with company logo (initial-letter fallback where `logo` is null), title, period, highlights, small stack icons.
3. Projects: cards with description, stack icons, repo link.
4. Skills: grouped icon grid by category with tooltips.
5. Education, certificates, achievements.
6. Contact: email, phone, location, links.

Design: distinctive and modern, dark/light toggle, responsive from 360px, accessible (alt text, contrast, focus states), tasteful motion only. Tint the monochrome SVG icons with CSS (`currentColor` / mask) instead of adding more image files.

Constraints: Blade + Tailwind only, no new PHP packages, route `/` in `routes/web.php`. Run `npm run build` and `php artisan serve`, then check mobile and desktop widths in a browser before finishing.
