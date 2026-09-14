/* ═══════════════════════════════════════════════════════════════════════════
   a11y/probe.js — injected into the page. Exposes window.__A11Y.scan(root,opts)

   For every element that renders its own text (HTML) and every SVG <text> /
   <tspan>, it works out:
     · the COMPUTED foreground   (color, or fill for SVG, alpha-composited)
     · the EFFECTIVE background  (walk ancestors through transparent /
       rgba(…,0); compose alpha over what is behind rather than ignoring it;
       for SVG, hit-test the painted shapes that precede the text in the same
       <svg> and stack them over the SVG's own HTML backdrop)
     · the WCAG 2.1 contrast ratio and the threshold that applies
     · the CSS rule that set the colour (selector + declaration)
   Elements with no size, hidden, clipped away, or fully occluded by an opaque
   overlay are not reported.

   Also probes the meaningful non-text graphics (chart bars, the today line,
   milestones, focus rings) at the 3:1 threshold.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  /* ---------- colour ---------- */
  const WHITE = { r: 255, g: 255, b: 255, a: 1 };
  function parseColor(s) {
    if (!s) return null;
    s = String(s).trim();
    if (s === "transparent" || s === "none") return { r: 0, g: 0, b: 0, a: 0 };
    let m = /^rgba?\(([^)]+)\)$/.exec(s);
    if (m) {
      const p = m[1].split(/[,\/\s]+/).filter(Boolean).map(x => x.trim());
      const n = v => v.endsWith("%") ? parseFloat(v) * 2.55 : parseFloat(v);
      const a = p.length > 3 ? (p[3].endsWith("%") ? parseFloat(p[3]) / 100 : parseFloat(p[3])) : 1;
      return { r: n(p[0]), g: n(p[1]), b: n(p[2]), a: isNaN(a) ? 1 : a };
    }
    m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
    if (m) {
      let h = m[1]; if (h.length === 3) h = h.split("").map(c => c + c).join("");
      return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
    }
    /* colour keywords, color(srgb …) — what color-mix() computes to — oklch(),
       lab(): let a 1×1 canvas resolve whatever the engine produced. Without
       this, color-mix() reads back as null and every --behind swatch would be
       silently reported as black. */
    const c = viaCanvas(s);
    return c;
  }
  let _ctx = null;
  function viaCanvas(s) {
    try {
      if (!_ctx) { const cv = document.createElement("canvas"); cv.width = cv.height = 1; _ctx = cv.getContext("2d", { willReadFrequently: true }); }
      _ctx.clearRect(0, 0, 1, 1);
      _ctx.fillStyle = "#010203";                 // sentinel: unparsable input leaves it
      _ctx.fillStyle = s;
      if (_ctx.fillStyle === "#010203" && !/^#010203$/i.test(s.trim())) return null;
      _ctx.fillRect(0, 0, 1, 1);
      const d = _ctx.getImageData(0, 0, 1, 1).data;
      return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
    } catch (e) { return null; }
  }
  function over(fg, bg) {                       // fg composited onto opaque bg
    const a = Math.max(0, Math.min(1, fg.a));
    return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 };
  }
  function lum(c) {
    const f = v => { v = Math.max(0, Math.min(255, v)) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  function ratio(a, b) { const L1 = lum(a), L2 = lum(b); return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); }
  function hex(c) { const h = v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0"); return "#" + h(c.r) + h(c.g) + h(c.b); }

  /* ---------- the ancestor chain, root → element ---------- */
  function chain(el) {
    const out = []; let n = el;
    while (n && n.nodeType === 1) { out.push(n); n = n.parentElement; }
    return out.reverse();
  }
  /* gradient stops, so `background:var(--btn)` (a linear-gradient) is not
     silently treated as transparent. Returns every colour stop it can see. */
  function gradientStops(bgImage) {
    if (!bgImage || bgImage === "none") return [];
    const out = [];
    const re = /rgba?\([^)]*\)/g; let m;
    while ((m = re.exec(bgImage))) { const c = parseColor(m[0]); if (c) out.push(c); }
    return out;
  }
  /* effective background(s) behind `el`'s own text box.
     Returns 1..N opaque colours (N > 1 only when a gradient is in the stack;
     the caller takes the WORST). */
  function effBg(el, canvas) {
    let accs = [canvas];
    let cum = 1, img = false;
    for (const n of chain(el)) {
      const cs = getComputedStyle(n);
      const op = parseFloat(cs.opacity); if (!isNaN(op)) cum *= op;
      const c = parseColor(cs.backgroundColor);
      if (c && c.a > 0) accs = accs.map(a => over({ r: c.r, g: c.g, b: c.b, a: c.a * cum }, a));
      if (/url\(/.test(cs.backgroundImage || "")) img = true;
      const stops = gradientStops(cs.backgroundImage);
      if (stops.length) {
        const next = [];
        for (const a of accs) for (const s of stops) next.push(over({ r: s.r, g: s.g, b: s.b, a: s.a * cum }, a));
        /* keep only the lightest and the darkest — they bracket the worst case */
        next.sort((x, y) => lum(x) - lum(y));
        accs = next.length > 2 ? [next[0], next[next.length - 1]] : next;
      }
    }
    return { bgs: accs, cum: cum, img: img };
  }

  /* an <img> painted behind the element (the Dashboard banner) makes the real
     background user content we cannot sample — those are advisories, not fails */
  function imageBehind(el, rect) {
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    for (const im of document.images) {
      if (im === el || im.contains(el)) continue;
      if (!(el.compareDocumentPosition(im) & Node.DOCUMENT_POSITION_PRECEDING)) continue;
      const b = im.getBoundingClientRect();
      if (!b.width || !b.height) continue;
      if (cx >= b.left && cx <= b.right && cy >= b.top && cy <= b.bottom) return true;
    }
    return false;
  }

  /* ---------- SVG ---------- */
  const PAINTED = "rect,circle,ellipse,polygon,path,polyline";
  function svgBg(textEl, canvas) {
    const svg = textEl.ownerSVGElement || textEl.closest("svg");
    if (!svg) return effBg(textEl, canvas);
    const base = effBg(svg, canvas);
    const r = textEl.getBoundingClientRect();
    if (!r.width || !r.height) return base;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let accs = base.bgs.slice();
    const shapes = svg.querySelectorAll(PAINTED);
    for (const s of shapes) {
      /* only shapes painted BEFORE the text can be behind it */
      const pos = textEl.compareDocumentPosition(s);
      if (!(pos & Node.DOCUMENT_POSITION_PRECEDING)) continue;
      const cs = getComputedStyle(s);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      const f = parseColor(cs.fill);
      if (!f) continue;
      const fo = parseFloat(cs.fillOpacity);
      let a = f.a * (isNaN(fo) ? 1 : fo);
      /* ancestor <g> opacity (the <svg>'s own is already in `base`) */
      let n = s; while (n && n !== svg) { const o = parseFloat(getComputedStyle(n).opacity); if (!isNaN(o)) a *= o; n = n.parentElement; }
      if (a <= 0.02) continue;
      const b = s.getBoundingClientRect();
      if (!b.width || !b.height) continue;
      if (cx < b.left - 0.5 || cx > b.right + 0.5 || cy < b.top - 0.5 || cy > b.bottom + 0.5) continue;
      accs = accs.map(x => over({ r: f.r, g: f.g, b: f.b, a: a }, x));
    }
    return { bgs: accs, cum: base.cum, svg: true };
  }

  /* ---------- visibility ---------- */
  function firstTextRect(el) {
    for (const n of el.childNodes) {
      if (n.nodeType === 3 && n.nodeValue && n.nodeValue.trim()) {
        try { const rg = document.createRange(); rg.selectNodeContents(n); const rs = rg.getClientRects(); if (rs.length) return rs[0]; } catch (e) { }
      }
    }
    const r = el.getBoundingClientRect();
    return r.width && r.height ? r : null;
  }
  function clippedAway(el, rect) {
    let n = el.parentElement;
    while (n && n !== document.body) {
      const cs = getComputedStyle(n);
      if (cs.overflowX !== "visible" || cs.overflowY !== "visible") {
        const b = n.getBoundingClientRect();
        if (b.width && b.height) {
          const ix = Math.min(rect.right, b.right) - Math.max(rect.left, b.left);
          const iy = Math.min(rect.bottom, b.bottom) - Math.max(rect.top, b.top);
          if (ix <= 0.5 || iy <= 0.5) return true;
        }
      }
      n = n.parentElement;
    }
    return false;
  }
  function occluded(el, rect) {
    const x = Math.min(rect.left + Math.min(6, rect.width / 2), window.innerWidth - 1);
    const y = Math.min(rect.top + rect.height / 2, window.innerHeight - 1);
    if (x < 0 || y < 0) return false;
    const hit = document.elementFromPoint(x, y);
    if (!hit) return false;
    if (hit === el || el.contains(hit) || hit.contains(el)) return false;
    const hb = parseColor(getComputedStyle(hit).backgroundColor);
    return !!(hb && hb.a > 0.9);                   // only an OPAQUE overlay hides text
  }
  function visible(el) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return false;
    if (parseFloat(cs.opacity) === 0) return false;
    return true;
  }
  /* WCAG 2.1 SC 1.4.3 / 1.4.11 both exempt INACTIVE user-interface components.
     A :disabled control (and anything inside one) therefore has no contrast
     requirement — see FINDINGS.md §"deliberately not flagged". */
  function inactive(el) {
    let n = el;
    while (n && n.nodeType === 1) {
      if (n.disabled === true) return true;
      if (n.getAttribute && (n.getAttribute("aria-disabled") === "true" || n.hasAttribute("disabled"))) return true;
      n = n.parentElement;
    }
    return false;
  }

  /* ---------- which CSS rule set this ---------- */
  const RULES = [];                                // flattened, in cascade order
  function collectRules() {
    if (RULES.length) return RULES;
    let order = 0;
    const walk = (list, sheetHref) => {
      for (const r of list) {
        if (r.type === 1 /* STYLE */) RULES.push({ sel: r.selectorText, style: r.style, order: order++, href: sheetHref });
        else if (r.cssRules) walk(r.cssRules, sheetHref);
      }
    };
    for (const sh of document.styleSheets) {
      let list; try { list = sh.cssRules; } catch (e) { continue; }
      if (list) walk(list, sh.href || (sh.ownerNode && sh.ownerNode.getAttribute("data-src")) || "");
    }
    return RULES;
  }
  function specificity(sel) {
    let s = sel.replace(/\\./g, "");
    const ids = (s.match(/#[\w-]+/g) || []).length;
    const cls = (s.match(/\.[\w-]+|\[[^\]]*\]|:(?!:)(?:not|is|where)?\b[\w-]+(\([^)]*\))?/g) || []).length;
    const typ = (s.match(/(^|[\s>+~(])[a-zA-Z][\w-]*/g) || []).length;
    return ids * 10000 + cls * 100 + typ;
  }
  const NOT_A_COLOUR = /^(inherit|unset|initial|revert|currentcolor)$/i;
  function ruleFor(el, prop, pseudo) {
    const rules = collectRules();
    const strip = s => pseudo ? s.replace(pseudo, "") : s;
    let best = null;
    for (const r of rules) {
      const v = r.style.getPropertyValue(prop);
      if (!v) continue;
      if (/color|fill|stroke/.test(prop) && NOT_A_COLOUR.test(v.trim())) continue;
      if (pseudo && r.sel.indexOf(pseudo) < 0) continue;
      if (!pseudo && /::(before|after|placeholder|selection|marker)/.test(r.sel)) continue;
      let ok = false;
      for (const part of r.sel.split(",")) { try { if (el.matches(strip(part.trim()))) { ok = true; break; } } catch (e) { } }
      if (!ok) continue;
      const imp = r.style.getPropertyPriority(prop) === "important" ? 1 : 0;
      const rank = [imp, specificity(r.sel), r.order];
      if (!best || rank[0] > best.rank[0] || (rank[0] === best.rank[0] && (rank[1] > best.rank[1] || (rank[1] === best.rank[1] && rank[2] > best.rank[2])))) {
        let matched = r.sel;
        for (const part of r.sel.split(",")) { try { if (el.matches(strip(part.trim()))) { matched = part.trim(); break; } } catch (e) { } }
        best = { rank: rank, sel: matched, full: r.sel, value: v.trim(), href: r.href };
      }
    }
    if (el.style && el.style.getPropertyValue(prop) && !NOT_A_COLOUR.test(el.style.getPropertyValue(prop).trim())) {
      return { rank: [2, 99999, 99999], sel: "(inline style on " + pathOf(el, null) + ")", full: "(inline style)", value: el.style.getPropertyValue(prop), href: "" };
    }
    return best;
  }
  /* colour properties inherit: when nothing targets the element itself, the
     colour was set on an ancestor — report THAT rule, flagged as inherited. */
  function ruleForInherited(el, prop, pseudo) {
    let n = el, hops = 0;
    while (n && n.nodeType === 1) {
      const r = ruleFor(n, prop, pseudo);
      if (r) { if (hops) { r.sel = r.sel + "  (inherited by " + el.tagName.toLowerCase() + (el.className && el.className.baseVal !== undefined ? "." + el.className.baseVal : (el.className ? "." + String(el.className).split(" ").join(".") : "")) + ")"; r.inherited = true; } return r; }
      n = n.parentElement; hops++;
      if (hops > 12) break;
    }
    return null;
  }
  /* every ancestor (inclusive) that dims the element, and the rule that does it */
  function opacityChain(el) {
    const out = []; let n = el, cum = 1;
    while (n && n.nodeType === 1) {
      const o = parseFloat(getComputedStyle(n).opacity);
      if (!isNaN(o) && o < 0.999) {
        cum *= o;
        const r = ruleFor(n, "opacity");
        out.push({ sel: r ? r.sel : pathOf(n, null), value: r ? r.value : String(o) });
      }
      n = n.parentElement;
    }
    return { cum: cum, rules: out };
  }

  /* ---------- a readable path for the element ---------- */
  function pathOf(el, root) {
    const bits = [];
    let n = el;
    while (n && n !== root && n !== document.body && bits.length < 5) {
      let s = n.tagName.toLowerCase();
      if (n.classList && n.classList.length) s += "." + Array.from(n.classList).join(".");
      for (const a of ["data-state", "data-kind", "data-projected", "data-paused"]) if (n.hasAttribute && n.hasAttribute(a)) s += "[" + a + (n.getAttribute(a) ? '="' + n.getAttribute(a) + '"' : "") + "]";
      bits.unshift(s);
      n = n.parentElement;
    }
    return bits.join(" > ");
  }

  function boxOf(r) { return r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null; }

  /* ---------- thresholds ---------- */
  function threshold(px, weight) {
    const w = parseInt(weight, 10) || 400;
    if (px >= 24) return 3;
    if (px >= 18.66 && w >= 700) return 3;
    return 4.5;
  }

  /* ---------- the scan ---------- */
  function scan(root, opts) {
    opts = opts || {};
    const canvasC = parseColor(getComputedStyle(document.body).backgroundColor);
    const canvas = canvasC && canvasC.a > 0 ? over(canvasC, WHITE) : WHITE;
    const out = [];
    const push = o => out.push(o);

    const all = root.querySelectorAll("*");
    for (const el of all) {
      const tag = el.tagName.toLowerCase();
      const isSvgText = (tag === "text" || tag === "tspan") && el.ownerSVGElement;
      let ownText = "";
      for (const n of el.childNodes) if (n.nodeType === 3 && n.nodeValue && n.nodeValue.trim()) ownText += n.nodeValue;
      ownText = ownText.replace(/\s+/g, " ").trim();

      /* ---- text ---- */
      if (ownText && visible(el) && !inactive(el)) {
        const rect = firstTextRect(el);
        if (rect && rect.width >= 1 && rect.height >= 1 && !clippedAway(el, rect) && !occluded(el, rect)) {
          const cs = getComputedStyle(el);
          const px = parseFloat(cs.fontSize) || 16;
          const th = threshold(px, cs.fontWeight);
          let fgRaw, prop, bgInfo;
          if (isSvgText) {
            prop = "fill";
            const f = parseColor(cs.fill) || { r: 0, g: 0, b: 0, a: 1 };
            const fo = parseFloat(cs.fillOpacity); f.a = f.a * (isNaN(fo) ? 1 : fo);
            fgRaw = f;
            bgInfo = svgBg(el, canvas);
          } else {
            prop = "color";
            fgRaw = parseColor(cs.color) || { r: 0, g: 0, b: 0, a: 1 };
            bgInfo = effBg(el, canvas);
          }
          const fgA = Object.assign({}, fgRaw, { a: fgRaw.a * bgInfo.cum });
          let worst = null;
          for (const bg of bgInfo.bgs) {
            const fg = over(fgA, bg);
            const rr = ratio(fg, bg);
            if (!worst || rr < worst.ratio) worst = { ratio: rr, fg: fg, bg: bg };
          }
          if (worst && bgInfo.cum > 0.02) {
            const rule = ruleForInherited(el, prop);
            const op = opacityChain(el);
            const onImage = !!bgInfo.img || imageBehind(el, rect);
            push({
              kind: "text", path: pathOf(el, root), text: ownText.slice(0, 70), rect: boxOf(rect),
              fg: hex(worst.fg), bg: hex(worst.bg), rawFg: (isSvgText ? cs.fill : cs.color),
              ratio: +worst.ratio.toFixed(2), threshold: th, px: +px.toFixed(1), weight: cs.fontWeight,
              prop: prop, sel: rule ? rule.sel : "(no rule \u2014 UA default)", decl: rule ? rule.value : (isSvgText ? cs.fill : cs.color),
              href: rule ? rule.href : "", inherited: !!(rule && rule.inherited),
              opacity: +op.cum.toFixed(3), opacityRules: op.rules, onImage: onImage,
              pass: worst.ratio >= th || onImage, advisory: onImage && worst.ratio < th,
            });
          }
        }
      }

      /* ---- ::placeholder ---- */
      if ((tag === "input" || tag === "textarea") && el.getAttribute("placeholder") && visible(el) && !inactive(el)) {
        const r = el.getBoundingClientRect();
        if (r.width >= 1 && r.height >= 1) {
          const ps = getComputedStyle(el, "::placeholder");
          const cs = getComputedStyle(el);
          const fg = parseColor(ps.color) || parseColor(cs.color);
          if (fg) {
            const bgInfo = effBg(el, canvas);
            const px = parseFloat(ps.fontSize || cs.fontSize) || 16;
            const th = threshold(px, ps.fontWeight || cs.fontWeight);
            let worst = null;
            for (const bg of bgInfo.bgs) { const f = over(Object.assign({}, fg, { a: fg.a * bgInfo.cum }), bg); const rr = ratio(f, bg); if (!worst || rr < worst.ratio) worst = { ratio: rr, fg: f, bg: bg }; }
            const rule = ruleFor(el, "color", "::placeholder") || ruleForInherited(el, "color");
            const op = opacityChain(el);
            push({
              kind: "placeholder", path: pathOf(el, root) + "::placeholder", text: el.getAttribute("placeholder").slice(0, 70), rect: boxOf(el.getBoundingClientRect()),
              fg: hex(worst.fg), bg: hex(worst.bg), rawFg: ps.color, ratio: +worst.ratio.toFixed(2), threshold: th,
              px: +px.toFixed(1), weight: ps.fontWeight || cs.fontWeight, prop: "color",
              sel: rule ? rule.sel : "(placeholder)", decl: rule ? rule.value : ps.color, href: rule ? rule.href : "",
              opacity: +op.cum.toFixed(3), opacityRules: op.rules, pass: worst.ratio >= th,
            });
          }
        }
      }
    }

    /* ---- meaningful non-text graphics: 3:1 ---- */
    const GRAPHICS = opts.graphics || [];
    for (const g of GRAPHICS) {
      let els; try { els = root.querySelectorAll(g.sel); } catch (e) { continue; }
      for (const el of els) {
        if (!visible(el) || inactive(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        const cs = getComputedStyle(el);
        let prop = g.prop || "fill";
        let c = parseColor(prop === "stroke" ? cs.stroke : (prop === "border" ? cs.borderTopColor : cs.fill));
        if (!c) continue;
        let a = c.a;
        if (prop === "fill") { const fo = parseFloat(cs.fillOpacity); a *= isNaN(fo) ? 1 : fo; }
        if (prop === "stroke") { const so = parseFloat(cs.strokeOpacity); a *= isNaN(so) ? 1 : so; }
        if (a <= 0.01) continue;
        /* ground = what the shape sits on, excluding the shape itself */
        const svg = el.ownerSVGElement;
        let ground;
        if (svg) {
          const base = effBg(svg, canvas);
          ground = base.bgs;
          /* stack any preceding painted sibling that covers the shape's centre */
          const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
          for (const s of svg.querySelectorAll(PAINTED)) {
            if (s === el) continue;
            if (!(el.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_PRECEDING)) continue;
            const scs = getComputedStyle(s);
            const f = parseColor(scs.fill); if (!f) continue;
            const fo = parseFloat(scs.fillOpacity); const fa = f.a * (isNaN(fo) ? 1 : fo);
            if (fa <= 0.02) continue;
            const b = s.getBoundingClientRect();
            if (!b.width || cx < b.left || cx > b.right || cy < b.top || cy > b.bottom) continue;
            ground = ground.map(x => over({ r: f.r, g: f.g, b: f.b, a: fa }, x));
          }
        } else {
          ground = effBg(el.parentElement || el, canvas).bgs;
        }
        let worst = null;
        for (const bg of ground) { const fg = over({ r: c.r, g: c.g, b: c.b, a: a }, bg); const rr = ratio(fg, bg); if (!worst || rr < worst.ratio) worst = { ratio: rr, fg: fg, bg: bg }; }
        /* a shape whose FILL is low-contrast is still perceivable when it is
           outlined: WCAG 1.4.11 asks for the boundary, not the fill. Take the
           better of fill-vs-ground and stroke-vs-ground. */
        let via = prop;
        if (prop === "fill") {
          const sw = parseFloat(cs.strokeWidth) || 0;
          const sc = parseColor(cs.stroke);
          if (sw > 0 && sc) {
            const so = parseFloat(cs.strokeOpacity);
            const sa = sc.a * (isNaN(so) ? 1 : so);
            if (sa > 0.05) {
              let sBest = null;
              for (const bg of ground) { const fg = over({ r: sc.r, g: sc.g, b: sc.b, a: sa }, bg); const rr = ratio(fg, bg); if (!sBest || rr < sBest.ratio) sBest = { ratio: rr, fg: fg, bg: bg }; }
              if (sBest && sBest.ratio > worst.ratio) { worst = sBest; via = "stroke"; c = sc; a = sa; }
            }
          }
        }
        const rule = ruleForInherited(el, via === "border" ? "border-color" : via);
        const op = opacityChain(el);
        prop = via;
        push({
          kind: "graphic", label: g.label, path: pathOf(el, root), text: "", rect: boxOf(r),
          fg: hex(worst.fg), bg: hex(worst.bg), rawFg: prop === "stroke" ? cs.stroke : (prop === "border" ? cs.borderTopColor : cs.fill),
          ratio: +worst.ratio.toFixed(2), threshold: 3, px: 0, weight: "", prop: prop,
          sel: rule ? rule.sel : "(no rule)", decl: rule ? rule.value : String(c && hex(c)), href: rule ? rule.href : "",
          opacity: +op.cum.toFixed(3), opacityRules: op.rules, pass: worst.ratio >= 3,
        });
      }
    }
    return out;
  }

  window.__A11Y = { scan: scan, ratio: ratio, parseColor: parseColor, hex: hex, over: over, lum: lum };
})();
