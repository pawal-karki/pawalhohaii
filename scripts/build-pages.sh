#!/usr/bin/env bash
# Render the portfolio to static files in dist/ for GitHub Pages.
# Run after `npm run build`, with ASSET_URL set for both steps to where the site is served
# (e.g. https://www.pawal.com.np). For <user>.github.io/<repo>, use /<repo> and set VITE_PUBLIC_BASE too.
# Laravel + Inertia SSR render the page once, so the static HTML is the real server output.
set -euo pipefail
: "${ASSET_URL:?set ASSET_URL to the site URL, e.g. https://www.pawal.com.np}"
PORT="${PORT:-8765}"

php artisan inertia:start-ssr >/dev/null 2>&1 &
# Plain `php -S`, not `artisan serve`: the latter drops env vars such as ASSET_URL and APP_URL.
(cd public && exec php -S "127.0.0.1:$PORT" ../vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php >/dev/null 2>&1) &
trap 'php artisan inertia:stop-ssr >/dev/null 2>&1 || true; pkill -f "127.0.0.1:$PORT" || true' EXIT

for _ in $(seq 1 30); do curl -sf http://127.0.0.1:13714/health >/dev/null && curl -sf "http://127.0.0.1:$PORT/up" >/dev/null && break; sleep 1; done

rm -rf dist
cp -R public dist
rm -f dist/index.php dist/hot dist/.htaccess dist/fonts-manifest.dev.json

curl -sf "http://127.0.0.1:$PORT/" -o dist/index.html
grep -q 'data-server-rendered' dist/index.html || { echo 'SSR output missing: is the SSR server running?' >&2; exit 1; }

# Inertia rewrites the address bar to page.url on boot; keep it on the Pages sub-path, if any.
php -r '
$f = "dist/index.html"; $base = (string) parse_url(getenv("ASSET_URL"), PHP_URL_PATH);
$html = preg_replace_callback("#(<script[^>]*data-page[^>]*>)(.*?)(</script>)#s", function ($m) use ($base) {
    $page = json_decode($m[2], true);
    $page["url"] = rtrim($base, "/") . "/";
    return $m[1] . json_encode($page, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG) . $m[3];
}, file_get_contents($f), 1, $count);
if ($count !== 1) { fwrite(STDERR, "Inertia page data not found\n"); exit(1); }
file_put_contents($f, $html);
'
echo "dist/ ready"
