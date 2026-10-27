import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { Audio } from '@remotion/media';

interface DiagramNode {
  id: string;
  label: string;
  type?: 'default' | 'decision' | 'start' | 'end' | 'process' | 'data';
  color?: string;
}

interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
  style?: 'solid' | 'dashed' | 'arrow';
}

interface DiagramBlockData {
  type: 'diagram';
  diagramType: 'flowchart' | 'hierarchy' | 'sequence' | 'mindmap' | 'network';
  title?: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  layout?: 'vertical' | 'horizontal' | 'radial';
  templateId?: string;
  primaryColor?: string;
  backgroundColor?: string;
  audioSrc?: string;
  audioVolume?: number;
}

interface DiagramSceneProps {
  data: DiagramBlockData;
  theme: string;
  motionProfile: string;
  animation?: { enter: number; hold: number; exit: number };
}

interface LayoutNode {
  id: string;
  label: string;
  nodeType: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

// ─── Layout Algorithms ───────────────────────────────────────────────────────

function layoutVertical(nodes: DiagramNode[], edges: DiagramEdge[], W: number, H: number): LayoutNode[] {
  const inDegree: Record<string, number> = {};
  const adj: Record<string, string[]> = {};
  nodes.forEach((n) => { inDegree[n.id] = 0; adj[n.id] = []; });
  edges.forEach((e) => {
    if (adj[e.from]) adj[e.from].push(e.to);
    inDegree[e.to] = (inDegree[e.to] || 0) + 1;
  });

  const levels: string[][] = [];
  const visited = new Set<string>();
  let queue = nodes.filter((n) => (inDegree[n.id] || 0) === 0).map((n) => n.id);
  if (queue.length === 0) queue = nodes.slice(0, 1).map((n) => n.id);

  while (queue.length > 0) {
    const level = [...queue];
    levels.push(level);
    level.forEach((id) => visited.add(id));
    const next: string[] = [];
    queue.forEach((id) => {
      (adj[id] || []).forEach((child) => {
        if (!visited.has(child) && !next.includes(child)) next.push(child);
      });
    });
    queue = next;
  }
  nodes.forEach((n) => {
    if (!visited.has(n.id)) {
      if (levels.length > 0) levels[levels.length - 1].push(n.id);
      else levels.push([n.id]);
    }
  });

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const maxPerRow = Math.max(...levels.map((l) => l.length), 1);
  const nw = Math.min(180, (W - 80) / maxPerRow - 24);
  const nh = 64;
  const topPad = 110;
  const usableH = H - topPad - 60;
  const yGap = levels.length > 1 ? (usableH - levels.length * nh) / (levels.length - 1) : 0;

  return levels.flatMap((level, li) => {
    const rowWidth = level.length * nw + (level.length - 1) * 40;
    const startX = (W - rowWidth) / 2;
    return level.map((id, ni) => {
      const n = nodeMap.get(id)!;
      return {
        id, label: n.label, nodeType: n.type || 'default', color: n.color || '#3B82F6',
        x: startX + ni * (nw + 40),
        y: topPad + li * (nh + yGap),
        width: nw, height: nh,
      };
    });
  });
}

function layoutHorizontal(nodes: DiagramNode[], _edges: DiagramEdge[], W: number, H: number): LayoutNode[] {
  const nw = Math.min(160, (W - 60) / nodes.length - 20);
  const nh = 64;
  const totalW = nodes.length * nw + (nodes.length - 1) * 30;
  const startX = (W - totalW) / 2;
  const cy = H / 2 - nh / 2;

  return nodes.map((n, i) => ({
    id: n.id, label: n.label, nodeType: n.type || 'default', color: n.color || '#3B82F6',
    x: startX + i * (nw + 30), y: cy,
    width: nw, height: nh,
  }));
}

function layoutRadial(nodes: DiagramNode[], _edges: DiagramEdge[], W: number, H: number): LayoutNode[] {
  const topPad = 100;
  const usableH = H - topPad - 60;
  const cx = W / 2;
  const cy = topPad + usableH / 2;

  const centerNw = Math.min(180, W * 0.22);
  const centerNh = 72;
  const outerNw = Math.min(150, W * 0.18);
  const outerNh = 62;

  const center = nodes[0];
  const rest = nodes.slice(1);
  const result: LayoutNode[] = [];

  result.push({
    id: center.id, label: center.label, nodeType: center.type || 'start', color: center.color || '#6366F1',
    x: cx - centerNw / 2, y: cy - centerNh / 2, width: centerNw, height: centerNh,
  });

  const radius = Math.min(W, usableH) * 0.38;
  rest.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / rest.length - Math.PI / 2;
    result.push({
      id: n.id, label: n.label, nodeType: n.type || 'default', color: n.color || '#3B82F6',
      x: cx + Math.cos(angle) * radius - outerNw / 2,
      y: cy + Math.sin(angle) * radius - outerNh / 2,
      width: outerNw, height: outerNh,
    });
  });

  return result;
}

function computeLayout(data: DiagramBlockData, W: number, H: number): LayoutNode[] {
  const layout = data.layout || 'vertical';
  if (layout === 'radial') return layoutRadial(data.nodes, data.edges, W, H);
  if (layout === 'horizontal') return layoutHorizontal(data.nodes, data.edges, W, H);
  return layoutVertical(data.nodes, data.edges, W, H);
}

// ─── Node Shape ──────────────────────────────────────────────────────────────

function getNodeShape(type: string): 'rect' | 'diamond' | 'rounded' | 'stadium' | 'hexagon' {
  switch (type) {
    case 'decision': return 'diamond';
    case 'start':    return 'stadium';
    case 'end':      return 'stadium';
    case 'process':  return 'rounded';
    case 'data':     return 'hexagon';
    default:         return 'rounded';
  }
}

// Hex points for data nodes
function hexagonPoints(w: number, h: number): string {
  const cut = h * 0.28;
  return `${cut},${-h / 2} ${w / 2 - cut},${-h / 2} ${w / 2},0 ${w / 2 - cut},${h / 2} ${cut},${h / 2} ${-w / 2 + cut},${h / 2} ${-w / 2},0 ${-w / 2 + cut},${-h / 2}`;
}

function NodeSvg({
  node, opacity, scale, primaryColor, isFirst,
}: {
  node: LayoutNode; opacity: number; scale: number; primaryColor: string; isFirst: boolean;
}) {
  const shape = getNodeShape(node.nodeType);
  const { width: w, height: h, color, label } = node;
  const cx = node.x + w / 2;
  const cy = node.y + h / 2;

  const gradId = `grad-${node.id.replace(/[^a-z0-9]/gi, '')}`;
  const glowId = `glow-${node.id.replace(/[^a-z0-9]/gi, '')}`;

  // Lighten color for gradient
  const fillTop = color;
  const fillBottom = `${color}88`;

  const fontSize = Math.max(12, Math.min(18, (w / Math.max(label.length, 4)) * 1.8));
  const isSpecial = node.nodeType === 'start' || node.nodeType === 'end' || isFirst;
  const strokeWidth = isSpecial ? 2.5 : 2;

  return (
    <g transform={`translate(${cx}, ${cy}) scale(${scale})`} opacity={opacity}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillTop} stopOpacity={0.45} />
          <stop offset="100%" stopColor={fillBottom} stopOpacity={0.18} />
        </linearGradient>
        <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation={isSpecial ? '3.5' : '2'} result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {shape === 'diamond' ? (
        <polygon
          points={`0,${-h * 0.55} ${w * 0.55},0 0,${h * 0.55} ${-w * 0.55},0`}
          fill={`url(#${gradId})`} stroke={color} strokeWidth={strokeWidth}
          filter={`url(#${glowId})`}
        />
      ) : shape === 'stadium' ? (
        <rect
          x={-w / 2} y={-h / 2} width={w} height={h}
          rx={h / 2} ry={h / 2}
          fill={`url(#${gradId})`} stroke={color} strokeWidth={strokeWidth}
          filter={`url(#${glowId})`}
        />
      ) : shape === 'hexagon' ? (
        <polygon
          points={hexagonPoints(w, h)}
          fill={`url(#${gradId})`} stroke={color} strokeWidth={strokeWidth}
          filter={`url(#${glowId})`}
        />
      ) : (
        <rect
          x={-w / 2} y={-h / 2} width={w} height={h}
          rx={shape === 'rounded' ? 14 : 3} ry={shape === 'rounded' ? 14 : 3}
          fill={`url(#${gradId})`} stroke={color} strokeWidth={strokeWidth}
          filter={`url(#${glowId})`}
        />
      )}

      {/* Label — wrap long text onto two lines */}
      {label.length > 16 ? (
        <>
          <text x={0} y={-fontSize * 0.55}
            textAnchor="middle" dominantBaseline="central"
            fill="white" fontSize={fontSize - 1} fontFamily="Inter, system-ui, sans-serif"
            fontWeight={700} letterSpacing="0.3">
            {label.slice(0, Math.ceil(label.length / 2))}
          </text>
          <text x={0} y={fontSize * 0.55}
            textAnchor="middle" dominantBaseline="central"
            fill="white" fontSize={fontSize - 1} fontFamily="Inter, system-ui, sans-serif"
            fontWeight={700} letterSpacing="0.3">
            {label.slice(Math.ceil(label.length / 2))}
          </text>
        </>
      ) : (
        <text x={0} y={0}
          textAnchor="middle" dominantBaseline="central"
          fill="white" fontSize={fontSize} fontFamily="Inter, system-ui, sans-serif"
          fontWeight={700} letterSpacing="0.3">
          {label}
        </text>
      )}
    </g>
  );
}

// ─── Edge path helpers ────────────────────────────────────────────────────────

/** Quadratic bezier curved path between two points */
function curvePath(sx: number, sy: number, ex: number, ey: number, curvature = 0.3): string {
  const mx = (sx + ex) / 2;
  const my = (sy + ey) / 2;
  // perpendicular control point
  const dx = ex - sx;
  const dy = ey - sy;
  const cx = mx - dy * curvature;
  const cy = my + dx * curvature;
  return `M ${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}`;
}

/** Point along a quadratic bezier at t ∈ [0,1] */
function bezierPoint(sx: number, sy: number, ex: number, ey: number, curvature: number, t: number) {
  const mx = (sx + ex) / 2;
  const my = (sy + ey) / 2;
  const dx = ex - sx;
  const dy = ey - sy;
  const qx = mx - dy * curvature;
  const qy = my + dx * curvature;
  const u = 1 - t;
  return {
    x: u * u * sx + 2 * u * t * qx + t * t * ex,
    y: u * u * sy + 2 * u * t * qy + t * t * ey,
  };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DiagramScene({ data, theme, motionProfile, animation }: DiagramSceneProps) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const enterFrames = Math.round((animation?.enter ?? 0.5) * fps);
  const exitStartFrame = Math.round(((animation?.enter ?? 0.5) + (animation?.hold ?? 3.2)) * fps);
  const exitFrames = Math.round((animation?.exit ?? 0.3) * fps);

  const masterOpacity = interpolate(
    frame,
    [0, enterFrames, exitStartFrame, exitStartFrame + exitFrames],
    [0, 1, 1, 0],
    { extrapolateRight: 'clamp' }
  );

  const layoutNodes = computeLayout(data, width, height);
  const nodeMap = new Map(layoutNodes.map((n) => [n.id, n]));

  const isDark = theme !== 'light_minimal' && theme !== 'corporate';
  const bg = data.backgroundColor || (isDark ? '#080818' : '#f1f5f9');
  const primaryColor = data.primaryColor || '#6366F1';

  const staggerDelay = Math.max(3, Math.floor(fps * 0.1));

  // Title animation
  const titleOpacity = interpolate(frame, [0, enterFrames], [0, 1], { extrapolateRight: 'clamp' });
  const titleY = interpolate(frame, [0, enterFrames], [-20, 0], { extrapolateRight: 'clamp' });

  // Background glow behind title
  const bgGlowOpacity = interpolate(frame, [0, enterFrames * 2], [0, 0.35], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: bg, overflow: 'hidden' }}>

      {/* Ambient background glow */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse 80% 50% at 50% 0%, ${primaryColor}28 0%, transparent 70%)`,
        opacity: bgGlowOpacity,
        pointerEvents: 'none',
      }} />

      {/* Title */}
      {data.title && (
        <div style={{
          position: 'absolute', top: 36, left: 0, right: 0,
          textAlign: 'center',
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          pointerEvents: 'none',
        }}>
          <span style={{
            fontSize: 30, fontWeight: 800,
            color: isDark ? '#ffffff' : '#0f172a',
            fontFamily: 'Inter, system-ui, sans-serif',
            letterSpacing: '-0.5px',
            textShadow: isDark ? `0 0 40px ${primaryColor}88` : 'none',
          }}>
            {data.title}
          </span>
          {/* Underline accent */}
          <div style={{
            margin: '8px auto 0',
            width: Math.min(data.title.length * 16, 300),
            height: 3,
            borderRadius: 2,
            background: `linear-gradient(90deg, transparent, ${primaryColor}, transparent)`,
            opacity: 0.8,
          }} />
        </div>
      )}

      {/* SVG canvas */}
      <svg
        width={width} height={height}
        style={{ position: 'absolute', inset: 0 }}
        opacity={masterOpacity}
      >
        <defs>
          {/* Arrow markers — one normal, one glow */}
          <marker id="arrow-main" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
            <polygon points="0 0, 10 4, 0 8" fill={primaryColor} fillOpacity={0.85} />
          </marker>
          <marker id="arrow-glow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
            <polygon points="0 0, 10 4, 0 8" fill={primaryColor} fillOpacity={0.25} />
          </marker>

          {/* Edge glow filter */}
          <filter id="edge-glow" x="-20%" y="-100%" width="140%" height="300%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ── Edges ──────────────────────────────────────────────── */}
        {data.edges.map((edge, ei) => {
          const from = nodeMap.get(edge.from);
          const to = nodeMap.get(edge.to);
          if (!from || !to) return null;

          const fx = from.x + from.width / 2;
          const fy = from.y + from.height / 2;
          const tx = to.x + to.width / 2;
          const ty = to.y + to.height / 2;

          const dx = tx - fx;
          const dy = ty - fy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const safeD = Math.max(dist, 1);

          const offsetFrom = (from.nodeType === 'decision' ? Math.max(from.width, from.height) * 0.55 : from.height / 2) + 6;
          const offsetTo   = (to.nodeType   === 'decision' ? Math.max(to.width,   to.height)   * 0.55 : to.height   / 2) + 8;

          const sx = fx + (dx / safeD) * offsetFrom;
          const sy = fy + (dy / safeD) * offsetFrom;
          const ex = tx - (dx / safeD) * offsetTo;
          const ey = ty - (dy / safeD) * offsetTo;

          // Use slight curvature to avoid overlap on multi-edge diagrams
          const curvature = 0.22;
          const pathD = curvePath(sx, sy, ex, ey, curvature);

          const edgeDelay = (layoutNodes.length + ei) * staggerDelay;
          const edgeProgress = interpolate(
            frame,
            [enterFrames + edgeDelay, enterFrames + edgeDelay + fps * 0.55],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
          );

          if (edgeProgress <= 0) return null;

          // Animated endpoint via bezier point
          const endPt = bezierPoint(sx, sy, ex, ey, curvature, edgeProgress);
          const partialPath = curvePath(sx, sy, endPt.x, endPt.y, curvature * edgeProgress);

          const midPt = bezierPoint(sx, sy, ex, ey, curvature, 0.5);
          const isDashed = edge.style === 'dashed';

          return (
            <g key={`edge-${ei}`}>
              {/* Glow halo */}
              <path
                d={partialPath}
                fill="none"
                stroke={primaryColor} strokeWidth={6} strokeOpacity={0.18}
                strokeLinecap="round"
                filter="url(#edge-glow)"
              />
              {/* Main edge */}
              <path
                d={partialPath}
                fill="none"
                stroke={primaryColor} strokeWidth={2.5} strokeOpacity={0.8}
                strokeLinecap="round"
                strokeDasharray={isDashed ? '8 5' : undefined}
                markerEnd={edgeProgress > 0.92 ? 'url(#arrow-main)' : undefined}
              />
              {/* Edge label */}
              {edge.label && edgeProgress > 0.55 && (
                <g opacity={interpolate(edgeProgress, [0.55, 0.8], [0, 1], { extrapolateRight: 'clamp' })}>
                  <rect
                    x={midPt.x - edge.label.length * 4 - 6}
                    y={midPt.y - 12}
                    width={edge.label.length * 8 + 12}
                    height={20}
                    rx={4}
                    fill={bg} fillOpacity={0.85}
                  />
                  <text
                    x={midPt.x} y={midPt.y}
                    textAnchor="middle" dominantBaseline="central"
                    fontSize={11} fill={isDark ? '#cbd5e1' : '#475569'}
                    fontFamily="Inter, system-ui, sans-serif" fontWeight={500}
                  >
                    {edge.label}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* ── Nodes ──────────────────────────────────────────────── */}
        {layoutNodes.map((node, ni) => {
          const nodeDelay = ni * staggerDelay;
          const nodeOpacity = interpolate(
            frame,
            [enterFrames + nodeDelay, enterFrames + nodeDelay + fps * 0.35],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
          );
          const nodeScale = spring({
            frame: frame - enterFrames - nodeDelay,
            fps,
            config: { damping: 180, stiffness: 280, mass: 0.9 },
          });
          const safeScale = isFinite(nodeScale) ? Math.max(0, nodeScale) : 1;

          return (
            <NodeSvg
              key={node.id}
              node={node}
              opacity={nodeOpacity}
              scale={safeScale}
              primaryColor={primaryColor}
              isFirst={ni === 0}
            />
          );
        })}
      </svg>

      {data.audioSrc && <Audio src={data.audioSrc} volume={data.audioVolume ?? 0.8} />}
    </AbsoluteFill>
  );
}
