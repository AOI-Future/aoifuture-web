import { useState, useEffect } from 'react';

interface Agent {
  name: string;
  role: string;
  link: string;
  external: boolean;
  icon: 'human' | 'ai';
}

const agents: Agent[] = [
  {
    name: 'Shugo Nozaki',
    role: 'Content Syncretist / Founder',
    link: 'https://nozaki.com/',
    external: true,
    icon: 'human',
  },
  {
    name: 'NICTIA',
    role: 'AI Artist / Generative Muse',
    link: '/nictia',
    external: false,
    icon: 'ai',
  },
];

function HumanIcon() {
  return (
    <svg viewBox="0 0 16 16" className="w-12 h-12" style={{ imageRendering: 'pixelated' }}>
      <rect x="6" y="2" width="4" height="4" fill="currentColor" />
      <rect x="5" y="6" width="6" height="2" fill="currentColor" />
      <rect x="7" y="8" width="2" height="4" fill="currentColor" />
      <rect x="5" y="12" width="2" height="2" fill="currentColor" />
      <rect x="9" y="12" width="2" height="2" fill="currentColor" />
      <rect x="4" y="7" width="2" height="1" fill="currentColor" />
      <rect x="10" y="7" width="2" height="1" fill="currentColor" />
    </svg>
  );
}

function AIIcon() {
  return (
    <svg viewBox="0 0 16 16" className="w-12 h-12 animate-pulse" style={{ imageRendering: 'pixelated' }}>
      <rect x="3" y="3" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1" />
      <rect x="5" y="5" width="2" height="2" fill="currentColor" />
      <rect x="9" y="5" width="2" height="2" fill="currentColor" />
      <rect x="5" y="9" width="6" height="1" fill="currentColor" />
      <rect x="7" y="0" width="2" height="3" fill="currentColor" />
      <rect x="7" y="13" width="2" height="3" fill="currentColor" />
      <rect x="0" y="7" width="3" height="2" fill="currentColor" />
      <rect x="13" y="7" width="3" height="2" fill="currentColor" />
    </svg>
  );
}

export default function HUDOverlay() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  return (
    <>
      {/* HUD Container */}
      <div className="fixed inset-0 pointer-events-none z-50">
        {/* Top Left - Logo */}
        <button
          onClick={() => setIsModalOpen(true)}
          className="pointer-events-auto absolute top-4 left-4 md:top-6 md:left-6
                     px-2 py-1.5 md:px-3 md:py-2 text-sm md:text-base
                     border border-cyan-400/50 bg-black/50
                     text-cyan-400 font-mono tracking-widest
                     blink glow-box cursor-pointer
                     hover:bg-cyan-400/10 hover:border-cyan-400
                     transition-colors duration-300
                     flex items-center gap-2"
        >
          <img src="/logo.svg" alt="" className="h-5 md:h-6 w-auto" />
          <span className="hidden md:inline">Aoifuture</span>
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
          v0.1.0-alpha
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onClick={() => setIsModalOpen(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />

          {/* Modal Content */}
          <div
            className="relative glass rounded-none p-6 md:p-8 max-w-lg w-full
                       border border-cyan-400/30"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-3 right-3 text-cyan-400/60 hover:text-cyan-400
                         font-mono text-xl transition-colors"
            >
              [×]
            </button>

            {/* Header */}
            <h2 className="text-cyan-400 font-mono text-lg md:text-xl mb-6 glow">
              {'>'} ROSTER.exe
            </h2>

            {/* Agent List */}
            <div className="space-y-4">
              {agents.map((agent) => (
                <a
                  key={agent.name}
                  href={agent.link}
                  target={agent.external ? '_blank' : undefined}
                  rel={agent.external ? 'noopener noreferrer' : undefined}
                  className="block p-4 border border-cyan-400/20
                             hover:border-cyan-400/60 hover:bg-cyan-400/5
                             transition-all duration-300 group"
                >
                  <div className="flex items-center gap-4">
                    {/* Icon */}
                    <div className={`${agent.icon === 'ai' ? 'text-purple-400 glitch' : 'text-cyan-400'}`}>
                      {agent.icon === 'human' ? <HumanIcon /> : <AIIcon />}
                    </div>

                    {/* Info */}
                    <div className="flex-1">
                      <div className="text-cyan-400 font-mono text-base md:text-lg
                                      group-hover:glow transition-all">
                        {agent.name}
                        {agent.external && <span className="text-cyan-400/40 ml-2">↗</span>}
                      </div>
                      <div className="text-cyan-400/60 font-mono text-xs md:text-sm mt-1">
                        {agent.role}
                      </div>
                    </div>
                  </div>
                </a>
              ))}
            </div>

            {/* About Link */}
            <div className="mt-6 pt-4 border-t border-cyan-400/20">
              <a
                href="/about"
                className="block p-4 border border-cyan-400/20
                           hover:border-cyan-400/60 hover:bg-cyan-400/5
                           transition-all duration-300 group text-center"
              >
                <div className="text-cyan-400 font-mono text-sm md:text-base
                                group-hover:glow transition-all tracking-wider">
                  {'>'} about AOIFUTURE
                </div>
                <div className="text-cyan-400/40 font-mono text-xs mt-1">
                  LABEL.INFO
                </div>
              </a>
            </div>

            {/* Footer */}
            <div className="mt-6 pt-4 border-t border-cyan-400/20
                            text-cyan-400/40 font-mono text-xs text-center">
              {'<'} PRESS ESC OR CLICK OUTSIDE TO CLOSE {'>'}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
