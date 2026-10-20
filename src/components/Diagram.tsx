import { useId, useMemo } from 'react';
import type { DColor, DiagramElement, DiagramSpec } from '../types';
import { add, compassOffset, cross, len, makeFrame, mul, resolvePoints, sub, unit, type Frame, type V } from '../lib/diagram';
import { compile, tryParse } from '../lib/math/expr';
import { getDiagram } from '../data';

const col = (c: DColor | undefined, fallback: DColor = 'main') => `var(--dg-${c ?? fallback})`;

interface Props {
  spec?: DiagramSpec;
  id?: string;
  className?: string;
  /** Compact thumbnail (thinner strokes, no small text). */
  thumb?: boolean;
  title?: string;
}

export function Diagram({ spec, id, className, thumb, title }: Props) {
  const resolved = spec ?? (id ? getDiagram(id) : undefined);
  const clipId = useId().replace(/:/g, '');
  const content = useMemo(() => {
    if (!resolved) return null;
    try {
      return render(resolved, clipId, !!thumb);
    } catch (e) {
      console.error(e);
      return null;
    }
  }, [resolved, clipId, thumb]);
  if (!resolved || !content) return null;
  const frame = content.frame;
  return (
    <svg
      viewBox={`0 0 ${frame.width} ${frame.height}`}
      className={className}
      role="img"
      aria-label={title ?? 'שרטוט'}
      style={{ direction: 'ltr' }}
      fontFamily="inherit"
    >
      {content.nodes}
    </svg>
  );
}

function render(spec: DiagramSpec, clipId: string, thumb: boolean): { frame: Frame; nodes: React.ReactNode[] } {
  const frame = makeFrame(spec);
  const model = resolvePoints(spec);
  const P = (name: string): V => {
    const m = model[name];
    if (!m) throw new Error(`Diagram ${spec.id}: unknown point ${name}`);
    return frame.toView(m);
  };
  const sw = thumb ? 2.2 : 1.8;
  const nodes: React.ReactNode[] = [];
  const labelled: string[] = [];
  spec.elements.forEach((el) => {
    if (el.t === 'pts' && !el.nolabel) labelled.push(...el.p);
  });
  const centroid: V = labelled.length
    ? mul(labelled.map(P).reduce((a, b) => add(a, b), [0, 0] as V), 1 / labelled.length)
    : [frame.width / 2, frame.height / 2];

  if (frame.math && frame.window) {
    nodes.push(
      <defs key="defs">
        <clipPath id={clipId}>
          <rect x={0} y={0} width={frame.width} height={frame.height} />
        </clipPath>
      </defs>,
    );
  }

  const dashArr = (d?: boolean) => (d ? '5 4' : undefined);
  const extend = (a: V, b: V, ext: number): [V, V] => {
    const u = unit(sub(b, a));
    return [sub(a, mul(u, ext)), add(b, mul(u, ext))];
  };

  spec.elements.forEach((el: DiagramElement, i) => {
    const key = `e${i}`;
    switch (el.t) {
      case 'seg':
      case 'line':
      case 'ray': {
        let a = P(el.p[0]);
        let b = P(el.p[1]);
        if (el.t === 'line') [a, b] = extend(a, b, el.ext ?? 28);
        else if (el.t === 'ray') b = extend(a, b, el.ext ?? 28)[1];
        else if (el.ext) [a, b] = extend(a, b, el.ext);
        nodes.push(
          <line
            key={key}
            x1={a[0]}
            y1={a[1]}
            x2={b[0]}
            y2={b[1]}
            stroke={col(el.c)}
            strokeWidth={el.w ?? sw}
            strokeDasharray={dashArr(el.dash)}
            strokeLinecap="round"
          />,
        );
        break;
      }
      case 'poly':
      case 'path': {
        const pts = el.p.map(P);
        const d = pts.map((p, j) => `${j ? 'L' : 'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ') + (el.t === 'poly' ? ' Z' : '');
        nodes.push(
          <path
            key={key}
            d={d}
            fill={el.t === 'poly' && el.fill ? col(el.fill) : 'none'}
            fillOpacity={el.t === 'poly' && el.fill ? 0.16 : undefined}
            stroke={col(el.c)}
            strokeWidth={el.w ?? sw}
            strokeDasharray={dashArr(el.dash)}
            strokeLinejoin="round"
          />,
        );
        break;
      }
      case 'circle': {
        const o = P(el.o);
        const r = el.through ? len(sub(P(el.through), o)) : (el.r ?? 50) * frame.scale;
        nodes.push(
          <circle
            key={key}
            cx={o[0]}
            cy={o[1]}
            r={r}
            fill={el.fill ? col(el.fill) : 'none'}
            fillOpacity={el.fill ? 0.14 : undefined}
            stroke={col(el.c)}
            strokeWidth={el.w ?? sw}
            strokeDasharray={dashArr(el.dash)}
          />,
        );
        break;
      }
      case 'ellipse': {
        const o = P(el.o);
        const rx = el.rx * frame.scale;
        const ry = el.ry * frame.scale;
        const common = {
          fill: el.fill ? col(el.fill) : 'none',
          fillOpacity: el.fill ? 0.14 : undefined,
          stroke: col(el.c),
          strokeWidth: sw,
          strokeDasharray: dashArr(el.dash),
        };
        if (!el.half) nodes.push(<ellipse key={key} cx={o[0]} cy={o[1]} rx={rx} ry={ry} {...common} />);
        else {
          // front = lower half (sweep through +y on screen), back = upper half
          const sweep = el.half === 'front' ? 0 : 1;
          nodes.push(
            <path key={key} d={`M${o[0] - rx},${o[1]} A${rx},${ry} 0 0 ${sweep} ${o[0] + rx},${o[1]}`} {...common} fill="none" />,
          );
        }
        break;
      }
      case 'arc': {
        const o = P(el.o);
        const a = P(el.from);
        const b = P(el.to);
        const r = len(sub(a, o));
        const a1 = Math.atan2(a[1] - o[1], a[0] - o[0]);
        const a2 = Math.atan2(b[1] - o[1], b[0] - o[0]);
        let sweep = a1 - a2; // visual counter-clockwise amount
        while (sweep < 0) sweep += 2 * Math.PI;
        const large = sweep > Math.PI ? 1 : 0;
        const end = add(o, mul(unit(sub(b, o)), r));
        nodes.push(
          <path
            key={key}
            d={`M${a[0]},${a[1]} A${r},${r} 0 ${large} 0 ${end[0]},${end[1]}`}
            fill="none"
            stroke={col(el.c, 'accent')}
            strokeWidth={el.w ?? 3.2}
            strokeDasharray={dashArr(el.dash)}
            strokeLinecap="round"
            strokeOpacity={0.85}
          />,
        );
        break;
      }
      case 'angle': {
        const [A, Vx, B] = el.p.map(P);
        const u1 = unit(sub(A, Vx));
        const u2 = unit(sub(B, Vx));
        const r0 = el.r ?? 18;
        const n = el.n ?? 1;
        const sweepFlag = cross(u1, u2) > 0 ? 1 : 0;
        const c = col(el.c, 'accent');
        if (el.fill) {
          const s = add(Vx, mul(u1, r0));
          const e = add(Vx, mul(u2, r0));
          nodes.push(
            <path
              key={`${key}f`}
              d={`M${Vx[0]},${Vx[1]} L${s[0]},${s[1]} A${r0},${r0} 0 0 ${sweepFlag} ${e[0]},${e[1]} Z`}
              fill={c}
              fillOpacity={0.18}
              stroke="none"
            />,
          );
        }
        for (let k = 0; k < n; k++) {
          const r = r0 + k * 4;
          const s = add(Vx, mul(u1, r));
          const e = add(Vx, mul(u2, r));
          nodes.push(
            <path
              key={`${key}-${k}`}
              d={`M${s[0]},${s[1]} A${r},${r} 0 0 ${sweepFlag} ${e[0]},${e[1]}`}
              fill="none"
              stroke={c}
              strokeWidth={1.6}
            />,
          );
        }
        if (el.label && !thumb) {
          let bis = unit(add(u1, u2));
          if (len(add(u1, u2)) < 1e-6) bis = [-u1[1], u1[0]];
          const lp = add(Vx, mul(bis, r0 + (n - 1) * 4 + 11));
          nodes.push(
            <text key={`${key}l`} x={lp[0]} y={lp[1]} fill={c} fontSize={12.5} textAnchor="middle" dominantBaseline="central" fontWeight={600}>
              {el.label}
            </text>,
          );
        }
        break;
      }
      case 'right': {
        const [A, Vx, B] = el.p.map(P);
        const s = 10;
        const u1 = mul(unit(sub(A, Vx)), s);
        const u2 = mul(unit(sub(B, Vx)), s);
        const p1 = add(Vx, u1);
        const p2 = add(add(Vx, u1), u2);
        const p3 = add(Vx, u2);
        nodes.push(
          <path key={key} d={`M${p1[0]},${p1[1]} L${p2[0]},${p2[1]} L${p3[0]},${p3[1]}`} fill="none" stroke={col(el.c, 'accent')} strokeWidth={1.5} />,
        );
        break;
      }
      case 'tick': {
        const a = P(el.p[0]);
        const b = P(el.p[1]);
        const m = mul(add(a, b), 0.5);
        const u = unit(sub(b, a));
        const nrm: V = [-u[1], u[0]];
        const n = el.n ?? 1;
        for (let k = 0; k < n; k++) {
          const c = add(m, mul(u, (k - (n - 1) / 2) * 4.5));
          const p1 = add(c, mul(nrm, 5.5));
          const p2 = sub(c, mul(nrm, 5.5));
          nodes.push(<line key={`${key}-${k}`} x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]} stroke={col(el.c, 'accent')} strokeWidth={1.7} />);
        }
        break;
      }
      case 'par': {
        const a = P(el.p[0]);
        const b = P(el.p[1]);
        const m = mul(add(a, b), 0.5);
        const u = unit(sub(b, a));
        const nrm: V = [-u[1], u[0]];
        const n = el.n ?? 1;
        for (let k = 0; k < n; k++) {
          const tip = add(m, mul(u, (k - (n - 1) / 2) * 5 + 3));
          const l = add(sub(tip, mul(u, 6)), mul(nrm, 4.5));
          const r = sub(sub(tip, mul(u, 6)), mul(nrm, 4.5));
          nodes.push(
            <path key={`${key}-${k}`} d={`M${l[0]},${l[1]} L${tip[0]},${tip[1]} L${r[0]},${r[1]}`} fill="none" stroke={col(el.c, 'accent')} strokeWidth={1.6} />,
          );
        }
        break;
      }
      case 'vec': {
        const a = P(el.p[0]);
        const b = P(el.p[1]);
        const u = unit(sub(b, a));
        const nrm: V = [-u[1], u[0]];
        const base = sub(b, mul(u, 10));
        const l = add(base, mul(nrm, 4.5));
        const r = sub(base, mul(nrm, 4.5));
        nodes.push(
          <g key={key}>
            <line x1={a[0]} y1={a[1]} x2={base[0]} y2={base[1]} stroke={col(el.c, 'accent')} strokeWidth={el.w ?? 2.2} strokeDasharray={dashArr(el.dash)} />
            <path d={`M${b[0]},${b[1]} L${l[0]},${l[1]} L${r[0]},${r[1]} Z`} fill={col(el.c, 'accent')} />
          </g>,
        );
        break;
      }
      case 'pts': {
        el.p.forEach((name, k) => {
          const p = P(name);
          nodes.push(
            <circle
              key={`${key}-${k}`}
              cx={p[0]}
              cy={p[1]}
              r={thumb ? 2.6 : 2.8}
              fill={el.open ? 'var(--dg-bg)' : col(el.c)}
              stroke={col(el.c)}
              strokeWidth={el.open ? 1.6 : 0}
            />,
          );
          if (!el.nolabel && !thumb) {
            const pos = spec.lpos?.[name];
            let off: V;
            if (pos) off = compassOffset(pos);
            else {
              const d = sub(p, centroid);
              off = len(d) < 1 ? [0, -13] : mul(unit(d), 13);
            }
            const lp = add(p, off);
            nodes.push(
              <text key={`${key}-${k}l`} x={lp[0]} y={lp[1]} fill={col(el.c)} fontSize={13} fontWeight={600} textAnchor="middle" dominantBaseline="central">
                {name.replace(/_(\w+)/, '$1').replace(/'/g, '′')}
              </text>,
            );
          }
        });
        break;
      }
      case 'label': {
        if (thumb) break;
        const p = add(P(el.p), compassOffset(el.pos ?? 'n', 14));
        nodes.push(
          <text key={key} x={p[0]} y={p[1]} fill={col(el.c)} fontSize={el.size ?? 12.5} textAnchor="middle" dominantBaseline="central">
            {el.s}
          </text>,
        );
        break;
      }
      case 'seglabel': {
        if (thumb) break;
        const a = P(el.p[0]);
        const b = P(el.p[1]);
        const m = mul(add(a, b), 0.5);
        const u = unit(sub(b, a));
        let nrm: V = [-u[1], u[0]];
        // default: away from the centroid
        if (el.side === undefined) {
          if (len(sub(add(m, nrm), centroid)) < len(sub(sub(m, nrm), centroid))) nrm = mul(nrm, -1);
        } else nrm = mul(nrm, el.side);
        const p = add(m, mul(nrm, 12));
        nodes.push(
          <text key={key} x={p[0]} y={p[1]} fill={col(el.c, 'accent2')} fontSize={el.size ?? 12.5} fontWeight={600} textAnchor="middle" dominantBaseline="central">
            {el.s}
          </text>,
        );
        break;
      }
      case 'text': {
        if (thumb && (el.size ?? 13) < 14) break;
        const p = frame.math ? frame.toView(el.at) : el.at;
        nodes.push(
          <text
            key={key}
            x={p[0]}
            y={p[1]}
            fill={col(el.c)}
            fontSize={el.size ?? 13}
            fontWeight={el.bold ? 700 : 500}
            textAnchor={el.anchor ?? 'middle'}
            dominantBaseline="central"
          >
            {el.s}
          </text>,
        );
        break;
      }
      case 'axes': {
        if (!frame.window) break;
        const [x0, x1, y0, y1] = frame.window;
        const span = Math.max(x1 - x0, el.noY ? 0 : y1 - y0);
        const step = el.step ?? niceStep(span / 10);
        const g: React.ReactNode[] = [];
        if (el.grid && !thumb) {
          for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) {
            const a = frame.toView([x, y0]);
            const b = frame.toView([x, y1]);
            g.push(<line key={`gx${x}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="var(--dg-grid)" strokeWidth={1} />);
          }
          if (!el.noY)
            for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) {
              const a = frame.toView([x0, y]);
              const b = frame.toView([x1, y]);
              g.push(<line key={`gy${y}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="var(--dg-grid)" strokeWidth={1} />);
            }
        }
        const yAxisX = Math.min(Math.max(0, x0), x1);
        const xAxisY = el.noY ? 0 : Math.min(Math.max(0, y0), y1);
        const xa = frame.toView([x0, xAxisY]);
        const xb = frame.toView([x1, xAxisY]);
        g.push(<line key="xa" x1={xa[0]} y1={xa[1]} x2={xb[0] - 2} y2={xb[1]} stroke="var(--dg-axis)" strokeWidth={1.4} />);
        g.push(<path key="xh" d={`M${xb[0]},${xb[1]} l-8,-4 l0,8 Z`} fill="var(--dg-axis)" />);
        if (!thumb) g.push(<text key="xl" x={xb[0] - 6} y={xb[1] - 11} fontSize={12} fill="var(--dg-axis)" textAnchor="middle">{el.x ?? 'x'}</text>);
        if (!el.noY) {
          const ya = frame.toView([yAxisX, y0]);
          const yb = frame.toView([yAxisX, y1]);
          g.push(<line key="ya" x1={ya[0]} y1={ya[1]} x2={yb[0]} y2={yb[1] + 2} stroke="var(--dg-axis)" strokeWidth={1.4} />);
          g.push(<path key="yh" d={`M${yb[0]},${yb[1]} l-4,8 l8,0 Z`} fill="var(--dg-axis)" />);
          if (!thumb) g.push(<text key="yl" x={yb[0] + 11} y={yb[1] + 6} fontSize={12} fill="var(--dg-axis)" textAnchor="middle">{el.y ?? 'y'}</text>);
        }
        if (el.labels !== false && !thumb) {
          for (let x = Math.ceil(x0 / step) * step; x <= x1 - step * 0.5; x += step) {
            if (Math.abs(x) < 1e-9) continue;
            const p = frame.toView([x, xAxisY]);
            g.push(<line key={`tx${x}`} x1={p[0]} y1={p[1] - 3} x2={p[0]} y2={p[1] + 3} stroke="var(--dg-axis)" strokeWidth={1} />);
            g.push(
              <text key={`txl${x}`} x={p[0]} y={p[1] + 12} fontSize={9.5} fill="var(--dg-muted)" textAnchor="middle">
                {+x.toFixed(4)}
              </text>,
            );
          }
          if (!el.noY)
            for (let y = Math.ceil(y0 / step) * step; y <= y1 - step * 0.5; y += step) {
              if (Math.abs(y) < 1e-9) continue;
              const p = frame.toView([yAxisX, y]);
              g.push(<line key={`ty${y}`} x1={p[0] - 3} y1={p[1]} x2={p[0] + 3} y2={p[1]} stroke="var(--dg-axis)" strokeWidth={1} />);
              g.push(
                <text key={`tyl${y}`} x={p[0] - 6} y={p[1]} fontSize={9.5} fill="var(--dg-muted)" textAnchor="end" dominantBaseline="central">
                  {+y.toFixed(4)}
                </text>,
              );
            }
        }
        nodes.push(<g key={key}>{g}</g>);
        break;
      }
      case 'fn': {
        if (!frame.window) break;
        const ast = tryParse(el.f);
        if (!ast) throw new Error(`Diagram ${spec.id}: bad function ${el.f}`);
        const f = compile(ast);
        const [x0, x1, y0, y1] = frame.window;
        const a = Math.max(el.dom?.[0] ?? x0, x0);
        const b = Math.min(el.dom?.[1] ?? x1, x1);
        const N = 400;
        const H = y1 - y0;
        let d = '';
        let pen = false;
        let prevY = NaN;
        for (let k = 0; k <= N; k++) {
          const x = a + ((b - a) * k) / N;
          const y = f(x);
          const ok = Number.isFinite(y) && y > y0 - 3 * H && y < y1 + 3 * H;
          if (!ok || (pen && Math.abs(y - prevY) > 2 * H)) {
            pen = false;
            prevY = y;
            if (!ok) continue;
          }
          const p = frame.toView([x, y]);
          d += `${pen ? 'L' : 'M'}${p[0].toFixed(2)},${p[1].toFixed(2)} `;
          pen = true;
          prevY = y;
        }
        nodes.push(
          <path
            key={key}
            d={d}
            fill="none"
            stroke={col(el.c, 'accent')}
            strokeWidth={el.w ?? 2.4}
            strokeDasharray={dashArr(el.dash)}
            clipPath={`url(#${clipId})`}
            strokeLinejoin="round"
          />,
        );
        if (el.label && !thumb) {
          const lx = b - (b - a) * 0.08;
          const ly = f(lx);
          if (Number.isFinite(ly) && ly > y0 && ly < y1) {
            const p = frame.toView([lx, ly]);
            nodes.push(
              <text key={`${key}l`} x={p[0]} y={p[1] - 12} fontSize={12} fill={col(el.c, 'accent')} textAnchor="middle" fontWeight={600}>
                {el.label}
              </text>,
            );
          }
        }
        break;
      }
      case 'area': {
        const ast = tryParse(el.f);
        const gast = tryParse(el.g ?? '0');
        if (!ast || !gast) throw new Error(`Diagram ${spec.id}: bad area`);
        const f = compile(ast);
        const g = compile(gast);
        const [a, b] = el.dom;
        const N = 120;
        const top: V[] = [];
        const bottom: V[] = [];
        for (let k = 0; k <= N; k++) {
          const x = a + ((b - a) * k) / N;
          top.push(frame.toView([x, f(x)]));
          bottom.push(frame.toView([x, g(x)]));
        }
        const pts = [...top, ...bottom.reverse()];
        nodes.push(
          <path
            key={key}
            d={pts.map((p, j) => `${j ? 'L' : 'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ') + ' Z'}
            fill={col(el.c, 'accent2')}
            fillOpacity={0.25}
            stroke="none"
            clipPath={`url(#${clipId})`}
          />,
        );
        break;
      }
      case 'vline':
      case 'hline': {
        if (!frame.window) break;
        const [x0, x1, y0, y1] = frame.window;
        const a = el.t === 'vline' ? frame.toView([el.x, y0]) : frame.toView([x0, el.y]);
        const b = el.t === 'vline' ? frame.toView([el.x, y1]) : frame.toView([x1, el.y]);
        nodes.push(
          <line key={key} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={col(el.c, 'warn')} strokeWidth={1.5} strokeDasharray={el.dash === false ? undefined : '5 4'} />,
        );
        if (el.label && !thumb) {
          const p = el.t === 'vline' ? [b[0] + 4, b[1] + 12] : [a[0] + 6, a[1] - 9];
          nodes.push(
            <text key={`${key}l`} x={p[0]} y={p[1]} fontSize={11} fill={col(el.c, 'warn')} textAnchor="start">
              {el.label}
            </text>,
          );
        }
        break;
      }
    }
  });
  return { frame, nodes };
}

function niceStep(raw: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  const n = m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10;
  return n * p;
}
