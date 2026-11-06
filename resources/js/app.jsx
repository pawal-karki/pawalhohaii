import { createInertiaApp } from '@inertiajs/react';

createInertiaApp({ pages: './Pages', title: (t) => (t ? `${t} — Pawal` : 'Pawal') });
