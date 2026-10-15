import { useEffect, useRef, useState } from "react";

/* ---------- konstanta & aset ---------- */

const DEPTH = 0.35; // jarak wayang ke kelir (tetap)

// Layout virtual: landscape untuk layar lebar, portrait untuk layar tegak (mobile first)
const LAYOUTS = {
  portrait: {
    vw: 500,
    vh: 800,
    k: { x: 24, y: 40, w: 452, h: 570 },
    trunkY: 615,
    moon: { x: 370, y: 150, r: 30 },
    s: 1.2,
    stars: 130,
    seed: 7,
  },
  landscape: {
    vw: 800,
    vh: 500,
    k: { x: 40, y: 30, w: 720, h: 370 },
    trunkY: 405,
    moon: { x: 610, y: 115, r: 34 },
    s: 0.9,
    stars: 150,
    seed: 11,
  },
};

function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// bintang dibuat sekali di level modul (deterministik, tanpa Math.random saat render)
for (const L of Object.values(LAYOUTS)) {
  const rnd = mulberry32(L.seed);
  const { k } = L;
  L.starList = Array.from({ length: L.stars }, () => {
    const big = rnd() < 0.1;
    return {
      x: k.x - 10 + rnd() * (k.w + 20),
      y: k.y - 10 + rnd() * (k.h * 0.85),
      r: big ? 1.2 + rnd() * 0.6 : 0.4 + rnd() * 0.7,
      dur: 2 + rnd() * 4,
      delay: -rnd() * 5,
    };
  });
}

// Gunungan: siluet + lubang ukiran (fill-rule evenodd)
const circle = (x, y, r) =>
  `M${x - r},${y}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0Z`;

const GUNUNGAN = (() => {
  let d =
    "M0,-150C22,-112 74,-72 82,-8C90,62 72,118 62,142L-62,142C-72,118 -90,62 -82,-8C-74,-72 -22,-112 0,-150Z";
  d += "M-26,136L-26,98Q0,66 26,98L26,136Z"; // pintu
  d += "M-4,64L-4,-62L4,-62L4,64Z"; // batang pohon hayat
  d += circle(0, -92, 10);
  [
    [24, -62, 9],
    [32, -22, 9],
    [34, 18, 8],
    [22, 50, 6],
    [52, -40, 6],
    [58, 0, 6],
    [56, 36, 6],
    [16, -34, 5],
    [14, 6, 5],
  ].forEach(([x, y, r]) => {
    d += circle(x, y, r) + circle(-x, y, r);
  });
  return d;
})();

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- komponen ---------- */

export default function Index() {
  const [portrait, setPortrait] = useState(
    () => typeof window === "undefined" || window.matchMedia("(orientation: portrait)").matches,
  );
  const [touched, setTouched] = useState(false);

  const L = portrait ? LAYOUTS.portrait : LAYOUTS.landscape;
  const { vw, vh, k, moon } = L;

  const svgRef = useRef(null);
  const refs = {
    kel: useRef(null),
    sky: useRef(null),
    layer: useRef(null),
    front: useRef(null),
    lamp: useRef(null),
    body: useRef(null),
    wy: useRef(null),
    sh: useRef(null),
    gb: useRef(null),
  };
  const S = useRef({ T: { x: 0, y: 0 }, CT: { x: 0, y: 0 }, drag: null, L });

  // orientasi layar
  useEffect(() => {
    const mq = window.matchMedia("(orientation: portrait)");
    const on = (e) => setPortrait(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  // loop animasi: parallax, ayunan, bayangan
  useEffect(() => {
    const s = S.current;
    s.L = L;
    const home = { x: k.x + k.w / 2, y: k.y + k.h * 0.58 };
    s.T = { ...home };
    s.CT = { x: 0, y: 0 };
    const P = { ...home };
    const C = { x: 0, y: 0 };
    let tilt = 0;
    let raf;

    const sw = L.s * (1 + DEPTH * 0.35);
    const kk = 1 + DEPTH * 1.1; // pembesaran bayangan terhadap lampu
    const lx = k.x + k.w / 2;
    const ly = k.y - 20;
    const el = Object.fromEntries(Object.entries(refs).map(([n, r]) => [n, r.current]));

    el.gb.setAttribute("stdDeviation", (0.6 + DEPTH * 7).toFixed(2));
    el.sh.setAttribute("opacity", (0.9 - DEPTH * 0.4).toFixed(2));

    const tr = (e, x, y) => e.setAttribute("transform", `translate(${x},${y})`);

    const tick = (t) => {
      const px = P.x;
      P.x += (s.T.x - P.x) * 0.2;
      P.y += (s.T.y - P.y) * 0.2;
      tilt += (clamp((P.x - px) * 2.4, -22, 22) - tilt) * 0.15;
      C.x += (s.CT.x - C.x) * 0.07;
      C.y += (s.CT.y - C.y) * 0.07;
      const cx = C.x + Math.sin(t / 2600) * 0.25;
      const cy = C.y + Math.cos(t / 3100) * 0.2;

      tr(el.kel, -cx * 9, -cy * 5);
      tr(el.sky, cx * 6, cy * 3.5);
      tr(el.layer, -cx * (14 + DEPTH * 14), -cy * (8 + DEPTH * 8));
      tr(el.front, -cx * 20, -cy * 10);
      tr(el.lamp, -cx * 30, -cy * 14);
      tr(el.body, -cx * 38, -cy * 16);

      el.wy.setAttribute("transform", `translate(${P.x},${P.y}) rotate(${tilt}) scale(${sw})`);
      const sx = lx + (P.x - lx) * kk;
      const sy = ly + (P.y - ly) * kk;
      el.sh.setAttribute("transform", `translate(${sx},${sy}) rotate(${tilt}) scale(${sw * kk})`);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L]);

  /* ---------- interaksi ---------- */

  const toSvg = (e) => {
    const svg = svgRef.current;
    const p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    return p.matrixTransform(svg.getScreenCTM().inverse());
  };

  const bounds = () => {
    const { k: kr, s: sc } = S.current.L;
    return {
      x: [kr.x + 50 * sc, kr.x + kr.w - 50 * sc],
      y: [kr.y + kr.h * 0.38, kr.y + kr.h * 0.64],
    };
  };

  const onDown = (e) => {
    const s = S.current;
    const p = toSvg(e);
    s.drag = { dx: s.T.x - p.x, dy: s.T.y - p.y };
    e.currentTarget.setPointerCapture(e.pointerId);
    setTouched(true);
  };

  const onMove = (e) => {
    const s = S.current;
    const p = toSvg(e);
    s.CT.x = clamp((p.x - s.L.vw / 2) / (s.L.vw / 2), -1, 1);
    s.CT.y = clamp((p.y - s.L.vh / 2) / (s.L.vh / 2), -1, 1);
    if (s.drag) {
      const b = bounds();
      s.T.x = clamp(p.x + s.drag.dx, b.x[0], b.x[1]);
      s.T.y = clamp(p.y + s.drag.dy, b.y[0], b.y[1]);
    }
  };

  const onUp = () => {
    S.current.drag = null;
  };

  /* ---------- render ---------- */

  return (
    <main
      className="relative h-dvh w-full cursor-grab touch-none overflow-hidden bg-[#05040a] select-none active:cursor-grabbing"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <style>{`
        @keyframes wy-tw{from{opacity:.15}to{opacity:1}}
        @keyframes wy-fl{0%{opacity:.9}30%{opacity:1}55%{opacity:.78}80%{opacity:.96}100%{opacity:.88}}
      `}</style>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${vw} ${vh}`}
        className="block h-full w-full"
        role="img"
        aria-label="Pertunjukan wayang kulit dari sudut pandang dalang: gunungan di depan kelir dengan langit malam, bintang, dan bulan"
      >
        <defs>
          <clipPath id="wy-kc">
            <rect x={k.x} y={k.y} width={k.w} height={k.h} />
          </clipPath>
          <radialGradient id="wy-sky" cx="50%" cy="100%" r="115%">
            <stop offset="0" stopColor="#22336a" />
            <stop offset=".55" stopColor="#0c1436" />
            <stop offset="1" stopColor="#04050f" />
          </radialGradient>
          <radialGradient id="wy-moon" cx="40%" cy="38%">
            <stop offset="0" stopColor="#fffbe8" />
            <stop offset="1" stopColor="#d8cfa6" />
          </radialGradient>
          <radialGradient id="wy-glow" cx="50%" cy="8%" r="80%">
            <stop offset="0" stopColor="#ffc060" stopOpacity=".62" />
            <stop offset=".5" stopColor="#ff8a2a" stopOpacity=".2" />
            <stop offset="1" stopColor="#ff8a2a" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="wy-vg" cx="50%" cy="45%" r="75%">
            <stop offset=".55" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity=".8" />
          </radialGradient>
          <linearGradient id="wy-gdg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#6a4524" />
            <stop offset=".5" stopColor="#3a2310" />
            <stop offset="1" stopColor="#1c0f06" />
          </linearGradient>
          <pattern id="wy-gd" width="64" height="55" patternUnits="userSpaceOnUse">
            <rect width="64" height="55" fill="url(#wy-gdg)" />
            <path d="M0 0V55" stroke="#150a04" strokeWidth="3" opacity=".7" />
            <path d="M0 18H64M0 38H64" stroke="#8a6034" strokeWidth=".8" opacity=".25" />
          </pattern>
          <filter id="wy-cloth">
            <feTurbulence type="fractalNoise" baseFrequency=".9 .5" numOctaves="2" seed="3" />
            <feColorMatrix values="0 0 0 0 .95 0 0 0 0 .85 0 0 0 0 .62 0 0 0 .6 -.12" />
          </filter>
          <filter id="wy-bm" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur ref={refs.gb} stdDeviation="3" />
          </filter>
          <filter id="wy-b14" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
          <filter id="wy-b6" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
          <g id="wy-gun">
            <path d={GUNUNGAN} fillRule="evenodd" />
            <path d="M-3 140V540H3V140Z" />
          </g>
        </defs>

        <rect width={vw} height={vh} fill="#05040a" />

        {/* kelir + langit malam */}
        <g ref={refs.kel}>
          <g clipPath="url(#wy-kc)">
            <g ref={refs.sky}>
              <rect
                x={k.x - 20}
                y={k.y - 20}
                width={k.w + 40}
                height={k.h + 40}
                fill="url(#wy-sky)"
              />
              {L.starList.map((st, i) => (
                <circle
                  key={i}
                  cx={st.x.toFixed(1)}
                  cy={st.y.toFixed(1)}
                  r={st.r.toFixed(2)}
                  className="animate-[wy-tw_3s_ease-in-out_infinite_alternate] fill-white motion-reduce:animate-none"
                  style={{ animationDuration: `${st.dur.toFixed(1)}s`, animationDelay: `${st.delay.toFixed(1)}s` }}
                />
              ))}
              <circle cx={moon.x} cy={moon.y} r={moon.r * 1.8} fill="#fff4c0" opacity=".28" filter="url(#wy-b14)" />
              <circle cx={moon.x} cy={moon.y} r={moon.r} fill="url(#wy-moon)" />
              <circle cx={moon.x - moon.r * 0.35} cy={moon.y - moon.r * 0.26} r={moon.r * 0.18} fill="#c8bd92" opacity=".5" />
              <circle cx={moon.x + moon.r * 0.35} cy={moon.y + moon.r * 0.26} r={moon.r * 0.24} fill="#c8bd92" opacity=".45" />
              <circle cx={moon.x - moon.r * 0.12} cy={moon.y + moon.r * 0.44} r={moon.r * 0.12} fill="#c8bd92" opacity=".5" />
            </g>
            <rect x={k.x} y={k.y} width={k.w} height={k.h} filter="url(#wy-cloth)" opacity=".3" />
            <rect x={k.x} y={k.y} width={k.w} height={k.h} fill="#e8d6a8" opacity=".07" />
            <rect x={k.x} y={k.y} width={k.w} height={k.h} fill="url(#wy-glow)" />
            <g filter="url(#wy-bm)">
              <use ref={refs.sh} href="#wy-gun" fill="#07030a" />
            </g>
          </g>
          <rect x={k.x} y={k.y} width={k.w} height={k.h} fill="none" stroke="#1a0f08" strokeWidth="16" />
          <rect x={k.x + 8} y={k.y + 8} width={k.w - 16} height={k.h - 16} fill="none" stroke="#4a2e18" strokeWidth="1.5" opacity=".7" />
        </g>

        {/* wayang (gunungan) */}
        <g ref={refs.layer}>
          <use ref={refs.wy} href="#wy-gun" fill="#0d0706" stroke="#e09a40" strokeWidth="1.4" strokeOpacity=".55" />
        </g>

        {/* gedebog */}
        <g ref={refs.front}>
          <rect x="-60" y={L.trunkY} width={vw + 120} height="55" fill="url(#wy-gd)" />
          <rect x="-60" y={L.trunkY} width={vw + 120} height="3" fill="#8a6034" opacity=".5" />
          <rect x="-60" y={L.trunkY + 55} width={vw + 120} height={vh} fill="#060304" />
        </g>

        {/* blencong */}
        <g ref={refs.lamp}>
          <g className="animate-[wy-fl_1.7s_infinite] motion-reduce:animate-none">
            <ellipse cx={vw / 2} cy={k.y - 14} rx="44" ry="52" fill="#ff9a30" opacity=".5" filter="url(#wy-b14)" />
            <ellipse cx={vw / 2} cy={k.y - 10} rx="12" ry="22" fill="#ffd98a" filter="url(#wy-b6)" />
            <ellipse cx={vw / 2} cy={k.y - 6} rx="5" ry="11" fill="#fff6d8" filter="url(#wy-b6)" />
          </g>
        </g>

        {/* siluet dalang di depan (blur) */}
        <g ref={refs.body}>
          <ellipse cx={vw * 0.05} cy={vh + 20} rx={vw * 0.24} ry="110" fill="#040203" filter="url(#wy-b6)" />
          <ellipse cx={vw * 0.95} cy={vh + 20} rx={vw * 0.24} ry="110" fill="#040203" filter="url(#wy-b6)" />
        </g>

        <rect width={vw} height={vh} fill="url(#wy-vg)" pointerEvents="none" />
      </svg>

      <p
        className={`pointer-events-none absolute inset-x-0 bottom-4 px-4 text-center font-serif text-xs tracking-wide text-amber-100/60 transition-opacity duration-700 sm:bottom-6 sm:text-sm ${
          touched ? "opacity-0" : "opacity-100"
        }`}
      >
        Seret gunungan untuk menggerakkannya
      </p>
    </main>
  );
}
