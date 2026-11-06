<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" data-theme="dark">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="dark light">
    <meta name="theme-color" content="#09090B" media="(prefers-color-scheme: dark)">
    <meta name="theme-color" content="#FFFFFF" media="(prefers-color-scheme: light)">
    @php($description = 'Pawal Karki Dholi, full-stack developer in Itahari, Nepal. Laravel and PHP on the back, Next.js and TypeScript on the front; currently building AI-assisted reporting and compliance features at Vetted Work.')
    <meta name="description" content="{{ $description }}">
    <meta name="author" content="Pawal Karki Dholi">
    <link rel="canonical" href="{{ rtrim(config('app.url'), '/') }}/">
    <meta property="og:type" content="profile">
    <meta property="og:site_name" content="Pawal Karki Dholi">
    <meta property="og:title" content="Pawal Karki Dholi — Full-stack developer">
    <meta property="og:description" content="{{ $description }}">
    <meta property="og:url" content="{{ rtrim(config('app.url'), '/') }}/">
    <meta property="profile:first_name" content="Pawal">
    <meta property="profile:last_name" content="Karki Dholi">
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="Pawal Karki Dholi — Full-stack developer">
    <meta name="twitter:description" content="{{ $description }}">
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%2309090B'/%3E%3Ctext x='16' y='22' font-family='Inter,system-ui,sans-serif' font-size='16' font-weight='600' fill='%23FAFAFA' text-anchor='middle'%3EPK%3C/text%3E%3C/svg%3E">
    {{-- Before paint: mark JS as present (enables build animations) and apply the saved theme, else the OS preference. --}}
    <script>
        document.documentElement.classList.add('js');
        (function () {
            var t;
            try { t = localStorage.theme; } catch (e) {}
            if (t !== 'light' && t !== 'dark') t = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
            document.documentElement.dataset.theme = t;
        })();
    </script>
    @fonts
    @viteReactRefresh
    @vite(['resources/css/app.css', 'resources/js/app.jsx'])
    @inertiaHead
</head>
<body>
    @inertia
</body>
</html>
