import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowRight, ArrowUpRight, Binary, Fingerprint, Globe2, ScanSearch } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { SecurityNetwork } from '@/components/landing/SecurityNetwork';
import { ProductPreview } from '@/components/landing/ProductPreview';
import { landingWorkflow, learningAreas } from '@/data/landingData';
import { useHeroMotion, useLandingScroll } from '@/motion/landing';

export function LandingPage() {
  const root = useRef<HTMLDivElement>(null);
  const { isAuthenticated } = useAuth();
  const href = isAuthenticated ? '/dashboard' : '/login';
  const label = isAuthenticated ? '대시보드로 이동' : '로그인';
  useHeroMotion(root);
  useLandingScroll(root);
  useEffect(() => { document.title = 'RCE · Learn. Break. Defend.'; }, []);
  const areaIcons = [Globe2, Binary, ScanSearch, Fingerprint];
  return <div ref={root} className="landing-page">
    <section className="landing-hero" aria-labelledby="landing-title">
      <div className="landing-hero-content"><p data-hero-label className="landing-eyebrow"><span className="eyebrow-line" />RCE SECURITY CLUB</p>
        <h1 id="landing-title" tabIndex={-1} className="landing-title" aria-label="Learn. Break. Defend."><span className="hero-line-mask"><span data-hero-line>Learn.</span></span><span className="hero-line-mask"><span data-hero-line>Break.</span></span><span className="hero-line-mask"><span data-hero-line className="hero-line-muted">Defend.</span></span></h1>
        <p data-hero-copy className="landing-hero-copy">더 깊이 이해하고, 새로운 가능성을 발견합니다.<br /><span>RCE 구성원을 위한 과제 · 제출 · 피드백 워크스페이스.</span></p>
        <div data-hero-cta className="landing-hero-actions"><Link to={href} className="landing-cta">{label}<ArrowUpRight size={19} /></Link><a href="#about" className="landing-explore">아래로 탐색<ArrowDown size={15} /></a></div>
      </div>
      <div className="landing-hero-visual"><SecurityNetwork /></div>
      <div className="hero-baseline" aria-hidden="true"><span data-boot-label>RCE / SYSTEM</span><span>KNOWLEDGE IS OUR STRONGEST DEFENSE.</span><span>SCROLL TO EXPLORE <ArrowDown size={12} /></span></div>
    </section>
    <section id="about" className="landing-section landing-about" aria-labelledby="about-title">
      <div data-section-intro className="section-intro"><p className="landing-eyebrow"><span className="section-number">01 / ABOUT RCE</span></p><div className="section-heading-row"><h2 id="about-title">Curiosity.<br /><span>In good company.</span></h2><p>RCE는 보안을 함께 탐구하는 정보보안 전공 동아리입니다.<br />정답을 찾는 데서 멈추지 않고, 그 안의 원리를 이해합니다.<br />서로의 질문과 발견을 나누며 더 깊이 나아갑니다.</p></div></div>
      <div className="about-fields-heading"><h3>우리가 탐구하는 네 가지 분야</h3><span>FOUR FIELDS. SHARED CURIOSITY.</span></div>
      <div className="area-list">{learningAreas.map((area, i) => { const Icon = areaIcons[i]; return <article data-area-row key={area.id} className="area-row"><span className="area-number">{area.number}</span><div className="area-name"><h4>{area.title}</h4><span>{area.detail}</span></div><div className="area-description"><p className="area-subtitle">{area.subtitle}</p><p>{area.description}</p></div><div data-area-icon className="area-icon" aria-hidden="true"><Icon size={28} strokeWidth={1.2} /></div><span data-area-line className="area-active-line" aria-hidden="true" /></article>; })}</div>
    </section>
    <section id="lms" className="landing-section landing-lms" aria-labelledby="lms-title">
      <div data-section-intro className="section-intro"><p className="landing-eyebrow"><span className="section-number">02 / RCE LMS</span></p><div className="section-heading-row"><h2 id="lms-title">Your track.<br /><span>Your workspace.</span></h2><p>과제와 나의 제출 현황, 운영진의 피드백까지.<br />지금 필요한 학습 정보를 한곳에서 확인합니다.<br />RCE LMS는 각자의 탐구가 이어지는 작업 공간입니다.</p></div></div>
      <div className="product-preview-container"><ProductPreview /></div>
      <div className="product-preview-caption"><span>웹해킹 학습공간 미리보기</span><span>ASSIGNMENTS / SUBMISSIONS / FEEDBACK</span></div>
    </section>
    <section className="landing-section landing-workflow" aria-labelledby="workflow-title">
      <div data-section-intro className="section-intro"><p className="landing-eyebrow"><span className="section-number">03 / THE PROCESS</span></p><div className="section-heading-row"><h2 id="workflow-title">Every step.<br /><span>A step forward.</span></h2><p>확인하고, 실험하고, 기록하고, 다시 배우는 일.<br />작은 시도가 쌓여 더 단단한 실력이 됩니다.</p></div></div>
      <div data-workflow className="workflow"><div className="workflow-rail" aria-hidden="true"><svg viewBox="0 0 1000 2" preserveAspectRatio="none"><path d="M0 1H1000" className="workflow-base-line" /><path data-workflow-line d="M0 1H1000" className="workflow-active-line" /></svg></div>{landingWorkflow.map((stage, i) => <article data-workflow-stage key={stage.id} className="workflow-stage"><div className="workflow-stage-index"><span>0{i + 1}</span><ArrowUpRight size={17} /></div><h3>{stage.title}</h3><h4>{stage.label}</h4><p>{stage.description}</p></article>)}</div>
    </section>
    <section className="landing-final" aria-labelledby="final-title"><div data-final-cta className="landing-final-content"><p className="landing-eyebrow">YOUR NEXT CHAPTER</p><h2 id="final-title">Ready to<br /><span>enter RCE?</span></h2><p>탐구는 계속됩니다. 이제 당신의 워크스페이스로.</p><Link to={href} className="landing-cta">{label}<ArrowRight size={19} /></Link></div><div className="final-mark" aria-hidden="true">RCE</div></section>
  </div>;
}
