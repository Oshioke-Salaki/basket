/*
 * film.js: Basket's film, drawn from timeline.json. window.seek(t) is a pure function of t:
 * every element computes its whole state from t alone, so any frame can be rendered in any order.
 */

// ------------------------------------------------------------------ math
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const prog = (t, start, dur) => clamp((t - start) / dur);
const lerp = (a, b, k) => a + (b - a) * k;
const out3 = (k) => 1 - (1 - k) ** 3;
const in3 = (k) => k ** 3;
const inout = (k) => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2);
const back = (k, s = 1.7) => 1 + (s + 1) * (k - 1) ** 3 + s * (k - 1) ** 2;
const pulse = (t, c, h) => Math.max(0, 1 - Math.abs(t - c) / h);
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(2610); // spent only while building, never per frame

// ------------------------------------------------------------------ dom
function el(tag, cls, parent, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
}
const css = (e, s) => Object.assign(e.style, s);
const tf = (x, y, s = 1, r = 0, sx = null, sy = null) =>
  `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotate(${r.toFixed(3)}deg) scale(${(sx ?? s).toFixed(4)}, ${(sy ?? s).toFixed(4)})`;
const show = (e, on) => { e.style.visibility = on ? "visible" : "hidden"; };

let T; // the timeline
const BEAT = () => T.beat;

// ------------------------------------------------------------------ the moves

/** TEXT IN (slam) for one line: returns {opacity, y, scale}. */
function slam(t, t0) {
  const k = prog(t, t0, 0.2);
  return { o: clamp(5 * k), y: lerp(10, 0, out3(k)), s: lerp(1.08, 1, back(k)) };
}

/**
 * TEXT OUT (redact): one bar per line, measured from the line boxes. Returns an updater and the
 * time after which the words are hidden.
 */
function redactor(parent, boxes, t0) {
  const bars = boxes.map((b) => {
    const bar = el("div", "bar", parent);
    const h = b.h * 0.72;
    css(bar, { left: `${b.x - 10}px`, top: `${b.y + b.h / 2 + b.h * 0.05 - h / 2}px`, width: `${b.w + 20}px`, height: `${h}px` });
    return bar;
  });
  const hideAt = t0 === null ? Infinity : t0 + 0.03 * (boxes.length - 1) + 0.11;
  return {
    hideAt,
    update(t) {
      bars.forEach((bar, i) => {
        if (t0 === null) return show(bar, false);
        const s = t0 + 0.03 * i;
        if (t < s) return show(bar, false);
        show(bar, true);
        const r = s + 0.19;
        if (t < r) {
          bar.style.transformOrigin = "0 50%";
          bar.style.transform = `scaleX(${out3(prog(t, s, 0.11)).toFixed(4)})`;
        } else {
          const k = in3(prog(t, r, 0.13));
          if (k >= 1) return show(bar, false);
          bar.style.transformOrigin = "100% 50%";
          bar.style.transform = `scaleX(${(1 - k).toFixed(4)})`;
        }
      });
    },
  };
}

const LH = { display: 0.9, words: 0.98, mono: 1.25 };

function buildText(layer, spec) {
  const g = el("div", "abs", layer);
  css(g, { transform: `translate(${spec.x}px, ${spec.y}px)` });
  const lh = spec.size * LH[spec.font] + (spec.gap ?? (spec.font === "display" ? 0 : spec.size * 0.12));
  const lines = spec.lines.map((txt, i) => {
    const line = el("div", `line abs ${spec.font} c-${spec.color}`, g);
    css(line, { fontSize: `${spec.size}px`, top: `${i * lh}px`, transformOrigin: "0 60%" });
    const span = el("span", "", line);
    span.textContent = txt;
    return { line, span };
  });
  const boxes = lines.map(({ span }, i) => ({ x: 0, y: i * lh, w: span.offsetWidth, h: spec.size * LH[spec.font] }));
  const red = redactor(g, boxes, spec.out);
  return (t) => {
    lines.forEach(({ line }, i) => {
      const t0 = spec.in[i];
      if (t < t0 || t >= red.hideAt) return show(line, false);
      show(line, true);
      const m = slam(t, t0);
      line.style.opacity = m.o;
      line.style.transform = `translateY(${m.y}px) scale(${m.s})`;
    });
    red.update(t);
  };
}

function buildChapter(layer, spec) {
  const w = el("div", "abs display c-ink", layer);
  w.textContent = spec.word;
  css(w, { fontSize: "300px", transformOrigin: "0 0" });
  return (t) => {
    if (t < spec.t) return show(w, false);
    show(w, true);
    const m = slam(t, spec.t);
    const k = inout(prog(t, spec.t + 1.25 * BEAT(), 0.42));
    const x = 150 + 10 * k;
    const y = 330 - 262 * k;
    const s = lerp(1, 0.42, k) * m.s;
    w.style.opacity = m.o;
    w.style.transform = `translate(${x}px, ${y + m.y}px) scale(${s})`;
  };
}

function buildReveal(layer, spec) {
  const g = el("div", "abs", layer);
  css(g, { transform: `translate(${spec.x}px, ${spec.y}px)` });
  const word = el("div", "abs display c-ink", g);
  css(word, { fontSize: `${spec.size}px` });
  const span = el("span", "", word);
  span.textContent = spec.word;
  word.classList.add("line");
  const ww = span.offsetWidth + 40;
  const boxH = spec.size * 0.9;
  const top0 = boxH / 2 - (2 * 104 + 92) / 2;
  const bars = [0, 1, 2].map((i) => {
    const b = el("div", "bar", g);
    css(b, { left: "-20px", top: `${top0 + i * 104}px`, width: `${ww}px`, height: "92px" });
    return b;
  });
  return (t) => {
    show(word, t >= spec.reveal);
    bars.forEach((b, i) => {
      const g0 = spec.grow + (i * BEAT()) / 4;
      if (t < g0) return show(b, false);
      if (t < spec.reveal) {
        show(b, true);
        b.style.transformOrigin = "0 50%";
        b.style.transform = `scaleX(${out3(prog(t, g0, 0.24))})`;
        return;
      }
      const k = in3(prog(t, spec.reveal + 0.05 * i, 0.3));
      if (k >= 1) return show(b, false);
      show(b, true);
      b.style.transformOrigin = "100% 50%";
      b.style.transform = `scaleX(${1 - k})`;
    });
  };
}

/** Camera boxes: the box in force at t, moving between boxes with inout over 0.6, starting 0.3 early. */
function cameraBox(cam, t) {
  let box = cam[0].box;
  for (let i = 1; i < cam.length; i++) {
    const k = inout(prog(t, cam[i].t - 0.3, 0.6));
    if (k <= 0) break;
    const a = box, b = cam[i].box;
    box = { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k) };
  }
  return box;
}

function buildSheet(layer, spec, jolts, images) {
  const s = el("div", "abs sheet", layer);
  css(s, { width: `${spec.w}px`, height: `${spec.h}px`, willChange: "transform" });
  const img = el("img", "", s);
  img.decoding = "sync";
  img.src = `assets/${spec.src}`;
  const natural = images[spec.src];
  css(img, { width: `${natural.w / 2}px`, height: `${natural.h / 2}px` });
  const r = mulberry32(spec.seed);
  const dy = 660 + 100 * r();
  const dx = spec.kind === "screen" ? 160 + 80 * r() : 0;
  const tilt0 = spec.kind === "screen" ? (r() * 3 - 1.5) : (r() < 0.5 ? -4 : 4);
  return (t) => {
    if (t < spec.in) return show(s, false);
    show(s, true);
    const k = out3(prog(t, spec.in, 0.42));
    let x = spec.x + dx * (1 - k);
    let y = spec.y + dy * (1 - k);
    let rot = spec.kind === "screen" ? lerp(2.2 * tilt0, 0.5 * tilt0, k) : lerp(tilt0, 0, k);
    for (const j of jolts) {
      const p = pulse(t, j + 0.03, 0.1);
      x += 5 * p; y += 3 * p;
    }
    if (spec.out !== null && t >= spec.out) {
      const o = in3(prog(t, spec.out, 0.32));
      y += 900 * o; rot += -5 * o;
    }
    s.style.transform = tf(x, y, 1, rot);
    const box = cameraBox(spec.cam, t);
    const sc = spec.w / box.w;
    img.style.transform = `translate(${(-box.x * sc).toFixed(2)}px, ${(-box.y * sc).toFixed(2)}px) scale(${sc.toFixed(5)})`;
  };
}

function buildStamp(layer, spec) {
  const e = el("div", `abs stamp c-${spec.color}`, layer);
  e.textContent = spec.label;
  css(e, { fontSize: `${spec.size}px`, transformOrigin: "50% 50%" });
  return (t) => {
    if (t < spec.t) return show(e, false);
    const gone = spec.out ? in3(prog(t, spec.out, 0.15)) : 0;
    if (gone >= 1) return show(e, false);
    show(e, true);
    const k = prog(t, spec.t, 0.11);
    e.style.opacity = clamp(6 * k);
    e.style.transform = tf(spec.x, spec.y, lerp(1.9, 1, out3(k)) * (1 - gone), spec.rot);
  };
}

function buildPrinter(layer, spec) {
  const pitch = 34;
  const slot = el("div", "abs slot", layer);
  css(slot, { width: `${spec.w + 72}px`, height: "36px", zIndex: 3 });
  const wrap = el("div", "abs paperwrap", layer);
  css(wrap, { width: `${spec.w}px`, zIndex: 2 });
  const paper = el("div", "paper", wrap);
  const teeth = 24, depth = 12;
  const pts = ["0% 100%"];
  for (let i = 0; i <= teeth * 2; i++) pts.push(`${((i / (teeth * 2)) * 100).toFixed(3)}% ${i % 2 ? 0 : depth}px`);
  pts.push("100% 100%");
  paper.style.clipPath = `polygon(${pts.join(",")})`;
  const inner = el("div", "", paper);
  css(inner, { paddingTop: "48px" });
  spec.lines.forEach((l) => el("div", `pl${l.b ? " b" : ""}`, inner, `<span>${l.l}</span><span>${l.r}</span>`));
  const full = 48 + spec.lines.length * pitch + 22;
  return (t) => {
    const on = t >= spec.feeds[0] - 0.4 && t < spec.end;
    show(slot, on); show(wrap, on);
    if (!on) return;
    let fed = 0;
    for (const f of spec.feeds) fed += out3(prog(t, f, 0.09));
    const h = Math.min(full, 48 + fed * pitch + 22);
    const away = in3(prog(t, spec.tear, 0.42));
    const slotY = spec.y + 170 * away;
    slot.style.transform = `translate(${spec.x - 36}px, ${slotY}px)`;
    paper.style.height = `${h}px`;
    wrap.style.height = `${h}px`;
    // The paper's bottom stays in the slot; it rises as lines feed. Its content is pinned to the top.
    wrap.style.transform = tf(spec.x + 300 * away, spec.y + 18 - h - 1250 * away, 1, 10 * away);
  };
}

function buildSlips(layer, spec, dotsAt) {
  const W = 236, H = 168, G = 26;
  const cards = spec.items.map((it, i) => {
    const c = el("div", "abs slip", layer, `<div class="pin"></div><div class="t">${it.title}</div><div class="s">${it.sub}</div><div class="a">${it.amount}</div>`);
    css(c, { width: `${W}px`, height: `${H}px`, transformOrigin: "50% 0" });
    const col = i % spec.cols, row = Math.floor(i / spec.cols);
    return { c, x: spec.x + col * (W + G), y: spec.y + row * (H + G + 20), tilt: rand() * 5 - 2.5, t: it.t, i };
  });
  return (t) => {
    cards.forEach(({ c, x, y, tilt, t: t0, i }) => {
      if (t < t0) return show(c, false);
      const sk = inout(prog(t, spec.shrink, 0.32));
      if (sk >= 1) return show(c, false);
      show(c, true);
      const k = out3(prog(t, t0, 0.18));
      let px = x, py = y - 80 * (1 - k), sc = lerp(1.12, 1, k), rot = tilt * k;
      if (sk > 0) {
        const d = dotsAt(i);
        px = lerp(px, d.x - W / 2 + 11, sk); py = lerp(py, d.y - H / 2 + 11, sk);
        sc = lerp(sc, 0.1, sk); rot = lerp(rot, 0, sk);
        c.style.borderRadius = `${lerp(10, 90, sk)}px`;
      }
      c.style.transform = tf(px, py, sc, rot);
    });
  };
}

function buildCounter(layer, spec) {
  const g = el("div", "abs", layer);
  css(g, { transform: `translate(${spec.x}px, ${spec.y}px)` });
  const num = el("div", "abs display line c-ink", g);
  css(num, { fontSize: `${spec.size}px`, transformOrigin: "0 60%" });
  const span = el("span", "", num);
  const label = el("div", "abs words line c-muted", g);
  css(label, { fontSize: "44px", top: `${spec.size * 0.9 + 18}px` });
  const lspan = el("span", "", label);
  lspan.textContent = spec.label;
  const fmt = (v) => (spec.fmt === "pct" ? `+${v.toFixed(1)}%` : `${Math.round(v)}`);
  span.textContent = fmt(spec.to);
  const boxes = [
    { x: 0, y: 0, w: span.offsetWidth, h: spec.size * 0.9 },
    { x: 0, y: spec.size * 0.9 + 18, w: lspan.offsetWidth, h: 44 },
  ];
  const red = redactor(g, boxes, spec.out ?? null);
  const dots = [];
  if (spec.dots) {
    for (let i = 0; i < spec.to; i++) {
      const d = el("div", "dot", layer);
      const x = spec.dots.x + (i % 22) * 30, y = spec.dots.y + Math.floor(i / 22) * 30;
      css(d, { left: `${x}px`, top: `${y}px` });
      dots.push({ d, x, y });
    }
  }
  const valueAt = (t) => lerp(spec.from, spec.to, inout(prog(t, spec.t0, spec.t1 - spec.t0)));
  return {
    dotsAt: (i) => dots[Math.min(i, dots.length - 1)] ?? { x: spec.x, y: spec.y },
    update(t) {
      const on = t >= spec.t0 && t < red.hideAt;
      show(num, on); show(label, on);
      if (on) {
        const m = slam(t, spec.t0);
        num.style.opacity = m.o;
        num.style.transform = `translateY(${m.y}px) scale(${m.s})`;
        const v = valueAt(t);
        span.textContent = spec.fmt === "pct" ? fmt(Math.round(v * 10) / 10) : fmt(Math.round(v));
        const lm = slam(t, spec.t0 + 0.1);
        label.style.opacity = lm.o;
        label.style.transform = `translateY(${lm.y}px)`;
      }
      const n = t >= spec.t0 + 0.3 ? Math.round(valueAt(t)) : 0;
      dots.forEach(({ d }, i) => show(d, on && i < n));
      red.update(t);
    },
  };
}

function buildRows(layer, spec) {
  const g = el("div", "abs", layer);
  css(g, { transform: `translate(${spec.x}px, ${spec.y}px)` });
  const rows = spec.rows.map((r, i) => {
    const row = el("div", "abs mono", g);
    css(row, { top: `${i * 64}px`, fontSize: "34px", width: "1000px", display: "flex", justifyContent: "space-between" });
    const a = el("span", "", row); a.textContent = r[0];
    const b = el("span", "", row); b.textContent = r[1];
    const bars = [a, b].map((s) => {
      const bar = el("div", "bar", g);
      const w = s.offsetWidth + 20, x = s.offsetLeft - 10;
      css(bar, { left: `${x}px`, top: `${i * 64 + 6}px`, width: `${w}px`, height: "36px" });
      return bar;
    });
    return { row, bars };
  });
  return (t) => {
    rows.forEach(({ row, bars }, i) => {
      const t0 = spec.show + (i * BEAT()) / 8;
      if (t < t0) { show(row, false); bars.forEach((b) => show(b, false)); return; }
      show(row, true);
      const m = slam(t, t0);
      row.style.opacity = m.o;
      bars.forEach((b, j) => {
        const s = spec.redact[i] + 0.05 * j;
        if (t < s) return show(b, false);
        show(b, true);
        b.style.transform = `scaleX(${out3(prog(t, s, 0.09))})`;
      });
    });
  };
}

function buildTiles(layer, spec) {
  const tiles = spec.items.map((it, i) => {
    const e = el("div", "abs tile", layer, `<div><div class="t">${it.title}</div><div class="s">${it.sub}</div></div><div class="v">${it.value}</div>`);
    css(e, { width: `${spec.w}px`, height: "140px" });
    return { e, x: spec.x, y: spec.y + i * 162, t: spec.t[i], lift: spec.lift + (i * BEAT()) / 2 };
  });
  return (t) => {
    tiles.forEach(({ e, x, y, t: t0, lift }) => {
      if (t < t0) return show(e, false);
      const lk = in3(prog(t, lift, 0.2));
      if (lk >= 1) return show(e, false);
      show(e, true);
      const k = prog(t, t0, 0.22);
      const s = lerp(0.5, 1, back(k, 2));
      e.style.transform = tf(x - 200 * (1 - out3(k)), y - 26 * lk, 1, 0, s, s * (1 - lk));
    });
  };
}

function buildTrip(layer, spec) {
  const card = el("div", "abs sheet", layer);
  css(card, { width: "1000px", height: "560px", padding: "40px 44px" });
  el("div", "words c-muted", card, spec.title).style.fontSize = "34px";
  const total = el("div", "display c-ink", card, `${spec.total} <span class="c-muted" style="font-size:64px">${spec.home}</span>`);
  css(total, { fontSize: "120px", marginTop: "14px" });
  const rows = spec.rows.map((r, i) => {
    const row = el("div", "abs", layer);
    css(row, { width: "912px", display: "flex", justifyContent: "space-between", fontSize: "40px", borderTop: "1.5px solid #dad9d3", paddingTop: "18px" });
    row.className = "abs words";
    row.innerHTML = `<span>${r.title}</span><span class="c-red">${r.value}</span>`;
    return { row, x: spec.x + 44, y: spec.y + 290 + i * 80, t: spec.t[i] };
  });
  const r = mulberry32(17);
  const dy = 700 + 60 * r();
  return (t) => {
    if (t < spec.in) { show(card, false); rows.forEach(({ row }) => show(row, false)); return; }
    show(card, true);
    const k = out3(prog(t, spec.in, 0.42));
    card.style.transform = tf(spec.x, spec.y + dy * (1 - k), 1, lerp(-4, 0, k));
    rows.forEach(({ row, x, y, t: t0 }) => {
      if (t < t0) return show(row, false);
      show(row, true);
      const kk = out3(prog(t, t0, 0.18));
      row.style.transform = tf(x, y - 80 * (1 - kk), lerp(1.12, 1, kk));
    });
  };
}

function buildTag(layer, spec) {
  const tag = el("div", "abs tag", layer, `<div class="n">${spec.name}</div><div class="z">${spec.size}</div><div class="p">${spec.price}</div>`);
  const scan = el("div", "scan", tag);
  const tick = el("div", "abs tick", layer, `<svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`);
  return (t) => {
    if (t < spec.in) { show(tag, false); show(tick, false); return; }
    show(tag, true);
    const m = slam(t, spec.in);
    tag.style.opacity = m.o;
    tag.style.transform = tf(spec.x, spec.y + m.y, m.s, 1.5);
    const sweeping = t >= spec.scan && t < spec.tick + 0.2;
    show(scan, sweeping);
    if (sweeping) {
      const cyc = ((t - spec.scan) / 0.9) % 2;
      const k = inout(cyc < 1 ? cyc : 2 - cyc);
      scan.style.top = `${lerp(10, 230, k)}px`;
    }
    if (t < spec.tick) return show(tick, false);
    show(tick, true);
    const s = back(prog(t, spec.tick, 0.22));
    tick.style.transform = tf(spec.x + 420, spec.y - 40, Math.max(0, s));
  };
}

function buildPhone(layer, spec, images) {
  const p = el("div", "abs phone", layer);
  css(p, { width: `${spec.w}px`, height: `${spec.h}px` });
  const screen = el("div", "screen", p);
  const img = el("img", "", screen);
  img.decoding = "sync";
  img.src = `assets/${spec.src}`;
  const nat = images[spec.src];
  const innerW = spec.w - 28;
  const sc = innerW / (nat.w / 2);
  css(img, { width: `${nat.w / 2}px`, height: `${nat.h / 2}px` });
  return (t) => {
    if (t < spec.in) return show(p, false);
    show(p, true);
    const k = out3(prog(t, spec.in, 0.5));
    p.style.transform = tf(spec.x, spec.y + 900 * (1 - k), 1, lerp(4, 0, k));
    let y = spec.scroll[0].y;
    for (let i = 1; i < spec.scroll.length; i++) y = lerp(y, spec.scroll[i].y, inout(prog(t, spec.scroll[i].t, 0.55)));
    img.style.transform = `translate(0px, ${(-y * sc).toFixed(2)}px) scale(${sc.toFixed(5)})`;
  };
}

function caretOn(t, typingEnd, typing) {
  if (typing) return true;
  return Math.floor((t - typingEnd) / (BEAT() / 2)) % 2 === 1;
}

function buildTerminal(layer, spec) {
  const w = el("div", "abs term", layer, `<div class="tb"><i></i><i></i><i></i></div>`);
  css(w, { width: `${spec.w}px`, height: `${spec.h}px` });
  const body = el("div", "body", w);
  const cmdLine = el("div", "", body);
  const out = spec.lines.map((l) => {
    const d = el("div", "", body);
    d.innerHTML = l.startsWith("PASS") ? `<span class="ok">PASS</span>${l.slice(4)}` : l === "All checks passed." ? `<span class="ok">${l}</span>` : l;
    return d;
  });
  return (t) => {
    if (t < spec.in) return show(w, false);
    show(w, true);
    const k = out3(prog(t, spec.in, 0.45));
    w.style.transform = tf(spec.x + 260 * (1 - k), spec.y + 40 * (1 - k), 1, lerp(2, 0, k));
    const n = clamp(Math.floor((t - spec.type0) / spec.step) + 1, 0, spec.cmd.length);
    const end = spec.type0 + spec.cmd.length * spec.step;
    const typing = t >= spec.type0 && t < end;
    const caret = t < spec.lt[0] && caretOn(t, end, typing) ? `<span class="caret" style="background:#f3f3f0"></span>` : "";
    cmdLine.innerHTML = `<span class="ok">$</span> ${spec.cmd.slice(0, t >= spec.type0 ? n : 0)}${caret}`;
    out.forEach((d, i) => show(d, t >= spec.lt[i]));
  };
}

function buildTyped(layer, spec) {
  const e = el("div", "abs mono c-ink", layer);
  css(e, { fontSize: `${spec.size}px`, transform: `translate(${spec.x}px, ${spec.y}px)`, fontWeight: 500 });
  return (t) => {
    if (t < spec.t0) return show(e, false);
    show(e, true);
    const n = clamp(Math.floor((t - spec.t0) / spec.step) + 1, 0, spec.text.length);
    const end = spec.t0 + spec.text.length * spec.step;
    const caret = caretOn(t, end, t < end) ? `<span class="caret" style="background:#141414"></span>` : "";
    e.innerHTML = `${spec.text.slice(0, n)}${caret}`;
  };
}

/**
 * FLOATER: a colour emoji from everyday life. Pops in with an overshoot (back, s = 2.2) and a small
 * turn, bobs on the beat, and can rise, travel along a path, shrink, or pop out again.
 */
function buildFloater(layer, spec) {
  const e = el("div", "abs emoji", layer);
  e.textContent = spec.emoji;
  css(e, { fontSize: `${spec.size}px` });
  return (t) => {
    if (t < spec.t) return show(e, false);
    const outK = spec.out ? in3(prog(t, spec.out, 0.2)) : 0;
    if (outK >= 1) return show(e, false);
    show(e, true);
    const k = prog(t, spec.t, 0.32);
    let s = Math.max(0, back(k, 2.2)) * (1 - outK);
    let x = spec.x, y = spec.y;
    if (spec.path) {
      const pk = inout(prog(t, spec.path.t0, spec.path.t1 - spec.path.t0));
      x = lerp(spec.x, spec.path.x, pk);
      y = lerp(spec.y, spec.path.y, pk) - 120 * Math.sin(Math.PI * pk) * (spec.path.arc ?? 0);
    }
    if (spec.rise) y -= spec.rise * Math.max(0, t - spec.t);
    if (spec.shrink) s *= lerp(1, spec.shrink.to, out3(prog(t, spec.shrink.t, 0.3)));
    const bob = (spec.bob ?? 8) * Math.sin(((t - spec.t) / (2 * BEAT())) * 2 * Math.PI + (spec.phase ?? 0));
    const rot = lerp(-14, 0, out3(k)) + (spec.tilt ?? 0) + 2.5 * Math.sin(((t - spec.t) / (4 * BEAT())) * 2 * Math.PI);
    e.style.transform = tf(x, y + bob, s, rot);
  };
}

// ------------------------------------------------------------------ the mascot: the brand's bar with two eyes
function buildMascot(layer, spec) {
  const { w, h } = spec;
  const holder = el("div", "abs", layer);
  css(holder, { overflow: spec.peek ? "hidden" : "visible", width: `${w + 40}px`, height: `${spec.peek ? h + 10 : h + 200}px` });
  const m = el("div", "mascot", holder);
  css(m, { width: `${w}px`, height: `${h}px`, left: "20px", top: `${spec.peek ? 10 : 200}px` });
  const body = el("div", "body", m);
  body.style.borderRadius = `${0.2 * h}px`;
  if (spec.color) m.style.setProperty("--mascot", spec.color);
  const eyeD = 0.4 * h;
  const gap = 0.42 * eyeD;
  const eyes = [0, 1].map((i) => {
    const e = el("div", "eye", m);
    const right = 0.3 * h + (1 - i) * (eyeD + gap);
    css(e, { width: `${eyeD}px`, height: `${eyeD}px`, left: `${w - right - eyeD}px`, top: `${(h - eyeD) / 2}px` });
    const p = el("div", "pupil", e);
    const pd = 0.46 * eyeD;
    css(p, { width: `${pd}px`, height: `${pd}px`, left: `${(eyeD - pd) / 2}px`, top: `${(eyeD - pd) / 2}px` });
    return { e, p, room: (eyeD - pd) / 2 };
  });
  const track = spec.track;
  const find = (kind) => track.filter((a) => a.do === kind).map((a) => a.t);
  const enterT = find("enter")[0] ?? find("peek")[0] ?? -Infinity;
  const wakeT = find("wake")[0] ?? enterT;
  return (t) => {
    if (t < enterT - 0.2) return show(holder, false);
    show(holder, true);
    let x = spec.x, y = spec.y - (spec.peek ? h + 10 : h + 200);
    let sx = 1, sy = 1, rot = 0, up = 0;
    if (find("enter").length) {
      const k = out3(prog(t, enterT - 0.15, 0.42));
      x = lerp(1960, spec.x, k);
      const land = pulse(t, enterT + 0.27, 0.1);
      sx *= lerp(1, 1.1, land); sy *= lerp(1, 0.82, land);
    }
    let peekShift = 0;
    if (spec.peek) peekShift = (1 - out3(prog(t, enterT, 0.3))) * (h + 12);
    for (const hp of find("hop")) {
      const k = prog(t, hp, 0.34);
      if (k > 0 && k < 1) { up = 56 * Math.sin(Math.PI * k); sy *= 1 + 0.06 * Math.sin(Math.PI * k); }
      const land = pulse(t, hp + 0.34, 0.1);
      sx *= lerp(1, 1.1, land); sy *= lerp(1, 0.82, land);
    }
    holder.style.transform = `translate(${x - 20}px, ${y}px)`;
    m.style.transform = `translate(0px, ${(-up + peekShift).toFixed(2)}px) rotate(${rot}deg) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`;
    // Eyes: closed until wake, then blinks and winks.
    let open = t < wakeT ? 0.1 : lerp(0.1, 1, out3(prog(t, wakeT, 0.12)));
    let blink = 0;
    for (const b of find("blink")) blink = Math.max(blink, pulse(t, b, 0.075));
    let wink = 0;
    for (const b of find("wink")) wink = Math.max(wink, pulse(t, b, 0.16));
    const look = -0.7 + 0.4 * Math.sin((t - enterT) * 0.9);
    eyes.forEach(({ e, p, room }, i) => {
      const close = Math.max(blink, i === 1 ? wink : 0);
      e.style.transform = `scaleY(${(open * lerp(1, 0.1, close)).toFixed(4)})`;
      p.style.transform = `translate(${(look * room * 0.42 * 2).toFixed(2)}px, 0px)`;
    });
  };
}

// ------------------------------------------------------------------ wipes
function buildWipes(root, cuts) {
  const bars = Array.from({ length: 9 }, (_, i) => {
    const b = el("div", "wbar", root);
    css(b, { left: "-30px", top: `${6 + i * 120}px`, width: "1980px", height: "108px", background: T.wipeColors[i % T.wipeColors.length] });
    return b;
  });
  return (t) => {
    const cut = cuts.find((c) => t >= c - 0.5 && t <= c + 0.5);
    bars.forEach((b, i) => {
      if (cut === undefined) return show(b, false);
      const lag = 0.014 * i + 0.03 * (i % 2);
      const g0 = cut - 0.42 + lag, r0 = cut + 0.04 + lag;
      if (t < g0) return show(b, false);
      show(b, true);
      if (t < r0) { b.style.transformOrigin = "0 50%"; b.style.transform = `scaleX(${out3(prog(t, g0, 0.26))})`; return; }
      const k = in3(prog(t, r0, 0.26));
      if (k >= 1) return show(b, false);
      b.style.transformOrigin = "100% 50%";
      b.style.transform = `scaleX(${1 - k})`;
    });
  };
}

// ------------------------------------------------------------------ grain
function grain() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const img = g.createImageData(128, 128);
  const r = mulberry32(2610);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(r() * 255);
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  document.getElementById("grain").style.backgroundImage = `url(${c.toDataURL()})`;
}

// ------------------------------------------------------------------ build and seek
async function loadImages(names) {
  const out = {};
  await Promise.all(
    [...new Set(names)].map(
      (n) =>
        new Promise((res, rej) => {
          const i = new Image();
          i.onload = () => { out[n] = { w: i.naturalWidth, h: i.naturalHeight }; res(); };
          i.onerror = rej;
          i.src = `assets/${n}`;
        }),
    ),
  );
  return out;
}

async function main() {
  T = await (await fetch("timeline.json")).json();
  await document.fonts.load('800 100px "Archivo"');
  await document.fonts.load('400 20px "IBM Plex Mono"');
  await document.fonts.load('500 20px "IBM Plex Mono"');
  await document.fonts.ready;
  // Colour emoji glyphs, drawn once so the first frame that shows one is not a blank.
  const probe = el("div", "emoji", document.body);
  probe.textContent = [...new Set(T.scenes.flatMap((s) => s.els.filter((e) => e.emoji).map((e) => e.emoji)))].join("");
  css(probe, { position: "absolute", left: "-9999px", fontSize: "200px" });
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  grain();
  const images = await loadImages(T.scenes.flatMap((s) => s.els.filter((e) => e.src).map((e) => e.src)));
  const root = document.getElementById("scenes");
  const mascots = document.getElementById("mascots");
  const scenes = T.scenes.map((s) => {
    const layer = el("div", "scene", root);
    layer.style.setProperty("--bar", s.bar ?? "#141414");
    const mlayer = el("div", "scene", mascots);
    const stamps = s.els.filter((e) => e.type === "stamp").map((e) => e.t);
    let counterDots = null;
    const updaters = [];
    for (const spec of s.els) {
      switch (spec.type) {
        case "text": updaters.push(buildText(layer, spec)); break;
        case "chapter": updaters.push(buildChapter(layer, spec)); break;
        case "reveal": updaters.push(buildReveal(layer, spec)); break;
        case "sheet": updaters.push(buildSheet(layer, spec, stamps, images)); break;
        case "stamp": updaters.push(buildStamp(layer, spec)); break;
        case "printer": updaters.push(buildPrinter(layer, spec)); break;
        case "counter": { const c = buildCounter(layer, spec); if (spec.dots) counterDots = c.dotsAt; updaters.push(c.update); break; }
        case "slips": updaters.push(buildSlips(layer, spec, (i) => (counterDots ? counterDots(i) : { x: spec.x, y: spec.y }))); break;
        case "rows": updaters.push(buildRows(layer, spec)); break;
        case "tiles": updaters.push(buildTiles(layer, spec)); break;
        case "trip": updaters.push(buildTrip(layer, spec)); break;
        case "tag": updaters.push(buildTag(layer, spec)); break;
        case "phone": updaters.push(buildPhone(layer, spec, images)); break;
        case "terminal": updaters.push(buildTerminal(layer, spec)); break;
        case "typed": updaters.push(buildTyped(layer, spec)); break;
        case "mascot": updaters.push(buildMascot(mlayer, spec)); break;
        case "floater": updaters.push(buildFloater(layer, spec)); break;
        default: throw new Error(`unknown element ${spec.type}`);
      }
    }
    return { s, layer, mlayer, updaters };
  });
  const wipes = buildWipes(document.getElementById("wipe"), T.cuts);
  const bg = document.getElementById("bg");
  window.seek = (t) => {
    for (const { s, layer, mlayer, updaters } of scenes) {
      const on = t >= s.start && t < s.end;
      if (on) bg.style.background = s.bg ?? "#f3f3f0";
      layer.style.display = on ? "block" : "none";
      mlayer.style.display = on ? "block" : "none";
      if (on) for (const u of updaters) u(t);
    }
    wipes(t);
  };
  window.seek(0);
  // Every image decoded before the first capture.
  await Promise.all([...document.images].map((i) => i.decode().catch(() => {})));
  window.filmReady = true;
}
main().catch((e) => { window.filmError = String(e?.stack || e); console.error(e); });
