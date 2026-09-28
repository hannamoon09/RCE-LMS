import { useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { networkNodes, networkPaths } from '@/data/landingData';
import { useNetworkMotion } from '@/motion/landing';
import { useReducedMotion } from '@/motion/hooks';
import logo from '@/assets/rce-logo-hero.webp';

export function SecurityNetwork() {
  const root = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const reduce = useReducedMotion();
  useNetworkMotion(root, paused);
  return <div ref={root} className="security-network" data-security-network>
    <div className="network-caption" data-hero-ambient aria-hidden="true"><span>RCE / SECURITY CLUB</span><span>CONNECTED KNOWLEDGE</span></div>
    <svg viewBox="0 0 640 600" fill="none" className="network-map" aria-hidden="true">
      <defs>
        <pattern id="rce-dot-grid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.8" fill="currentColor" opacity="0.23" /></pattern>
        <radialGradient id="rce-grid-fade"><stop stopColor="white" /><stop offset="1" stopColor="black" /></radialGradient>
        <mask id="rce-grid-mask"><rect width="640" height="600" fill="url(#rce-grid-fade)" /></mask>
      </defs>
      <g data-hero-ambient><rect width="640" height="600" fill="url(#rce-dot-grid)" mask="url(#rce-grid-mask)" />
        <path d="M320 42L578 188V412L320 558L62 412V188Z" className="network-orbit" />
        <path d="M320 92L528 212V388L320 508L112 388V212Z" className="network-orbit network-desktop-detail" strokeDasharray="3 9" />
        <path d="M56 298H150M490 298H584M320 64V148M320 452V548" className="network-branch" />
        <path d="M184 74V98L208 122M456 74V98L432 122M184 526V502L208 478M456 526V502L432 478" className="network-branch network-desktop-detail" />
      </g>
      {networkPaths.map((d, i) => <path key={i} id={`signal-path-${i}`} d={d} data-network-path className="network-connection" />)}
      <g data-network-parallax>
        <path d="M218 232H190V260M422 232H450V260M218 390H190V362M422 390H450V362" className="network-core-bracket" />
        <path d="M320 174V208M312 208H328M190 312H450" className="network-core-spine" />
      </g>
      {networkNodes.map((node, i) => <g key={i} data-network-node data-x={node.x} data-y={node.y} transform={`translate(${node.x} ${node.y})`} className={`network-node ${node.extra ? 'network-desktop-detail' : ''}`}>
        <circle r={node.label ? 16 : 6} className="network-node-halo" />
        <rect x={node.label ? -4 : -2} y={node.label ? -4 : -2} width={node.label ? 8 : 4} height={node.label ? 8 : 4} className="network-node-core" />
        {node.label && <text x={node.tx} y={node.ty} className="network-node-label">{node.label}</text>}
      </g>)}
      {networkPaths.map((_, i) => <circle key={i} r="2.8" cx="0" cy="0" data-network-packet data-path={`signal-path-${i}`} className={`network-packet ${i > 1 ? 'network-desktop-detail' : ''}`} />)}
      <path d="M12 12H32M12 12V32M608 12H628V32M12 568V588H32M608 588H628V568" className="network-corner" />
    </svg>
    <div className="network-logo-frame"><img data-hero-logo src={logo} alt="RCE 정보보안 동아리 로고" width="768" height="768" className="network-logo" fetchPriority="high" draggable={false} /></div>
    <div className="network-wordmark" aria-hidden="true"><span data-brand-glyph>R</span><span data-brand-glyph className="network-wordmark-outline">C</span><span data-brand-glyph>E</span></div>
    <div className="network-wordmark-rule" data-brand-rule aria-hidden="true"><i /></div>
    <p className="network-wordmark-caption" data-hero-ambient aria-hidden="true">THINK DEEPER. GO FURTHER.</p>
    <div className="network-bottom" aria-hidden="true"><span><i />LEARN / CONNECT / EVOLVE</span><span>EST. RCE</span></div>
    {!reduce && <button type="button" className="network-pause" onClick={() => setPaused(p => !p)} aria-label={paused ? '배경 모션 재생' : '배경 모션 일시 정지'} aria-pressed={paused}>{paused ? <Play size={13} /> : <Pause size={13} />}</button>}
  </div>;
}
