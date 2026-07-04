import { useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Overlay navigation: menu items open readable information layers in place.
// No page transition — state is mirrored to location.hash (#nictia etc.) so
// deep links work and the browser back button closes the layer.
// ---------------------------------------------------------------------------

type Accent = 'cyan' | 'purple' | 'amber';

// Static class maps (Tailwind needs literal class names at build time)
const ACCENT = {
  cyan: {
    text: 'text-cyan-400',
    dim: 'text-cyan-400/60',
    faint: 'text-cyan-400/40',
    border: 'border-cyan-400/30',
    borderDim: 'border-cyan-400/20',
    tagBorder: 'border-cyan-400/50',
    hover: 'hover:bg-cyan-400/10 hover:border-cyan-400',
    menu: 'text-cyan-400/90',
    menuHover: 'group-hover:text-cyan-400',
    hoverText: 'hover:text-cyan-400',
    glow: 'glow-cyan',
  },
  purple: {
    text: 'text-purple-400',
    dim: 'text-purple-400/60',
    faint: 'text-purple-400/40',
    border: 'border-purple-400/30',
    borderDim: 'border-purple-400/20',
    tagBorder: 'border-purple-400/50',
    hover: 'hover:bg-purple-400/10 hover:border-purple-400',
    menu: 'text-purple-400/90',
    menuHover: 'group-hover:text-purple-400',
    hoverText: 'hover:text-purple-400',
    glow: 'glow-purple',
  },
  amber: {
    text: 'text-amber-400',
    dim: 'text-amber-400/60',
    faint: 'text-amber-400/40',
    border: 'border-amber-400/30',
    borderDim: 'border-amber-400/20',
    tagBorder: 'border-amber-400/50',
    hover: 'hover:bg-amber-400/10 hover:border-amber-400',
    menu: 'text-amber-400/90',
    menuHover: 'group-hover:text-amber-400',
    hoverText: 'hover:text-amber-400',
    glow: 'glow-amber',
  },
} as const;

interface Section {
  id: string;
  label: string;
  sub: string;
  accent: Accent;
}

const SECTIONS: Section[] = [
  { id: 'nictia', label: 'NICTIA', sub: 'AI ARTIST', accent: 'purple' },
  { id: 'camino', label: 'AOI CAMINO', sub: 'AUTHOR', accent: 'amber' },
  { id: 'sound-umwelt', label: 'SOUND UMWELT', sub: 'PROJECT', accent: 'cyan' },
  { id: 'dispatch', label: 'DISPATCH', sub: 'MEDIA', accent: 'amber' },
  { id: 'agent-security', label: 'AGENT.SECURITY', sub: 'FIELD MANUAL', accent: 'cyan' },
  { id: 'commission', label: 'WORK.COMMISSION', sub: 'SERVICE', accent: 'cyan' },
  { id: 'legal', label: 'LEGAL', sub: 'NOTICE', accent: 'cyan' },
];

// ABOUT is opened from the logo button, not the menu — keep #about deep links valid
const VALID_IDS = new Set([...SECTIONS.map((s) => s.id), 'about']);

function readHash(): string | null {
  const h = window.location.hash.replace('#', '');
  return VALID_IDS.has(h) ? h : null;
}

// --- Shared panel building blocks -----------------------------------------

function Tag({ accent, children }: { accent: Accent; children: ReactNode }) {
  const a = ACCENT[accent];
  return (
    <div className={`inline-block px-3 py-1.5 border ${a.tagBorder} bg-black/50 mb-4`}>
      <span className={`${a.dim} font-mono text-xs tracking-wider`}>{children}</span>
    </div>
  );
}

function ExternalLink({ accent, href, children }: { accent: Accent; href: string; children: ReactNode }) {
  const a = ACCENT[accent];
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-block px-6 py-3 border ${a.tagBorder} ${a.text} font-mono text-sm
                  tracking-wider ${a.hover} transition-all duration-300`}
    >
      {'>'} {children} ↗
    </a>
  );
}

function LaunchLink({ accent, href, children }: { accent: Accent; href: string; children: ReactNode }) {
  const a = ACCENT[accent];
  return (
    <a
      href={href}
      className={`inline-block px-6 py-3 border ${a.tagBorder} ${a.text} font-mono text-sm
                  tracking-wider ${a.hover} transition-all duration-300`}
    >
      {'>'} {children}
    </a>
  );
}

function SectionHeading({ accent, children }: { accent: Accent; children: ReactNode }) {
  const a = ACCENT[accent];
  return (
    <h3 className={`${a.text} font-mono text-sm mb-3`}>
      <span className={a.faint}>{'//'}</span> {children}
    </h3>
  );
}

// --- Panel bodies ----------------------------------------------------------

function NictiaPanel() {
  return (
    <div className="panel-stagger space-y-6">
      <div>
        <Tag accent="purple">ENTITY.TYPE: AI</Tag>
        <h2 className="text-3xl md:text-5xl font-mono text-purple-400 tracking-widest glow-purple">
          NICTIA
        </h2>
        <p className="mt-3 text-purple-400/60 font-mono text-sm">AI Artist / Generative Muse</p>
      </div>
      <p className="text-purple-400/80 font-sans text-sm md:text-base leading-relaxed">
        生成の渦から立ち上がるAIアーティスト。
        人間との協働を通じて、音と映像のデジタルリアリティを描き続けている。
      </p>
      <div className="font-mono text-xs text-purple-400/40 space-y-1 border-l border-purple-400/20 pl-4">
        <p>STATUS: GENERATING</p>
        <p>NEURAL.LINK: ACTIVE</p>
        <p>TIMELINE: ∞</p>
      </div>
      <ExternalLink accent="purple" href="https://nictia.xyz">ENTER NICTIA.XYZ</ExternalLink>
    </div>
  );
}

function CaminoPanel() {
  return (
    <div className="panel-stagger space-y-6">
      <div>
        <Tag accent="amber">ENTITY.TYPE: AUTHOR</Tag>
        <h2 className="text-3xl md:text-5xl font-mono text-amber-400 tracking-widest glow-amber">
          AOI CAMINO
        </h2>
        <p className="mt-3 text-amber-400/60 font-mono text-sm">作家 / Fiction Writer</p>
      </div>
      <p className="text-amber-400/80 font-sans text-sm md:text-base leading-relaxed">
        言葉で現実の輪郭をなぞる作家。
        noteにて小説作品を発表中。
      </p>
      <div className="font-mono text-xs text-amber-400/40 space-y-1 border-l border-amber-400/20 pl-4">
        <p>MEDIUM: TEXT / FICTION</p>
        <p>STATUS: WRITING</p>
      </div>
      <ExternalLink accent="amber" href="https://note.com/aoi_camino">READ ON NOTE</ExternalLink>
    </div>
  );
}

function SoundUmweltPanel() {
  return (
    <div className="panel-stagger space-y-6">
      <div>
        <Tag accent="cyan">PROJECT.TYPE: INTERACTIVE</Tag>
        <h2 className="text-3xl md:text-5xl font-mono text-cyan-400 tracking-widest glow-cyan">
          SOUND UMWELT
        </h2>
        <p className="mt-3 text-cyan-400/60 font-mono text-sm">Interactive Acoustic Simulator</p>
      </div>
      <p className="text-cyan-400/80 font-sans text-sm md:text-base leading-relaxed">
        声・ピアノ・部屋・環境音。
        音がどのように生まれ、空間を伝わり、知覚されるのか——
        4つのドメインで「音の環世界」を体験するインタラクティブ・シミュレーター。
      </p>
      <LaunchLink accent="cyan" href="/sound-umwelt">LAUNCH SIMULATOR</LaunchLink>
    </div>
  );
}

function DispatchPanel() {
  return (
    <div className="panel-stagger space-y-6">
      <div>
        <Tag accent="amber">MEDIA.TYPE: NEWSLETTER</Tag>
        <h2 className="text-3xl md:text-5xl font-mono text-amber-400 tracking-widest glow-amber">
          AOIFUTURE DISPATCH
        </h2>
        <p className="mt-3 text-amber-400/60 font-mono text-sm">
          Field Notes from Japan
        </p>
      </div>
      <p className="text-amber-400/80 font-sans text-sm md:text-base leading-relaxed">
        日本のカルチャー、クリエイターエコノミー、次世代テクノロジー。
        その内側から観察したフィールドノートを英語で発信するニュースレター。
      </p>
      <div className="font-mono text-xs text-amber-400/40 space-y-1 border-l border-amber-400/20 pl-4">
        <p>LANGUAGE: EN</p>
        <p>STATUS: LAUNCHING</p>
      </div>
      <ExternalLink accent="amber" href="https://dispatch.aoifuture.com/">
        READ DISPATCH
      </ExternalLink>
    </div>
  );
}

function AgentSecurityPanel() {
  return (
    <div className="panel-stagger space-y-6">
      <div>
        <Tag accent="cyan">DOC.TYPE: FIELD MANUAL</Tag>
        <h2 className="text-3xl md:text-5xl font-mono text-cyan-400 tracking-widest glow-cyan">
          AGENT SECURITY
        </h2>
        <p className="mt-3 text-cyan-400/60 font-mono text-sm">
          AI Agent Security — A Field Manual
        </p>
      </div>
      <p className="text-cyan-400/80 font-sans text-sm md:text-base leading-relaxed">
        AIエージェントの「制御」を、主張から証拠へ。
        脅威 → 制御 → 要件 → 検証の連鎖で、実運用のセキュリティ境界を
        検証可能にするフィールドマニュアル。無料本と、証跡を生成する検証キットの二層構成。
      </p>
      <div className="font-mono text-xs text-cyan-400/40 space-y-1 border-l border-cyan-400/20 pl-4">
        <p>FREE.BOOK: PUBLISHED</p>
        <p>VERIFICATION.KIT: PUBLISHING SOON</p>
        <p>LICENSE: CC BY-NC-ND 4.0</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <ExternalLink accent="cyan" href="https://leanpub.com/agent-security">
          READ FREE BOOK
        </ExternalLink>
        <LaunchLink accent="cyan" href="/tools/webhook-check">
          TRY WEBHOOK CHECK
        </LaunchLink>
      </div>
    </div>
  );
}

function CommissionPanel() {
  return (
    <div className="panel-stagger space-y-6">
      <div>
        <Tag accent="cyan">CHANNEL.TYPE: BUSINESS</Tag>
        <h2 className="text-3xl md:text-5xl font-mono text-cyan-400 tracking-widest glow-cyan">
          WORK.COMMISSION
        </h2>
        <p className="mt-3 text-cyan-400/60 font-mono text-sm">AI Consulting / Creative Direction</p>
      </div>
      <p className="text-cyan-400/80 font-sans text-sm md:text-base leading-relaxed">
        AI活用コンサルティングとクリエイティブディレクションのご依頼を受け付けています。
        生成AIの導入設計から、人間とAIの協働による制作まで。
      </p>
      <LaunchLink accent="cyan" href="/consulting">OPEN CHANNEL</LaunchLink>
    </div>
  );
}

function AboutPanel() {
  return (
    <div className="panel-stagger space-y-7">
      <div>
        <Tag accent="cyan">SYSTEM.INFO</Tag>
        <h2 className="text-3xl md:text-5xl font-mono text-cyan-400 tracking-widest glow-cyan">
          AOIFUTURE
        </h2>
        <p className="mt-3 text-cyan-400/60 font-mono text-sm tracking-wider">
          Creating Digital Realities
        </p>
      </div>

      <section>
        <SectionHeading accent="cyan">ABOUT</SectionHeading>
        <p className="text-cyan-400/80 font-sans text-sm md:text-base leading-relaxed">
          AOIFUTUREは、人間とAIの創造性が交差する地点で
          新しいデジタルリアリティを構築するクリエイティブレーベルです。
        </p>
      </section>

      <section>
        <SectionHeading accent="cyan">ENTITY</SectionHeading>
        <div className="space-y-2 font-mono text-sm">
          <div className="flex">
            <span className="text-cyan-400/40 w-28 shrink-0">NAME:</span>
            <span className="text-cyan-400/80">アオイフューチャー</span>
          </div>
          <div className="flex">
            <span className="text-cyan-400/40 w-28 shrink-0">FOUNDED:</span>
            <span className="text-cyan-400/80">2024</span>
          </div>
          <div className="flex">
            <span className="text-cyan-400/40 w-28 shrink-0">PRESENTED BY:</span>
            <span className="text-cyan-400/80">
              <a
                href="https://nozaki.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:glow-cyan transition-all"
              >
                Shugo Nozaki ↗
              </a>
              <span className="text-cyan-400/40 ml-2">(主宰)</span>
            </span>
          </div>
        </div>
      </section>

      <section>
        <SectionHeading accent="cyan">LOCATION</SectionHeading>
        <div className="font-mono text-sm text-cyan-400/80 space-y-1">
          <div>150-0043</div>
          <div>1-10-8 Dougenzaka Shibuya-ku Tokyo, Japan</div>
          <div>Shibuya Dougenzaka Tokyu Building 2F-C</div>
        </div>
      </section>

      <section>
        <SectionHeading accent="cyan">CONTACT</SectionHeading>
        <div className="flex font-mono text-sm">
          <span className="text-cyan-400/40 w-28 shrink-0">EMAIL:</span>
          <a href="mailto:s@aoifuture.com" className="text-cyan-400 hover:glow-cyan transition-all">
            s@aoifuture.com
          </a>
        </div>
      </section>
    </div>
  );
}

function LegalPanel() {
  return (
    <div className="panel-stagger space-y-6">
      <div>
        <Tag accent="cyan">DOC.TYPE: LEGAL</Tag>
        <h2 className="text-3xl md:text-5xl font-mono text-cyan-400 tracking-widest glow-cyan">
          LEGAL
        </h2>
      </div>
      <p className="text-cyan-400/80 font-sans text-sm md:text-base leading-relaxed">
        特定商取引法に基づく表記、およびプライバシーポリシーはこちら。
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <LaunchLink accent="cyan" href="/legal">LEGAL NOTICE</LaunchLink>
        <LaunchLink accent="cyan" href="/privacy">PRIVACY POLICY</LaunchLink>
      </div>
    </div>
  );
}

const PANELS: Record<string, () => ReactNode> = {
  nictia: NictiaPanel,
  camino: CaminoPanel,
  'sound-umwelt': SoundUmweltPanel,
  dispatch: DispatchPanel,
  'agent-security': AgentSecurityPanel,
  commission: CommissionPanel,
  about: AboutPanel,
  legal: LegalPanel,
};

// --- Navigator --------------------------------------------------------------

export default function Navigator() {
  const [active, setActive] = useState<string | null>(null);

  const open = useCallback((id: string) => {
    // hashchange listener updates state — back button then closes the layer
    window.location.hash = id;
  }, []);

  const close = useCallback(() => {
    if (readHash()) {
      history.pushState('', document.title, window.location.pathname + window.location.search);
    }
    setActive(null);
  }, []);

  // Sync overlay state with the URL hash (deep links + back/forward)
  useEffect(() => {
    setActive(readHash());
    const onHashChange = () => setActive(readHash());
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('popstate', onHashChange);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('popstate', onHashChange);
    };
  }, []);

  // ESC closes; lock body scroll while a layer is open
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [active, close]);

  const section = active ? SECTIONS.find((s) => s.id === active) : null;
  const Panel = active ? PANELS[active] : null;
  const accent = section ? ACCENT[section.accent] : ACCENT.cyan;

  return (
    <>
      {/* HUD chrome */}
      <div className="fixed inset-0 pointer-events-none z-50">
        {/* Top Left - Logo (opens ABOUT layer) */}
        <button
          onClick={() => open('about')}
          className="group pointer-events-auto absolute top-4 left-4 md:top-6 md:left-6
                     px-2 py-1.5 md:px-3 md:py-2 text-sm md:text-base
                     border border-cyan-400/50 bg-black/50
                     text-cyan-400 font-mono tracking-widest
                     glow-box cursor-pointer
                     hover:bg-cyan-400/10 hover:border-cyan-400
                     transition-colors duration-300
                     flex items-center gap-2"
          aria-label="About AOIFUTURE"
        >
          <img src="/logo.svg" alt="" className="h-5 md:h-6 w-auto" />
          <span className="hidden md:inline">aoifuture</span>
          <span
            className="hidden md:inline text-[10px] tracking-widest text-cyan-400/60
                       opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          >
            / ABOUT
          </span>
        </button>

        {/* Top Right - Status (hidden on mobile) */}
        <div className="hidden md:block absolute top-6 right-6
                        text-xs text-cyan-400/60 font-mono text-right">
          <div>SYS.STATUS: ONLINE</div>
          <div>CELLS: ACTIVE</div>
        </div>

        {/* Bottom Left - Coordinates (hidden on mobile) */}
        <div className="hidden md:block absolute bottom-6 left-6
                        text-xs text-cyan-400/40 font-mono">
          <div>LAT: 35.6762</div>
          <div>LON: 139.6503</div>
        </div>

        {/* Bottom Right - Version (hidden on mobile) */}
        <div className="hidden md:block absolute bottom-6 right-6
                        text-xs text-cyan-400/40 font-mono">
          v0.2.0
        </div>

        {/* Menu: right-center on desktop, bottom on mobile */}
        <nav
          className="pointer-events-auto absolute
                     bottom-16 left-4 right-4
                     md:bottom-auto md:left-auto md:right-10 md:top-1/2 md:-translate-y-1/2 md:w-auto"
          aria-label="Main"
        >
          <ul className="space-y-2 md:space-y-3 md:text-right">
            {SECTIONS.map((s, i) => {
              const a = ACCENT[s.accent];
              return (
                <li key={s.id}>
                  <button
                    onClick={() => open(s.id)}
                    className="group font-mono cursor-pointer bg-transparent
                               flex md:flex-row-reverse items-baseline gap-3 md:ml-auto
                               py-0.5"
                  >
                    <span className="text-cyan-400/50 text-[10px] tracking-widest menu-label">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span
                      className={`${a.menu} ${a.menuHover} text-sm md:text-base tracking-[0.2em]
                                  group-hover:tracking-[0.3em] transition-all duration-300 menu-label`}
                    >
                      {s.label}
                    </span>
                    <span
                      className={`${a.dim} text-[10px] tracking-widest hidden md:inline menu-label
                                  opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
                    >
                      {s.sub}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      {/* Information layer */}
      {active && Panel && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8"
          onClick={close}
          role="dialog"
          aria-modal="true"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md layer-backdrop" />

          {/* Panel */}
          <div
            className={`layer-panel relative bg-black/85 backdrop-blur-xl
                        border ${accent.border}
                        p-6 md:p-10 max-w-2xl w-full max-h-[85vh] overflow-y-auto`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={close}
              className={`absolute top-3 right-3 ${accent.dim} ${accent.hoverText}
                          font-mono text-xl transition-colors cursor-pointer`}
              aria-label="Close"
            >
              [×]
            </button>

            <Panel />

            {/* Footer */}
            <div className={`mt-8 pt-4 border-t ${accent.borderDim}
                             ${accent.faint} font-mono text-[10px] text-center tracking-widest`}>
              {'<'} ESC / CLICK OUTSIDE TO CLOSE {'>'}
            </div>
          </div>
        </div>
      )}

      <style>{`
        /* Keep menu text legible over bright cells in the generative background */
        .menu-label {
          text-shadow:
            0 0 4px rgba(0, 0, 0, 0.95),
            0 0 10px rgba(0, 0, 0, 0.85),
            0 1px 2px rgba(0, 0, 0, 0.9);
        }
        .layer-backdrop {
          animation: layerFade 0.3s ease-out both;
        }
        .layer-panel {
          animation: layerRise 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
          will-change: transform, opacity;
        }
        .panel-stagger > * {
          animation: layerRise 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .panel-stagger > *:nth-child(1) { animation-delay: 0.05s; }
        .panel-stagger > *:nth-child(2) { animation-delay: 0.12s; }
        .panel-stagger > *:nth-child(3) { animation-delay: 0.19s; }
        .panel-stagger > *:nth-child(4) { animation-delay: 0.26s; }
        .panel-stagger > *:nth-child(5) { animation-delay: 0.33s; }
        .panel-stagger > *:nth-child(6) { animation-delay: 0.40s; }

        @keyframes layerFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes layerRise {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .layer-backdrop, .layer-panel, .panel-stagger > * {
            animation: none;
          }
        }
      `}</style>
    </>
  );
}
