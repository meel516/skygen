'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useSiteConfig } from '@/lib/use-site-config';

const walkthrough = [
  { label: 'Describe', image: '/studio-chat.png', title: 'Start with the idea.', description: 'Give the agent a brief. Develop the story, choose a voice, and shape the visual direction in one conversation.', alt: 'SkyGen conversation workspace with a video preview' },
  { label: 'Refine', image: '/studio-editor.png', title: 'Keep the final say.', description: 'Open your video in the editor. Adjust the text, scenes, colors, and timing before you export.', alt: 'SkyGen video editor with scene controls and a timeline' },
  { label: 'Reuse', image: '/studio-templates.png', title: 'Build on your best work.', description: 'Save a design as a template and use it again with a new story. Keep the format consistent as the content changes.', alt: 'SkyGen template workspace with public and personal libraries' },
];

export function LandingPage() {
  const { config } = useSiteConfig();
  const appName = config.branding?.appName || 'SKYGEN';
  const [step, setStep] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const current = walkthrough[step];
  const openStudio = () => void signIn('google', { callbackUrl: '/' });
  const selectStep = (next: number) => { if (next !== step) { setStep(next); setImageLoaded(false); setImageFailed(false); } };
  return <div className="landing">
    <a href="#landing-main" className="studio-skip">Skip to content</a>
    <header className="landing-header">
      <Link className="studio-wordmark" href="/" aria-label={`${appName} home`}><span className="studio-mark" aria-hidden="true">S</span>{appName}</Link>
      <nav aria-label="Website navigation"><a href="#how-it-works">The workspace</a><Link href="/mcp">For developers</Link></nav>
      <button className="studio-button studio-button-outline" onClick={openStudio}>Sign in</button>
    </header>
    <main id="landing-main">
      <section className="landing-hero">
        <div className="hero-topline"><span className="studio-eyebrow">An AI video workspace</span><span className="studio-eyebrow">From first idea to final cut</span></div>
        <h1>Make a scene.<br /><span>Make it yours.</span></h1>
        <div className="hero-bottom"><p>Turn a brief into motion graphics.<br />Shape the story, edit the details, and make<br className="desktop-break" /> something worth watching.</p><div className="hero-actions"><button className="studio-button" onClick={openStudio}>Open the studio <span aria-hidden="true">↗</span></button><a href="#how-it-works">Take a look inside</a></div></div>
      </section>
      <section className="landing-walkthrough" id="how-it-works" aria-labelledby="walkthrough-title">
        <div className="walkthrough-heading"><span className="studio-eyebrow">01 / Inside SkyGen</span><h2 id="walkthrough-title">An idea. A conversation.<br />A video you can edit.</h2></div>
        <div className="walkthrough-layout">
          <div className="walkthrough-steps" role="tablist" aria-label="Explore the workspace" aria-orientation="vertical">
            {walkthrough.map((item, index) => <button key={item.label} role="tab" id={`step-${index}`} aria-selected={step === index} aria-controls="product-panel" tabIndex={step === index ? 0 : -1} onClick={() => selectStep(index)} onKeyDown={event => {
              const next = event.key === 'ArrowDown' ? (step + 1) % 3 : event.key === 'ArrowUp' ? (step + 2) % 3 : event.key === 'Home' ? 0 : event.key === 'End' ? 2 : null;
              if (next !== null) { event.preventDefault(); selectStep(next); document.getElementById(`step-${next}`)?.focus(); }
            }}><span className="step-index">0{index + 1}</span><span><strong>{item.label}</strong><span className="step-description">{item.description}</span></span></button>)}
          </div>
          <div id="product-panel" role="tabpanel" aria-labelledby={`step-${step}`} tabIndex={0} className="product-panel">
            <div className="product-caption"><span>{current.title}</span><span>Product walkthrough</span></div>
            <div className="product-image-wrap">
              {!imageLoaded && !imageFailed && <div className="product-image-skeleton" role="status"><span className="sr-only">Loading product screenshot</span></div>}
              {imageFailed ? <p className="product-image-error">The screenshot could not load. Open the studio to explore the workspace.</p> : <img key={current.image} src={current.image} alt={current.alt} onLoad={() => setImageLoaded(true)} onError={() => setImageFailed(true)} width={1440} height={900} />}
            </div>
            <div className="product-footnote"><span>Actual SkyGen interface</span><button onClick={openStudio}>Try it in the studio ↗</button></div>
          </div>
        </div>
      </section>
      <section className="landing-workflow" aria-labelledby="workflow-title">
        <span className="studio-eyebrow">02 / Made for the whole process</span>
        <div className="workflow-intro"><h2 id="workflow-title">Good work<br />takes a few passes.</h2><p>Go from a rough direction to a finished video without starting over. Your scenes, voice, and templates stay together in one workspace.</p></div>
        <div className="workflow-row"><span>01</span><h3>Direct the story</h3><p>Bring a brief, an image, or a new direction. Work through the narrative with the video agent.</p></div>
        <div className="workflow-row"><span>02</span><h3>Work the details</h3><p>Preview your scenes as you go. Fine-tune the composition, pacing, and audio in the editor.</p></div>
        <div className="workflow-row"><span>03</span><h3>Make it repeatable</h3><p>Keep useful designs as templates and custom blocks. Build the next video on work you already like.</p></div>
      </section>
      <section className="landing-closing"><span className="studio-eyebrow">Your next video starts here</span><h2>Bring the idea.<br />We’ll give it room.</h2><button className="studio-button" onClick={openStudio}>Start creating <span aria-hidden="true">↗</span></button></section>
    </main>
    <footer className="landing-footer"><Link className="studio-wordmark" href="/">{appName}</Link><span>© {new Date().getFullYear()} {appName}</span><nav aria-label="Legal and developer links"><Link href="/terms">Terms of service</Link><Link href="/privacy">Privacy policy</Link><Link href="/mcp">Developer guide</Link></nav></footer>
  </div>;
}
