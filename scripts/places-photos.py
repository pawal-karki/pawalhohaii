"""Download one Wikimedia Commons photo per travel destination (DESTINATIONS in resources/js/content.js), the
lead image of the place's Wikipedia article, into public/images/places/<slug>.webp, and write
public/data/places.json {place: {img, credit, license, source}} for the map card's credit line.
Run from the repo: python3 -I scripts/places-photos.py .   (needs cwebp; sips is macOS)
Re-running skips places already in places.json; delete an entry (or adjust QUERY) to pick again."""
import time, urllib.error, json, re, subprocess, sys, urllib.parse, urllib.request, pathlib, html

repo = pathlib.Path(sys.argv[1])
src = (repo / 'resources/js/content.js').read_text()
block = src[src.index('export const DESTINATIONS'):]
names = re.findall(r"'([^']+)'", block[: block.index('};')])

# Search phrase where the label isn't a good Wikipedia query.
QUERY = {
    'Itahari, home': 'Itahari',
    'Lumbini, birthplace of the Buddha': 'Lumbini',
    'Ilam tea gardens': 'Ilam tea garden',
    'Simikot, gateway to Mount Kailash': 'Simikot',
    'Tatopani hot springs': 'Tatopani Myagdi',
    'Golden Temple': 'Golden Temple Patan Hiranya Varna Mahavihar',
    'Daman': 'Daman Makwanpur',
    'Sagarmatha (Mount Everest)': 'Mount Everest',
    'Rani Mahal': 'Rani Mahal Palpa',
    'Kanyam': 'Kanyam Ilam',
    'Antu Danda': 'Antu Danda Ilam',
}
# Exact Wikipedia article where search picks the wrong one (falls back to search if it has no photo).
TITLE = {
    'Sagarmatha (Mount Everest)': 'Mount Everest',
    'Chitlang': 'Chitlang',
    'World Peace Pagoda': 'Shanti Stupa, Pokhara',
    'Gorkha Durbar': 'Gorkha Durbar',
    'Lo Manthang': 'Lo Manthang',
    'Tatopani hot springs': 'Tatopani, Myagdi',
    'Barahakshetra Temple': 'Barahachhetra',
    'Bandipur': 'Bandipur, Tanahun',
    'Kanyam': 'Kanyam',
    'Antu Danda': 'Antu Danda',
    'Nuwakot Durbar': 'Nuwakot Durbar',
    'Annapurna Base Camp': 'Annapurna Sanctuary',
    'Kyanjin Gompa': 'Kyanjin Gompa',
    'Ilam tea gardens': 'Ilam',
}
# Search Wikimedia Commons photos directly where the article's lead image is a map, text or painting.
COMMONS = {
    'Chitlang': 'Chitlang village Makwanpur',
    'Shey Phoksundo Lake': 'Phoksundo Lake',
    'Patan Durbar Square': 'Patan Durbar Square temples',
}
UA = {'User-Agent': 'pawal-portfolio-build/1.0 (portfolio image fetch)'}


def fetch(url):
    for wait in (2, 5, 15, 30, 60):
        time.sleep(1)
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA)).read()
        except urllib.error.HTTPError as e:
            if e.code != 429:
                raise
            time.sleep(wait)
    raise SystemExit('rate limited: ' + url)


def get(url):
    return json.loads(fetch(url))


def api(**p):
    p.update(format='json', formatversion=2)
    return get('https://en.wikipedia.org/w/api.php?' + urllib.parse.urlencode(p))


def strip(s):
    return html.unescape(re.sub(r'<[^>]+>', '', s or '')).strip()


out_dir = repo / 'public/images/places'
out_dir.mkdir(parents=True, exist_ok=True)
out = repo / 'public/data/places.json'
result = json.loads(out.read_text()) if out.exists() else {}
for name in names:
    if name in result:
        continue
    q = QUERY.get(name, name)
    slug = re.sub(r'[^a-z0-9]+', '-', q.lower()).strip('-')
    pages = []
    if name in COMMONS:
        hits = get('https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode(dict(
            action='query', format='json', formatversion=2, generator='search', gsrnamespace=6, gsrlimit=10,
            gsrsearch=COMMONS[name] + ' filetype:bitmap', prop='imageinfo', iiprop='url|extmetadata|mime|size', iiurlwidth=640)))
        hits = sorted((h for h in hits.get('query', {}).get('pages', []) if h['imageinfo'][0]['mime'] == 'image/jpeg' and h['imageinfo'][0]['width'] > h['imageinfo'][0]['height'] * 1.2), key=lambda h: h['index'])  # landscape photos only
        if hits:
            h = hits[0]
            info = h['imageinfo'][0]
            pages = [{'title': h['title'], 'pageimage': h['title'][5:], 'index': 0, 'thumbnail': {'source': info['thumburl']}}]
    if not pages and name in TITLE:
        pages = api(action='query', titles=TITLE[name], redirects=1, prop='pageimages|info', piprop='thumbnail|name',
                    pithumbsize=640, inprop='url').get('query', {}).get('pages', [])
        for pg in pages:
            pg['index'] = 0
    pages = [p for p in pages if p.get('thumbnail')] or api(action='query', generator='search', gsrsearch=q + ' Nepal', gsrlimit=5, prop='pageimages|info',
                piprop='thumbnail|name', pithumbsize=640, inprop='url').get('query', {}).get('pages', [])
    pages = sorted((p for p in pages if p.get('thumbnail') and not p['pageimage'].lower().endswith('.svg')), key=lambda p: p['index'])
    if not pages:
        print('NO IMAGE', name)
        continue
    page = pages[0]
    meta = api(action='query', titles='File:' + page['pageimage'], prop='imageinfo', iiprop='extmetadata|url')['query']['pages'][0]
    info = meta['imageinfo'][0]
    em = info.get('extmetadata', {})
    webp = out_dir / (slug + '.webp')
    if not webp.exists():
        jpg = out_dir / (slug + '.src')
        jpg.write_bytes(fetch(page['thumbnail']['source']))
        # sips normalises formats cwebp can't read (gif, cmyk jpeg...).
        subprocess.run(['sips', '-s', 'format', 'png', str(jpg), '--out', str(jpg) + '.png'], check=True, capture_output=True)
        subprocess.run(['cwebp', '-quiet', '-q', '72', '-resize', '480', '0', str(jpg) + '.png', '-o', str(webp)], check=True)
        jpg.unlink()
        pathlib.Path(str(jpg) + '.png').unlink()
    result[name] = {
        'img': f'/images/places/{slug}.webp',
        'page': page['title'],
        'credit': strip(em.get('Artist', {}).get('value')) or 'Wikimedia Commons',
        'license': strip(em.get('LicenseShortName', {}).get('value')),
        'source': info['descriptionurl'],
    }
    print(f"{name:40} -> {page['title']:40} {result[name]['license']}", flush=True)
    out.write_text(json.dumps(result, ensure_ascii=False, indent=1) + '\n')
