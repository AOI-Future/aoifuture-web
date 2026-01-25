import { useEffect, useState, useCallback } from 'react';

export default function PageTransition() {
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleTransition = useCallback((href: string) => {
    // Dispatch fade out event for sound
    window.dispatchEvent(new CustomEvent('page-transition-start'));

    setIsTransitioning(true);

    // Wait for transition then navigate
    setTimeout(() => {
      window.location.href = href;
    }, 600);
  }, []);

  useEffect(() => {
    // Intercept internal link clicks
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a');

      if (!link) return;

      const href = link.getAttribute('href');
      if (!href) return;

      // Only intercept internal links (not external, not mailto, etc.)
      const isInternal = href.startsWith('/') && !href.startsWith('//');
      const isExternal = link.getAttribute('target') === '_blank';

      if (isInternal && !isExternal) {
        e.preventDefault();
        handleTransition(href);
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [handleTransition]);

  // Fade in on mount
  useEffect(() => {
    // Small delay to ensure CSS is loaded
    const timer = setTimeout(() => {
      document.body.classList.add('page-loaded');
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {/* Transition overlay */}
      <div
        className={`fixed inset-0 z-[200] pointer-events-none transition-opacity duration-500
                    bg-black flex items-center justify-center
                    ${isTransitioning ? 'opacity-100' : 'opacity-0'}`}
      >
        {isTransitioning && (
          <div className="text-cyan-400 font-mono text-sm animate-pulse">
            {'>'} LOADING...
          </div>
        )}
      </div>

      {/* Glitch lines during transition */}
      {isTransitioning && (
        <div className="fixed inset-0 z-[199] pointer-events-none overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="absolute h-px bg-cyan-400/60"
              style={{
                top: `${20 + i * 15}%`,
                left: 0,
                right: 0,
                animation: `glitchLine 0.1s ${i * 0.05}s infinite`,
              }}
            />
          ))}
        </div>
      )}

      <style>{`
        @keyframes glitchLine {
          0%, 100% { transform: translateX(-100%); opacity: 0; }
          50% { transform: translateX(100%); opacity: 1; }
        }

        body {
          opacity: 0;
          transition: opacity 0.3s ease-in;
        }

        body.page-loaded {
          opacity: 1;
        }
      `}</style>
    </>
  );
}
