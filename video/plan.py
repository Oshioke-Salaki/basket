"""
plan.py: the film's single source of truth. Every element and every sound event is
placed on a 96 BPM grid here and written to timeline.json; film.js draws from it and
score.py plays from it, so every hit in the picture is a hit in the sound.
"""
import json, math

BPM = 96
BEAT = 60 / BPM          # 0.625
BAR = 4 * BEAT           # 2.5
BARS = 48
DURATION = BARS * BAR    # 120
FPS = 30

def at(bar, beat=0.0):
    return round(bar * BAR + beat * BEAT, 6)

N = json.load(open("numbers.json"))
VO = json.load(open("vo/durations.json"))

def naira(minor):
    return "₦{:,.0f}".format(round(minor / 100))

def money(minor, cur):
    sym = {"NGN": "₦", "GBP": "£", "USD": "$", "EUR": "€"}[cur]
    v = minor / 100
    return f"{sym}{v:,.0f}" if cur == "NGN" else f"{sym}{v:,.2f}"

scenes, events = [], []

def ev(kind, t, **kw):
    events.append({"kind": kind, "t": round(t, 6), **kw})

# ---------------------------------------------------------------- sound helpers tied to moves
def slam_in(t, w=0.5, gain=0.22):
    ev("slam", t, w=w, gain=gain)

def chapter(word, t):
    ev("kick", t, level=0.6)
    ev("stamp", t, scale=1.3, pitch=0.8, gain=0.5)
    return {"type": "chapter", "word": word, "t": t}

def text(lines, x, y, size, t_in, t_out=None, font="words", color="ink", gap=None):
    """t_in: one time per line. Each arrival is a slam."""
    for t in t_in:
        slam_in(t)
    return {"type": "text", "lines": lines, "x": x, "y": y, "size": size, "font": font, "color": color, "in": t_in, "out": t_out, "gap": gap}

def sheet(src, x, y, w, h, t_in, t_out, cam, seed=1, kind="screen", shadow=True):
    ev("sweep", t_in - 0.05, dur=0.25, lo=500, hi=3000, up=False, gain=0.16, pan=0.25)
    for c in cam[1:]:
        ev("sweep", c["t"] - 0.15, dur=0.3, lo=300, hi=1800, up=True, gain=0.1, pan=0.1)
    if t_out is not None:
        ev("sweep", t_out, dur=0.25, lo=500, hi=3000, up=False, gain=0.12, pan=0.25)
    return {"type": "sheet", "src": src, "kind": kind, "x": x, "y": y, "w": w, "h": h, "in": t_in, "out": t_out, "cam": cam, "seed": seed}

def stamp(label, color, x, y, t, size=88, rot=None, under=None, out=None):
    ev("stamp", t, scale=1.6, pitch=1.0 if color == "green" else 0.85, gain=0.55)
    ev("kick", t, level=0.45)
    return {"type": "stamp", "label": label, "color": color, "x": x, "y": y, "t": t, "size": size, "rot": rot if rot is not None else (-7 if color == "green" else -5), "under": under, "out": out}

def floater(emoji, x, y, size, t, pop=True, **kw):
    """An everyday object as a colour emoji; its pop is a bright bloop on the grid."""
    if pop:
        ev("bloop", t, f0=620, f1=1240, dur=0.06, gain=0.1, pan=max(-0.8, min(0.8, (x - 960) / 1100)))
    return {"type": "floater", "emoji": emoji, "x": x, "y": y, "size": size, "t": t, **kw}

# Bright, everyday colours: one ground per scene, an accent for its bars.
PALETTE = {
    "open": ("#FFE7D1", "#FF4D2E"), "snap": ("#FFD84D", "#2F6BFF"), "remember": ("#BFE6FF", "#14213D"),
    "know": ("#FFD3C4", "#E0301E"), "yours": ("#CFF5C3", "#0B8A47"), "check": ("#FFC86B", "#E0301E"),
    "plan": ("#C7EFE6", "#0B7A75"), "proof": ("#E4E0FF", "#3F2DB5"), "end": ("#FFE7D1", "#FF4D2E"),
}
WIPES = ["#FF4D2E", "#FFC21A", "#1FB574", "#2F7BFF", "#FF5FA2", "#14213D", "#FF8A1F", "#00B3A4", "#3F2DB5"]

def wipe(cut):
    ev("sweep", cut - 0.30, dur=0.55, lo=380, hi=3400, up=True, gain=0.24, pan=0)
    return cut

# ---------------------------------------------------------------- the scenes
cuts = [4, 10, 16, 22, 28, 34, 38, 42]

# S0: cold open, then the name.
s0 = []
s0.append(text(["Prices", "went up."], 160, 300, 168, [at(0, 1), at(0, 2)], at(1, 3), font="display"))
for i, (em, x, y) in enumerate([("🍅", 980, 560), ("🥛", 1230, 400), ("🍚", 1470, 600), ("🍝", 1700, 430)]):
    s0.append(floater(em, x, y, 150, at(0, 1.5) + i * BEAT / 2, rise=46, out=at(1, 3) + 0.04 * i, phase=i))
s0.append(floater("📈", 1520, 140, 120, at(1, 1), out=at(1, 3), bob=6))
s0.append(text(["Whose prices?"], 160, 360, 120, [at(2, 0)], at(2, 2), font="display"))
s0.append(floater("🤔", 1080, 330, 150, at(2, 0) + BEAT / 2, out=at(2, 2)))
ev("riser", at(2, 2) - 2 * BEAT, dur=2 * BEAT, gain=0.18)
for i in range(3):
    ev("slam", at(2, 2) + i * BEAT / 4, w=0.4, gain=0.2)
ev("kick", at(3, 0), level=0.5)
ev("bell_chord", at(3, 0), notes=[62, 66, 69, 73, 78], ratio=1, index=0.8, decay=1.0, gain=0.2)
s0.append({"type": "reveal", "word": "Basket", "x": 160, "y": 330, "size": 300, "grow": at(2, 2), "reveal": at(3, 0)})
s0.append(text(["Your prices, remembered."], 168, 680, 56, [at(3, 2)], None, font="words", color="muted"))
s0.append(floater("🧺", 1130, 360, 220, at(3, 0) + BEAT / 4, bob=10))
s0.append({"type": "mascot", "x": 1500, "y": 760, "w": 260, "h": 96, "color": "#14213D", "track": [
    {"t": at(3, 1), "do": "enter"}, {"t": at(3, 2.5), "do": "wake"}, {"t": at(3, 3.5), "do": "blink"}]})
ev("sweep", at(3, 1) - 0.1, dur=0.4, lo=200, hi=1400, up=True, gain=0.14, pan=0.4)
ev("bloop", at(3, 3.5), f0=700, f1=1100, dur=0.07, gain=0.12)
scenes.append({"id": "open", "start": 0, "end": at(4), "els": s0, "bg": PALETTE["open"][0], "bar": PALETTE["open"][1]})

# S1: snap a receipt.
r = next(x for x in N["receipts"] if x["id"] == N["lastReceipt"]["id"])
s1 = [chapter("Snap", at(4))]
lines = [{"l": r["store"].upper(), "r": "", "b": True}, {"l": "05/11/2026  17:42", "r": "", "b": False}]
lines += [{"l": l["raw"], "r": "{:,.2f}".format(l["total"] / 100), "b": False} for l in r["lines"]]
lines += [{"l": "TOTAL", "r": "{:,.2f}".format(r["total"] / 100), "b": True}]
feeds = []
t = at(4, 2)
for i, ln in enumerate(lines):
    feeds.append(round(t, 6))
    on_beat = abs((t / BEAT) - round(t / BEAT)) < 1e-6
    ev("printer", t, len=0.22 if on_beat else 0.12, gain=0.15)
    t += BEAT / 2 if i < 2 else BEAT / 2
tear = at(6, 2)
ev("tear", tear, gain=0.16)
s1.append({"type": "printer", "x": 1150, "y": 900, "w": 470, "lines": lines, "feeds": feeds, "tear": tear, "end": at(7, 0)})
s1.append(text(["Any receipt.", "Any currency.", "Every line read."], 160, 300, 84, [at(5, 0), at(5, 2), at(6, 0)], at(7, 2)))
s1.append(floater("🛍️", 220, 700, 170, at(5, 0) + BEAT / 2, out=at(7, 2)))
s1.append(floater("📸", 430, 720, 150, at(5, 2) + BEAT / 2, out=at(7, 2) + 0.04, phase=1))
s1.append(floater("💱", 620, 700, 140, at(6, 0) + BEAT / 2, out=at(7, 2) + 0.08, phase=2))
s1.append(sheet("receipt-memory.png", 800, 230, 1040, 700, at(7, 1), None, [
    {"t": at(7, 1), "box": {"x": 60, "y": 60, "w": 1340}},
    {"t": at(8, 1), "box": {"x": 70, "y": 285, "w": 900}},
], seed=3))
s1.append(text(["Read in", "seconds."], 160, 300, 120, [at(8, 0), at(8, 1)], at(9, 2), font="display"))
s1.append(stamp("5 items", "green", 1380, 760, at(9, 0), size=80))
scenes.append({"id": "snap", "start": at(4), "end": at(10), "els": s1, "bg": PALETTE["snap"][0], "bar": PALETTE["snap"][1]})

# S2: remember, on Walrus Memory.
s2 = [chapter("Remember", at(10))]
slips = []
for i, rc in enumerate(N["receipts"]):
    slips.append({"title": rc["store"], "sub": rc["date"], "amount": money(rc["total"], rc["currency"]), "t": at(10, 2) + i * BEAT / 2})
    ev("pin", at(10, 2) + i * BEAT / 2, gain=0.12, pan=-0.4 + 0.12 * i)
s2.append({"type": "slips", "x": 830, "y": 250, "cols": 4, "items": slips, "shrink": at(12, 0)})
s2.append(text(["Every price.", "Every store."], 160, 300, 84, [at(11, 0), at(11, 2)], at(12, 2)))
count0, count1 = at(12, 1), at(13, 2)
ticks = []
for i in range(28):
    x = i / 27
    ticks.append(round(count0 + (count1 - count0) * (1 - (1 - x) ** 1.8), 6))
for tt in ticks:
    ev("typekey", tt, level=0.7, gain=0.1)
s2.append({"type": "counter", "x": 830, "y": 250, "size": 260, "from": 0, "to": N["memories"], "t0": count0, "t1": count1, "fmt": "int", "label": "memories on Walrus Memory", "dots": {"x": 836, "y": 600}, "out": at(14, 1)})
s2.append(text(["Encrypted on", "Walrus Memory."], 160, 300, 96, [at(13, 0), at(13, 1)], at(14, 0), font="display"))
s2.append(floater("🦭", 230, 640, 190, at(13, 1) + BEAT / 2, out=at(14, 0)))
s2.append(floater("🔒", 470, 660, 150, at(13, 2), out=at(14, 0) + 0.04, phase=1))
rows = [[l["name"], naira(l["total"])] for l in r["lines"]]
row_t = [at(14, 2) + i * BEAT / 2 for i in range(len(rows))]
for i, tt in enumerate(row_t):
    ev("slam", tt, w=0.6, gain=0.3, pan=-0.3 + 0.08 * i)
s2.append({"type": "rows", "x": 830, "y": 280, "rows": rows, "show": at(14, 1), "redact": row_t})
s2.append(text(["No account.", "Just your key."], 160, 300, 84, [at(14, 1), at(14, 3)], None))
s2.append(floater("🔑", 260, 600, 170, at(15, 0), tilt=-12))
s2.append(stamp("Sealed", "green", 1140, 700, at(15, 2)))
s2.append({"type": "mascot", "x": 1560, "y": 900, "w": 200, "h": 74, "color": "#2F6BFF", "track": [{"t": at(12, 2), "do": "enter"}, {"t": at(12, 3), "do": "wake"}, {"t": at(13, 2), "do": "blink"}, {"t": at(15, 0), "do": "hop"}]})
ev("sweep", at(12, 2) - 0.1, dur=0.4, lo=200, hi=1400, up=True, gain=0.12, pan=0.5)
ev("bloop", at(13, 2), f0=700, f1=1100, dur=0.07, gain=0.12)
ev("bloop", at(15, 0), f0=420, f1=760, dur=0.09, gain=0.12)
scenes.append({"id": "remember", "start": at(10), "end": at(16), "els": s2, "bg": PALETTE["remember"][0], "bar": PALETTE["remember"][1]})

# S3: what memory knows.
f = N["lastReceipt"]["findings"]
milk = next(x for x in f if x["kind"] == "above_usual" and "Milk" in x["itemName"])
s3 = [chapter("Know", at(16))]
s3.append(sheet("receipt-memory.png", 800, 230, 1040, 700, at(16, 1.5), None, [
    {"t": at(16, 1.5), "box": {"x": 60, "y": 60, "w": 1340}},
    {"t": at(17, 2), "box": {"x": 90, "y": 288, "w": 760}},
    {"t": at(18, 2), "box": {"x": 90, "y": 400, "w": 760}},
    {"t": at(19, 2), "box": {"x": 90, "y": 512, "w": 760}},
], seed=5))
pct = round(milk["deltaRatio"] * 100)
s3.append(text([f"Milk: up {pct}%."], 160, 300, 84, [at(17, 2)], at(18, 2)))
s3.append(floater("🥛", 260, 520, 220, at(17, 2) + BEAT / 4, rise=30, out=at(18, 2)))
s3.append(stamp(f"+{pct}%", "red", 1500, 300, at(17, 3), out=at(18, 2)))
s3.append(text(["Rice: cheaper at", "Market Square."], 160, 300, 84, [at(18, 3), at(19, 0)], at(19, 3)))
s3.append(floater("🍚", 220, 600, 200, at(19, 0) + BEAT / 4, out=at(19, 3)))
s3.append(floater("🏪", 470, 620, 170, at(19, 1), out=at(19, 3) + 0.04, phase=1))
s3.append(text(["Spaghetti:", "500g → 450g."], 160, 300, 84, [at(20, 0), at(20, 1)], at(21, 0)))
s3.append(floater("🍝", 300, 640, 260, at(20, 0) + BEAT / 4, shrink={"t": at(20, 2), "to": 0.72}, out=at(21, 0)))
ev("bloop", at(20, 2), f0=900, f1=420, dur=0.2, gain=0.12)
s3.append(stamp("Smaller pack", "red", 1340, 330, at(20, 2)))
s3.append(sheet("receipt-blank.png", 800, 230, 1040, 700, at(21, 0), None, [{"t": at(21, 0), "box": {"x": 60, "y": 60, "w": 1340}}], seed=7))
s3.append(text(["Without memory:", "just a list."], 160, 300, 84, [at(21, 1), at(21, 2)], None, color="muted"))
scenes.append({"id": "know", "start": at(16), "end": at(22), "els": s3, "bg": PALETTE["know"][0], "bar": PALETTE["know"][1]})

# S4: your own inflation.
inf = N["inflation"]
s4 = [chapter("Yours", at(22))]
c0, c1 = at(22, 2), at(24, 0)
ticks = [round(c0 + (c1 - c0) * (1 - (1 - (i / 27)) ** 1.8), 6) for i in range(28)]
for tt in ticks:
    ev("typekey", tt, level=0.7, gain=0.1)
s4.append({"type": "counter", "x": 160, "y": 250, "size": 300, "from": 0, "to": round(inf["change"] * 1000) / 10, "t0": c0, "t1": c1, "fmt": "pct", "label": "your basket inflation", "out": at(25, 0)})
s4.append(text(["Since September.", f"Across {inf['items']} things you buy."], 166, 640, 56, [at(24, 0), at(24, 2)], at(25, 0), color="muted"))
s4.append(floater("📈", 1150, 300, 220, at(23, 0), out=at(25, 0)))
s4.append(floater("🛒", 1480, 520, 200, at(23, 2), out=at(25, 0) + 0.04, phase=1))
s4.append(sheet("overview.png", 800, 230, 1040, 700, at(25, 1), None, [
    {"t": at(25, 1), "box": {"x": 60, "y": 610, "w": 1340}},
    {"t": at(26, 2), "box": {"x": 60, "y": 1300, "w": 1340}},
], seed=9))
s4.append(text(["Your number,", "not the", "national one."], 160, 300, 96, [at(25, 2), at(26, 0), at(26, 1)], None, font="display"))
s4.append({"type": "mascot", "x": 1500, "y": 236, "w": 180, "h": 66, "peek": True, "color": "#FF5FA2", "track": [{"t": at(27, 0), "do": "peek"}, {"t": at(27, 1), "do": "wake"}, {"t": at(27, 2), "do": "wink"}]})
ev("bloop", at(27, 0), f0=700, f1=1100, dur=0.07, gain=0.12)
ev("bloop", at(27, 2), f0=800, f1=1300, dur=0.05, gain=0.1)
ev("bloop", at(27, 2) + BEAT / 4, f0=800, f1=1300, dur=0.05, gain=0.1)
scenes.append({"id": "yours", "start": at(22), "end": at(28), "els": s4, "bg": PALETTE["yours"][0], "bar": PALETTE["yours"][1]})

# S5: price check at the stall.
s5 = [chapter("Check", at(28))]
s5.append({"type": "tag", "x": 830, "y": 360, "name": "MAMA GOLD RICE", "size": "5kg bag", "price": "₦13,500", "in": at(28, 1.5), "scan": at(29, 1), "tick": at(29, 3)})
ev("slam", at(28, 1.5), w=0.5, gain=0.22)
ev("sweep", at(29, 1), dur=0.45, lo=1200, hi=5200, up=True, gain=0.14, pan=-0.2)
ev("bell", at(29, 3), f=880.0, decay=0.35, ratio=2, index=0.7, gain=0.16)
ev("bell", at(29, 3) + BEAT / 2, f=1174.66, decay=0.35, ratio=2, index=0.7, gain=0.16)
s5.append({"type": "phone", "src": "phone-check.png", "x": 1340, "y": 120, "w": 420, "h": 860, "in": at(29, 2), "scroll": [{"t": at(29, 2), "y": 0}, {"t": at(30, 2), "y": 560}]})
ev("sweep", at(29, 2) - 0.12, dur=0.32, lo=400, hi=2600, up=True, gain=0.14, pan=0.3)
s5.append(text(["₦13,500", "for rice?"], 160, 300, 120, [at(29, 0), at(29, 1)], at(30, 2), font="display"))
s5.append(text(["18% over", "your usual."], 160, 300, 120, [at(30, 3), at(31, 0)], at(32, 0), font="display", color="red"))
s5.append(stamp("Too high", "red", 1180, 600, at(31, 1), size=76))
s5.append(text(["Offer", "₦10,500."], 160, 300, 120, [at(32, 1), at(32, 2)], None, font="display", color="green"))
s5.append(text(["You keep ₦3,000."], 164, 560, 64, [at(33, 1)], None, font="words", color="ink"))
s5.append(floater("💰", 700, 520, 150, at(33, 1) + BEAT / 2))
s5.append(floater("🧺", 860, 760, 170, at(28, 1.5) + BEAT / 2, phase=2))
ev("bell", at(33, 1), f=1318.5, decay=0.4, ratio=2, index=0.7, gain=0.14)
s5.append(stamp("Fair offer", "green", 1160, 760, at(32, 3), size=76))
scenes.append({"id": "check", "start": at(28), "end": at(34), "els": s5, "bg": PALETTE["check"][0], "bar": PALETTE["check"][1]})

# S6: next shop and trips.
ns = N["nextShop"]
s6 = [chapter("Plan", at(34))]
due_items = ns["items"] or ns["upcoming"]
tiles = [{"title": i["itemName"], "sub": f"due in {i['dueInDays']} days · cheapest at {i['storeName']}", "value": naira(i["expectedMinor"])} for i in due_items]
tile_t = [at(34, 2) + k * BEAT / 4 for k in range(len(tiles))]
notes = [74, 76, 78, 81, 83, 86, 88, 90]
for k, tt in enumerate(tile_t):
    ev("bell", tt, f=440 * 2 ** ((notes[k] - 69) / 12), decay=0.35, ratio=2, index=0.7, gain=0.12, pan=-0.5 + 0.3 * k)
s6.append({"type": "tiles", "x": 830, "y": 250, "w": 1000, "items": tiles, "t": tile_t, "lift": at(35, 3)})
s6.append(text(["Your next shop,", "already planned."], 160, 300, 84, [at(34, 3), at(35, 0)], at(35, 3)))
s6.append(floater("🗓️", 240, 640, 170, at(35, 0) + BEAT / 2, out=at(35, 3)))
s6.append(floater("✈️", -160, 760, 170, at(35, 3) + BEAT / 2, pop=False, path={"x": 2100, "y": 600, "t0": at(35, 3) + BEAT / 2, "t1": at(36, 3), "arc": 1.2}, bob=0))
ev("sweep", at(35, 3) + BEAT / 2, dur=1.2, lo=300, hi=1600, up=True, gain=0.1, pan=0)
s6.append(floater("🇬🇧", 250, 640, 150, at(36, 2), phase=1))
s6.append(floater("🍜", 440, 660, 150, at(36, 3), phase=2))
trip = N["trips"][0]
lift_t = [at(35, 3) + k * BEAT / 2 for k in range(len(tiles))]
for tt in lift_t:
    ev("sweep", tt - 0.12, dur=0.18, lo=900, hi=4200, up=True, gain=0.12, pan=0.2)
trip_rows = [{"title": c["itemName"], "value": f"{c['ratio']:.1f}× home"} for c in trip["comparisons"]]
trip_t = [at(36, 2) + k * BEAT / 2 for k in range(len(trip_rows))]
for k, tt in enumerate(trip_t):
    ev("pin", tt, gain=0.12, pan=-0.2 + 0.2 * k)
s6.append({"type": "trip", "x": 830, "y": 250, "title": "London · " + ", ".join(trip["stores"]), "total": money(trip["total"], trip["currency"]), "home": "≈ " + naira(trip["totalHome"]), "rows": trip_rows, "in": at(36, 1), "t": trip_t})
ev("sweep", at(36, 1) - 0.05, dur=0.25, lo=500, hi=3000, up=False, gain=0.16, pan=0.25)
s6.append(text(["Abroad, priced", "against home."], 160, 300, 84, [at(36, 1), at(36, 2)], None))
scenes.append({"id": "plan", "start": at(34), "end": at(38), "els": s6, "bg": PALETTE["plan"][0], "bar": PALETTE["plan"][1]})

# S7: underneath. The real `pnpm verify` output, trimmed to fit the window.
s7 = [chapter("Proof", at(38))]
cmd = "pnpm verify"
type_t0 = at(38, 2)
step = BEAT / 12
for i in range(len(cmd)):
    ev("typekey", type_t0 + i * step, level=0.75 + 0.25 * ((i * 7919) % 100) / 100, gain=0.1)
out_lines = [
    "PASS  Tatum Sui gRPC: latest checkpoint",
    "PASS  Tatum Sui gRPC: memory account object",
    "PASS  Tatum Data API: rates",
    "PASS  Walrus Memory: relayer ok",
    "PASS  Walrus Memory: mainnet write + read",
    "All checks passed.",
]
out_t = [at(39, 1) + k * BEAT / 2 for k in range(len(out_lines))]
for tt in out_t:
    ev("bloop", tt, f0=1500, f1=1200, dur=0.03, gain=0.08)
    ev("typekey", tt, level=0.5, gain=0.08)
s7.append({"type": "terminal", "x": 820, "y": 260, "w": 1000, "h": 520, "in": at(38, 1.5), "cmd": cmd, "type0": type_t0, "step": step, "lines": out_lines, "lt": out_t})
ev("sweep", at(38, 1.5) - 0.12, dur=0.32, lo=400, hi=2600, up=True, gain=0.14, pan=0.3)
s7.append(text(["Walrus Memory", "on mainnet.", "Tatum on Sui."], 160, 300, 84, [at(39, 0), at(39, 1), at(39, 3)], None))
s7.append(floater("🦭", 230, 680, 200, at(39, 1) + BEAT / 2))
s7.append(floater("⛓️", 470, 700, 150, at(39, 3) + BEAT / 2, phase=1))
s7.append(stamp("Mainnet", "green", 1420, 700, at(41, 0)))
scenes.append({"id": "proof", "start": at(38), "end": at(42), "els": s7, "bg": PALETTE["proof"][0], "bar": PALETTE["proof"][1]})

# S8: the name again, and where to find it.
s8 = []
ev("riser", at(42, 2) - 2 * BEAT, dur=2 * BEAT, gain=0.18)
for i in range(3):
    ev("slam", at(42, 2) + i * BEAT / 4, w=0.4, gain=0.2)
ev("kick", at(43, 0), level=0.5)
ev("bell_chord", at(43, 0), notes=[62, 66, 69, 73, 78], ratio=1, index=0.8, decay=1.0, gain=0.22)
s8.append({"type": "reveal", "word": "Basket", "x": 160, "y": 300, "size": 300, "grow": at(42, 2), "reveal": at(43, 0)})
s8.append(text(["Your prices, remembered."], 168, 640, 64, [at(43, 2)], None, color="ink"))
for i, em in enumerate(["🍅", "🥛", "🍚", "🍝", "🧺"]):
    s8.append(floater(em, 1060 + i * 150, 190 + (i % 2) * 60, 120, at(43, 0) + i * BEAT / 4, phase=i))
url = "basket-iota-five.vercel.app"
for i in range(len(url)):
    ev("typekey", at(44, 2) + i * BEAT / 12, level=0.75 + 0.25 * ((i * 104729) % 100) / 100, gain=0.1)
s8.append({"type": "typed", "text": url, "x": 168, "y": 760, "size": 40, "t0": at(44, 2), "step": BEAT / 12})
s8.append(text(["Walrus Memory · Tatum · Sui"], 168, 860, 30, [at(45, 2)], None, font="mono", color="muted"))
s8.append({"type": "mascot", "x": 1440, "y": 760, "w": 300, "h": 110, "color": "#1FB574", "track": [
    {"t": at(44, 0), "do": "enter"}, {"t": at(44, 1), "do": "wake"}, {"t": at(45, 0), "do": "hop"}, {"t": at(45, 3), "do": "blink"}, {"t": at(46, 2), "do": "wink"}, {"t": at(47, 0), "do": "hop"}]})
ev("sweep", at(44, 0) - 0.1, dur=0.4, lo=200, hi=1400, up=True, gain=0.14, pan=0.4)
for tt in (at(45, 0), at(47, 0)):
    ev("bloop", tt, f0=420, f1=760, dur=0.09, gain=0.12)
ev("bloop", at(45, 3), f0=700, f1=1100, dur=0.07, gain=0.1)
ev("bloop", at(46, 2), f0=800, f1=1300, dur=0.05, gain=0.1)
ev("bloop", at(46, 2) + BEAT / 4, f0=800, f1=1300, dur=0.05, gain=0.1)
scenes.append({"id": "end", "start": at(42), "end": DURATION, "els": s8, "bg": PALETTE["end"][0], "bar": PALETTE["end"][1]})

for c in cuts:
    wipe(at(c))

vo = [{"id": k, "file": v["file"], "t": round(at(v["bar"]), 6), "dur": v["seconds"]} for k, v in VO.items()]
# Narration must end before its scene does.
for line in vo:
    scene = next(s for s in scenes if s["start"] <= line["t"] < s["end"])
    assert line["t"] + line["dur"] <= scene["end"] + 0.01, f"{line['id']} overruns {scene['id']}"

# Quiet bars (only a soft kick): under the cold open's question and the reveal.
quiet = [2]
chapters = {"middle": [16, 22, 28]}

events.sort(key=lambda e: e["t"])
json.dump({"bpm": BPM, "beat": BEAT, "bar": BAR, "bars": BARS, "duration": DURATION, "fps": FPS,
           "cuts": [at(c) for c in cuts], "wipeColors": WIPES, "scenes": scenes, "events": events, "vo": vo,
           "quiet": quiet, "middle": [16, 34]}, open("timeline.json", "w"), indent=1, ensure_ascii=False)
print(f"{len(scenes)} scenes, {len(events)} events, {len(vo)} voice lines, {DURATION}s")
