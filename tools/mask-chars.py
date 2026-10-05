# Segmenterar varje figur i assets/chars/<id>/ i färgbara delar (hår, hud, kläder, skjorta, detalj) med
# k-means i färg+höjd, så att spelet kan färga om figurerna i webbläsaren (js/art/recolor.js).
# Skriver labels-<pose>.png (8-bit, värden 0..5) och lägger standardfärgerna i manifest.json.
#   python tools/mask-chars.py            → alla i manifestet
#   python tools/mask-chars.py k01 m07    → bara dessa
import json, os, sys
import numpy as np
from PIL import Image
from scipy.cluster.vq import kmeans2
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DST = os.path.join(ROOT, 'assets', 'chars')
POSES = ['stand', 'cross', 'point', 'open', 'think', 'slam']
LABELS = {0: 'linje', 1: 'skin', 2: 'hair', 3: 'jacket', 4: 'shirt', 5: 'accent'}
K = 11
YW = 110.0  # vikt på höjdläget (0..1 → 0..YW) så att hår (uppe) skiljs från mörka kläder (nere)

def features(rgba):
    h, w = rgba.shape[:2]
    ys, xs = np.mgrid[0:h, 0:w]
    a = rgba[..., 3] > 128
    rgb = rgba[..., :3].astype(np.float32)[a]
    yy = (ys[a] / float(h)) * YW
    return a, np.column_stack([rgb, yy]), ys[a] / float(h)

def is_skin(c):
    r, g, b = c
    mx, mn = max(r, g, b), min(r, g, b)
    sat = (mx - mn) / (mx + 1e-6)
    # hud: r > g > b med r−g i samma storleksordning som g−b; blont hår är gult (r≈g ≫ b) och faller bort
    return r > 120 and r >= g >= b and (r - b) > 25 and sat < .62 and mx < 252 and (g - b) > 5 and (r - g) >= (g - b) * .55

def lum(c):
    return .299 * c[0] + .587 * c[1] + .114 * c[2]

def label_clusters(cent, stats):
    # stats: lista av (area_share, mean_y, mean_rgb)
    lab = {}
    order = sorted(range(len(cent)), key=lambda i: -stats[i][0])
    for i in range(len(cent)):
        share, my, c = stats[i]
        if lum(c) < 48:
            # mörkt: stort kluster högst upp = svart hår, stort kluster nedtill = svart kavaj, annars linjer/ögon
            lab[i] = 2 if (my < .30 and share > .02) else (3 if (share > .08 and my > .4) else 0)
        elif is_skin(c) and (my < .42 or share < .035):
            lab[i] = 1
    # hår: uppe, inte hud, inte linje; ljust hår (blont, grått) tillåts om det inte är rent vitt
    for i in range(len(cent)):
        if i in lab: continue
        share, my, c = stats[i]
        if my < .30 and share > .012 and (lum(c) < 235 or (max(c) - min(c)) > 25):
            lab[i] = 2
    # vitt/ljust med rimlig yta = skjorta; största övriga = kläder
    rest = [i for i in range(len(cent)) if i not in lab]
    rest.sort(key=lambda i: -stats[i][0])
    jacket_done = shirt_done = False
    pending = []
    for i in rest:
        share, my, c = stats[i]
        if share < .004:
            pending.append(i); continue
        if lum(c) > 215 and (max(c) - min(c)) < 40 and not shirt_done:
            lab[i] = 4; shirt_done = True; continue
        if not jacket_done and my > .25:
            lab[i] = 3; jacket_done = True; continue
        pending.append(i)
    # resten: samma plagg delat i flera kluster (ränder, skuggor, höjd) → närmaste dels färg
    def part_color(pid):
        mem = [j for j in lab if lab[j] == pid]
        if not mem: return None
        tot = sum(stats[j][0] for j in mem) or 1
        return np.sum([np.array(stats[j][2]) * stats[j][0] for j in mem], axis=0) / tot
    for i in sorted(pending, key=lambda i: -stats[i][0]):
        share, my, c = stats[i]
        best, bd = None, 1e9
        for pid in (3, 4, 2, 1):
            pc = part_color(pid)
            if pc is None: continue
            if pid == 2 and my > .45: continue
            if pid == 1 and not is_skin(c): continue
            dd = float(np.sqrt(((np.array(c) - pc) ** 2).sum()))
            if dd < bd: best, bd = pid, dd
        if best is not None and bd < 48:
            lab[i] = best
        elif not shirt_done and share > .01:
            lab[i] = 4; shirt_done = True
        else:
            lab[i] = 5 if share < .09 else 3
    return lab

def process(cid):
    d = os.path.join(DST, cid)
    stand = np.array(Image.open(os.path.join(d, 'stand.webp')).convert('RGBA'))
    a, X, yrel = features(stand)
    np.random.seed(7)
    cent, idx = kmeans2(X, K, minit='++', seed=7)
    stats = []
    for i in range(K):
        sel = idx == i
        n = int(sel.sum())
        if n == 0:
            stats.append((0.0, 1.0, (0, 0, 0))); continue
        # "höjd" = där klustret BÖRJAR (10:e percentilen) så att långt hår räknas som hår
        stats.append((n / float(len(idx)), float(np.percentile(yrel[sel], 10)) * .6 + float(yrel[sel].mean()) * .4, tuple(X[sel][:, :3].mean(axis=0))))
    lab = label_clusters(cent, stats)
    colors = {}
    for name_id, name in LABELS.items():
        if name in ('linje',): continue
        members = [i for i in range(K) if lab.get(i) == name_id]
        if not members: continue
        tot = sum(stats[i][0] for i in members) or 1
        c = np.array([0.0, 0.0, 0.0])
        for i in members:
            c += np.array(stats[i][2]) * stats[i][0]
        c /= tot
        colors[name] = '#%02x%02x%02x' % tuple(int(v) for v in c)
    # tilldela alla poser utifrån samma centroider
    for pose in POSES + ['face']:
        p = os.path.join(d, pose + '.webp')
        if not os.path.exists(p): continue
        img = np.array(Image.open(p).convert('RGBA'))
        h, w = img.shape[:2]
        ys, xs = np.mgrid[0:h, 0:w]
        alpha = img[..., 3] > 128
        if pose == 'face':
            # ansiktsbilden är ett utsnitt högst upp i stand-posen → höjdvikt som om y≈0.05–0.45
            yy = (0.05 + (ys[alpha] / float(h)) * .40) * YW
        else:
            yy = (ys[alpha] / float(h)) * YW
        F = np.column_stack([img[..., :3].astype(np.float32)[alpha], yy])
        dist = ((F[:, None, :] - cent[None, :, :]) ** 2).sum(axis=2)
        near = dist.argmin(axis=1)
        out = np.zeros((h, w), dtype=np.uint8)
        out[alpha] = np.array([lab.get(int(i), 3) for i in near], dtype=np.uint8)
        Image.fromarray(out, 'L').save(os.path.join(d, 'labels-%s.png' % pose), optimize=True)
    print('✓', cid, colors)
    return colors

if __name__ == '__main__':
    mpath = os.path.join(DST, 'manifest.json')
    manifest = json.load(open(mpath, encoding='utf-8'))
    ids = sys.argv[1:] or [c['id'] for c in manifest['chars']]
    for c in manifest['chars']:
        if c['id'] in ids:
            c['colors'] = process(c['id'])
    json.dump(manifest, open(mpath, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('manifest uppdaterat')
