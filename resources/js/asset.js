// Public files sit at the site root under Laravel, and under the repo path on GitHub Pages
// when hosted on <user>.github.io/<repo> (build with VITE_PUBLIC_BASE=/<repo>). Use for every /logos, /images, /data path.
export const asset = (path) => `${import.meta.env.VITE_PUBLIC_BASE ?? ''}${path}`;
