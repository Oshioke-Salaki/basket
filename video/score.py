"""
score.py: the film's sound, synthesized from timeline.json with numpy (48 kHz stereo, seeded
noise). Every event in the picture is an event here. Writes out/score.wav.
"""
import json, math, wave
import numpy as np

SR = 48000
T = json.load(open("timeline.json"))
BEAT, BAR, DUR = T["beat"], T["bar"], T["duration"]
TAIL = 2.0
N = int((DUR + TAIL) * SR)
rng = np.random.default_rng(2610)

dry = np.zeros((2, N))
send = np.zeros((2, N))

def tt(seconds):
    return np.arange(int(seconds * SR)) / SR

def noise(seconds):
    return rng.standard_normal(int(seconds * SR))

def band(x, lo, hi):
    """Band-pass by FFT mask with soft edges (short buffers only)."""
    n = len(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    X = np.fft.rfft(x)
    soft = 0.15
    mask = np.clip((np.log(f + 1e-9) - math.log(lo)) / soft + 1, 0, 1) * np.clip((math.log(hi) - np.log(f + 1e-9)) / soft + 1, 0, 1)
    return np.fft.irfft(X * mask, n)

def hipass(x, lo):
    return band(x, lo, SR / 2 - 1)

def norm(x):
    m = np.max(np.abs(x)) or 1
    return x / m

def place(sig, t, gain=1.0, pan=0.0, rev=0.0):
    i = int(round(t * SR))
    if i >= N or len(sig) == 0:
        return
    if i < 0:
        sig = sig[-i:]
        i = 0
    sig = sig[: N - i]
    a = (pan + 1) * math.pi / 4
    l, r = math.cos(a), math.sin(a)
    dry[0, i:i + len(sig)] += sig * gain * l
    dry[1, i:i + len(sig)] += sig * gain * r
    if rev:
        send[0, i:i + len(sig)] += sig * gain * l * rev
        send[1, i:i + len(sig)] += sig * gain * r * rev

def place_stereo(sig2, t, gain=1.0, rev=0.0):
    i = int(round(t * SR))
    n = min(sig2.shape[1], N - i)
    if n <= 0:
        return
    dry[:, i:i + n] += sig2[:, :n] * gain
    if rev:
        send[:, i:i + n] += sig2[:, :n] * gain * rev

# ------------------------------------------------------------------ instruments
def glide_sine(f0, f1, tau, seconds):
    t = tt(seconds)
    f = f1 + (f0 - f1) * np.exp(-t / tau)
    return np.sin(2 * np.pi * np.cumsum(f) / SR)

def slam(w):
    t = tt(0.5)
    thud = glide_sine(100, 60, 0.08, 0.5) * np.exp(-t / 0.09) * w
    n = norm(band(noise(0.5), 350, 2600))
    env = np.minimum(t / 0.008, 1) * np.exp(-np.maximum(t - 0.008, 0) / 0.06)
    return thud + 0.55 * n * env

def sweep(dur, lo, hi, up=True):
    t = tt(dur)
    x = noise(dur)
    centers = np.geomspace(lo, hi, 8)
    out = np.zeros_like(t)
    sigma = max(0.02, dur / 9)
    for i, c in enumerate(centers):
        pos = (i / 7) if up else (1 - i / 7)
        g = np.exp(-(((t / dur) - pos) * dur / sigma) ** 2)
        out += norm(band(x, c / 1.35, c * 1.35)) * g
    return norm(out) * np.sin(np.pi * t / dur)

def stamp(scale, pitch):
    t = tt(0.6)
    body = np.sin(2 * np.pi * 185 * pitch * t) * np.exp(-t / 0.06)
    crack = norm(band(noise(0.6), 700, 2600)) * np.exp(-t / 0.08) * 0.7
    crunch = norm(band(noise(0.6), 3000, 6500)) * np.exp(-t / 0.025) * 0.5
    thump = np.sin(2 * np.pi * 68 * pitch * t) * np.exp(-t / 0.12) * scale
    return (body + crack + crunch) * 0.6 + thump * 0.5

def typekey(level):
    t = tt(0.06)
    click = norm(hipass(noise(0.06), 2500)) * np.exp(-t / 0.004)
    ping = np.sin(2 * np.pi * 3150 * t) * np.exp(-t / 0.012) * 0.4
    return (click + ping) * level

def printer(length):
    t = tt(length + 0.03)
    motor = np.tanh(3.5 * np.sin(2 * np.pi * 150 * t)) * (np.sin(2 * np.pi * 42 * t) > 0)
    whir = norm(band(noise(length + 0.03), 4200, 8000)) * 0.35
    env = np.minimum(t / 0.006, 1) * np.clip((length + 0.03 - t) / 0.03, 0, 1)
    return (motor * 0.5 + whir) * env

def bell(f, decay, ratio=2.0, index=0.7):
    t = tt(decay * 5)
    I = index * np.exp(-t / (0.3 * decay))
    return np.sin(2 * np.pi * f * t + I * np.sin(2 * np.pi * f * ratio * t)) * np.exp(-t / decay)

def bloop(f0, f1, dur):
    t = tt(dur + 0.25)
    f = f0 + (f1 - f0) * np.clip(t / dur, 0, 1)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.06)

def riser(dur):
    t = tt(dur)
    return norm(hipass(noise(dur), 4500)) * (t / dur) ** 3

def kick(level):
    t = tt(0.9)
    body = glide_sine(116, 46, 0.045, 0.9) * np.exp(-t / 0.26)
    click = np.sin(2 * np.pi * 2000 * t) * np.exp(-t / 0.004) * 0.25
    return (body + click) * level

def tear():
    t = tt(0.35)
    return norm(band(noise(0.35), 900, 6000)) * (0.5 + 0.5 * np.sin(2 * np.pi * 38 * t)) * np.exp(-t / 0.07)

def pin():
    t = tt(0.3)
    click = norm(band(noise(0.3), 2000, 5000)) * np.exp(-t / 0.04) * 0.5
    b = bell(1320, 0.18)
    n = min(len(b), len(click))
    return b[:n] * 0.6 + click[:n]

def midi(m):
    return 440 * 2 ** ((m - 69) / 12)

def epiano(f, seconds, vel=1.0):
    """FM electric piano: ratio 1, index 2e^(-t/0.32) + 0.22, a faint 7x bell partial, stereo detune."""
    t = tt(seconds + 1.5)
    I = 2 * np.exp(-t / 0.32) + 0.22
    env = np.exp(-t / 1.5) * np.clip((seconds + 1.5 - t) / 0.08, 0, 1) * np.minimum(t / 0.004, 1)
    out = []
    for det in (0.9985, 1.0015):
        ff = f * det
        tone = np.sin(2 * np.pi * ff * t + I * np.sin(2 * np.pi * ff * t))
        tone += 0.06 * np.sin(2 * np.pi * ff * 7 * t) * np.exp(-t / 0.15)
        out.append(tone * env * vel)
    return np.array(out)

def sub(f, seconds, vel=1.0):
    t = tt(seconds)
    x = np.sin(2 * np.pi * f * t) + 0.22 * np.sin(4 * np.pi * f * t)
    env = np.minimum(t / 0.005, 1) * np.exp(-t / (seconds * 0.9))
    return np.tanh(1.3 * x) * env * vel

# ------------------------------------------------------------------ the band
CH_A = [[62, 66, 69, 73, 76], [59, 62, 66, 69, 73], [55, 59, 62, 66, 69], [57, 62, 64, 67]]   # Dmaj9 Bm9 Gmaj9 A7sus4
ROOT_A = [38, 35, 31, 33]
CH_B = [[52, 55, 59, 62, 66], [54, 57, 61, 64], [55, 59, 62, 66], [57, 61, 64, 67]]          # Em9 F#m7 Gmaj7 A7
ROOT_B = [40, 42, 43, 45]
mid0, mid1 = T["middle"]
quiet = set(T["quiet"]) | {42}

def chord_for(bar):
    i = bar % 4
    if mid0 <= bar < mid1:
        return CH_B[i], ROOT_B[i]
    return CH_A[i], ROOT_A[i]

for bar in range(T["bars"]):
    t0 = bar * BAR
    notes, root = chord_for(bar)
    if bar in quiet or bar == T["bars"] - 1:
        for b in range(4):
            place(kick(0.35), t0 + b * BEAT, gain=0.5)
        held = sum(epiano(midi(m), BAR * 1.6, 0.5)[:, :] for m in notes)
        place_stereo(held, t0, gain=0.05, rev=0.4)
        continue
    intro = bar < 2
    for b in range(4):
        loud = b in (0, 2)
        place(kick(0.9 if loud else 0.6), t0 + b * BEAT, gain=0.42 if not intro else 0.3)
        if b in (1, 3) and not intro:
            place(stamp(0.6, 1.0), t0 + b * BEAT, gain=0.12, rev=0.2)
    if not intro:
        for e in range(8):
            swing = 0.06 * BEAT if e % 2 else 0
            place(typekey(0.6 + 0.4 * (e % 2 == 0)), t0 + e * BEAT / 2 + swing, gain=0.05, pan=0.25)
    # Stabs: beat 1 and the and-of-2; an octave-up stab on the and-of-4 every other bar.
    stabs = [(0.0, 0), (1.5, 0)] + ([(3.5, 12)] if bar % 2 else [])
    for beat, oct_ in stabs:
        s = sum(epiano(midi(m + oct_), BEAT * 0.45, 0.9) for m in notes)
        place_stereo(s, t0 + beat * BEAT, gain=0.045, rev=0.35)
    # Sub bass: 1, 2, the and-of-2 (light), 3 (the fifth), 4.
    if not intro:
        for beat, off, vel in [(0, 0, 1), (1, 0, 0.8), (1.5, 0, 0.45), (2, 7, 0.9), (3, 0, 0.8)]:
            place(sub(midi(root + off), BEAT * 0.9, vel), t0 + beat * BEAT, gain=0.2)

# ------------------------------------------------------------------ the events from the picture
# While the narrator speaks, effects make room: a hit inside a voice line plays at 45%.
speech = [(v["t"] - 0.05, v["t"] + v["dur"]) for v in T["vo"]]
def under_voice(t):
    return any(a <= t <= b for a, b in speech)

for e in T["events"]:
    k, t = e["kind"], e["t"]
    g, p = e.get("gain", 0.2), e.get("pan", 0.0)
    if under_voice(t):
        g *= 0.45
    if k == "slam":
        place(slam(e["w"]), t, g, p, rev=0.12)
    elif k == "sweep":
        place(sweep(e["dur"], e["lo"], e["hi"], e["up"]), t, g * 0.8, p, rev=0.2)
    elif k == "stamp":
        place(stamp(e["scale"], e["pitch"]), t, g * 0.55, p, rev=0.18)
    elif k == "kick":
        place(kick(e["level"]), t, 0.5)
    elif k == "typekey":
        place(typekey(e["level"]), t, g, 0.15)
    elif k == "printer":
        place(printer(e["len"]), t, g * 0.8, 0.2)
    elif k == "tear":
        place(tear(), t, g * 2.2, 0.2, rev=0.2)
    elif k == "bell":
        place(bell(e["f"], e["decay"], e.get("ratio", 2), e.get("index", 0.7)), t, g, p, rev=0.4)
    elif k == "bell_chord":
        for i, m in enumerate(e["notes"]):
            place(bell(midi(m), e["decay"], e["ratio"], e["index"]), t + i * 0.012, g * 0.5, -0.4 + 0.2 * i, rev=0.5)
    elif k == "bloop":
        place(bloop(e["f0"], e["f1"], e["dur"]), t, g, p, rev=0.15)
    elif k == "riser":
        place(riser(e["dur"]), t, g, 0, rev=0.3)
    elif k == "pin":
        place(pin(), t, g * 1.4, p, rev=0.2)
    else:
        raise SystemExit(f"unknown event {k}")

# ------------------------------------------------------------------ reverb, mix, write
ir_len = int(1.3 * SR)
ir_t = np.arange(ir_len) / SR
ir = np.stack([band(rng.standard_normal(ir_len), 80, 6000) * np.exp(-ir_t / 0.32) for _ in range(2)])
ir /= np.sqrt((ir ** 2).sum(axis=1, keepdims=True))
size = 1 << int(math.ceil(math.log2(N + ir_len)))
wet = np.stack([np.fft.irfft(np.fft.rfft(send[c], size) * np.fft.rfft(ir[c], size), size)[:N] for c in range(2)])
mix = dry + 0.5 * wet

end = int(DUR * SR)
fade = np.ones(N)
fade[end - SR:end] = np.linspace(1, 0, SR)
fade[end:] = 0
mix *= fade
mix *= 10 ** (-6 / 20) / np.max(np.abs(mix))

pcm = (np.clip(mix, -1, 1).T * 32767).astype(np.int16)
with wave.open("out/score.wav", "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm[:end].tobytes())
print(f"score: {end / SR:.1f} s, {len(T['events'])} events, peak -6 dBFS")
