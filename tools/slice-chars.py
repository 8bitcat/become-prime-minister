# Skivar karaktärsarken (3×2 celler, vit bakgrund) i tools/out/chars/*.png till sprites med
# genomskinlig bakgrund i assets/chars/<id>/<pose>.webp + manifest.json.
#   python tools/slice-chars.py            → alla ark med cast.json-post
#   python tools/slice-chars.py k01 test2  → bara dessa
import json, os, sys
from PIL import Image, ImageDraw, ImageFilter
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', 'out', 'chars')
DST = os.path.join(ROOT, 'assets', 'chars')
POSES = ['stand', 'cross', 'point', 'open', 'think', 'slam']
COLS, ROWS = 3, 2
SENT = (255, 0, 255)

def cut_cell(img, cx, cy):
    w, h = img.size
    cw, ch = w // COLS, h // ROWS
    return img.crop((cx * cw, cy * ch, (cx + 1) * cw, (cy + 1) * ch))

def remove_bg(cell):
    cell = cell.convert('RGB')
    w, h = cell.size
    # fyll från kanterna: allt nästan vitt som hänger ihop med kanten blir bakgrund
    seeds = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)] + [(x, 0) for x in range(0, w, 24)] + [(x, h - 1) for x in range(0, w, 24)] + [(0, y) for y in range(0, h, 24)] + [(w - 1, y) for y in range(0, h, 24)]
    for s in seeds:
        if cell.getpixel(s) != SENT and min(cell.getpixel(s)) > 225:
            ImageDraw.floodfill(cell, s, SENT, thresh=48)
    px = cell.load()
    mask = Image.new('L', (w, h), 255)
    mp = mask.load()
    for y in range(h):
        for x in range(w):
            if px[x, y] == SENT:
                mp[x, y] = 0
    # mjuka kanter: krymp masken en aning och blurra
    mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    out = cell.convert('RGBA')
    # ersätt sentinelfärgen under genomskinliga pixlar med grått så att kanterna inte blir rosa
    for y in range(h):
        for x in range(w):
            if px[x, y] == SENT:
                out.putpixel((x, y), (120, 120, 120, 0))
    out.putalpha(mask)
    return out

def trim_x(im, pad=6):
    bbox = im.getchannel('A').getbbox()
    if not bbox:
        return im
    x0 = max(0, bbox[0] - pad); x1 = min(im.size[0], bbox[2] + pad)
    return im.crop((x0, 0, x1, im.size[1]))

def process(cid, attrs):
    src = os.path.join(SRC, cid + '.png')
    if not os.path.exists(src):
        print('saknas', src); return None
    img = Image.open(src)
    outdir = os.path.join(DST, cid)
    os.makedirs(outdir, exist_ok=True)
    entry = dict(attrs or {}); entry['id'] = cid; entry['poses'] = {}
    i = 0
    for cy in range(ROWS):
        for cx in range(COLS):
            cell = remove_bg(cut_cell(img, cx, cy))
            cell = trim_x(cell)
            # topptrim: luft ovanför huvudet bort, men behåll samma höjd i alla poser → lika skala
            name = POSES[i]; i += 1
            cell.save(os.path.join(outdir, name + '.webp'), 'WEBP', quality=86, method=6)
            bbox = cell.getchannel('A').getbbox() or (0, 0, cell.size[0], cell.size[1])
            entry['poses'][name] = {'w': cell.size[0], 'h': cell.size[1], 'top': bbox[1]}
    # tumnagel: huvudet från stand-posen
    st = Image.open(os.path.join(outdir, 'stand.webp'))
    top = entry['poses']['stand']['top']
    side = int(st.size[1] * 0.42)
    cx0 = max(0, st.size[0] // 2 - side // 2)
    th = st.crop((cx0, max(0, top - 10), cx0 + side, max(0, top - 10) + side)).resize((160, 160), Image.LANCZOS)
    th.save(os.path.join(outdir, 'face.webp'), 'WEBP', quality=84)
    print('✓', cid)
    return entry

if __name__ == '__main__':
    cast = {}
    cp = os.path.join(SRC, 'cast.json')
    if os.path.exists(cp):
        for c in json.load(open(cp, encoding='utf-8')):
            cast[c['id']] = c
    ids = sys.argv[1:] or list(cast.keys())
    mpath = os.path.join(DST, 'manifest.json')
    manifest = {'chars': []}
    if os.path.exists(mpath):
        manifest = json.load(open(mpath, encoding='utf-8'))
    have = {c['id']: c for c in manifest['chars']}
    for cid in ids:
        e = process(cid, cast.get(cid))
        if e and cid in cast:
            e.pop('extra', None)
            have[cid] = e
    manifest['chars'] = [have[k] for k in sorted(have)]
    os.makedirs(DST, exist_ok=True)
    json.dump(manifest, open(mpath, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('manifest:', len(manifest['chars']), 'looks')
