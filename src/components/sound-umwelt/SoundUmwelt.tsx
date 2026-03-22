import { useState, useRef, useCallback, lazy, Suspense } from 'react';
import { AudioEngine } from '../../audio/AudioEngine';
import { EnvironmentEngine } from '../../audio/EnvironmentEngine';

// Lazy load simulation components
const ArticulationSim = lazy(() => import('./ArticulationSim'));
const VoicingSim = lazy(() => import('./VoicingSim'));
const RoomSim = lazy(() => import('./RoomSim'));
const EnvironmentSim = lazy(() => import('./EnvironmentSim'));
const InsightSection = lazy(() => import('./InsightSection'));

type Tab = 'voice' | 'piano' | 'room' | 'env' | 'insight';
type OnboardingPhase = 'hero' | 'normal-playing' | 'hypersensitive' | 'reveal' | 'done';

const TABS: { id: Tab; label: string; colorClass: string }[] = [
  { id: 'voice', label: 'VOICE', colorClass: 'text-voice border-voice glow-voice' },
  { id: 'piano', label: 'PIANO', colorClass: 'text-piano border-piano glow-piano' },
  { id: 'room', label: 'ROOM', colorClass: 'text-room border-room glow-room' },
  { id: 'env', label: 'ENV', colorClass: 'text-env border-env glow-env' },
  { id: 'insight', label: 'INSIGHT', colorClass: 'text-cyan-400 border-cyan-400/50 glow' },
];

const MODULE_NAMES: Record<Tab, string> = {
  voice: 'VOICE_ARTICULATION',
  piano: 'PIANO_VOICING',
  room: 'ROOM_ACOUSTICS',
  env: 'ENVIRONMENTAL_VOICING',
  insight: 'CROSS_DOMAIN_ANALYSIS',
};

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <span className="text-cyan-400/40 font-mono text-xs animate-pulse">
        {'>'} LOADING MODULE...
      </span>
    </div>
  );
}

/** Animated waveform bars for the hero screen */
function HeroWaveform() {
  return (
    <div className="flex items-center justify-center gap-[3px] h-12 my-6">
      {Array.from({ length: 20 }, (_, i) => {
        const delay = i * 0.08;
        const height = 8 + Math.sin(i * 0.7) * 15 + Math.random() * 10;
        return (
          <div
            key={i}
            className="w-1 bg-cyan-400/40 rounded-full"
            style={{
              height: `${height}px`,
              animation: `pulse 1.5s ease-in-out ${delay}s infinite alternate`,
            }}
          />
        );
      })}
      <style>{`
        @keyframes pulse {
          0% { transform: scaleY(0.3); opacity: 0.3; }
          100% { transform: scaleY(1); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}

export default function SoundUmwelt() {
  const [activeTab, setActiveTab] = useState<Tab>('env');
  const [initialized, setInitialized] = useState(false);
  const [volume, setVolume] = useState(80);
  const [onboarding, setOnboarding] = useState<OnboardingPhase>('hero');
  const engineRef = useRef<AudioEngine>(new AudioEngine());
  const demoEngineRef = useRef<EnvironmentEngine | null>(null);

  const handleInit = useCallback(async () => {
    if (initialized) return;
    await engineRef.current.initialize();
    engineRef.current.setMasterVolume(0.8);
    setInitialized(true);
  }, [initialized]);

  const handleVolumeChange = useCallback((v: number) => {
    setVolume(v);
    engineRef.current.setMasterVolume(v / 100);
  }, []);

  const handleTabChange = useCallback(async (tab: Tab) => {
    // Stop demo if running
    if (demoEngineRef.current) {
      demoEngineRef.current.stop();
      demoEngineRef.current = null;
    }
    if (!initialized) {
      await handleInit();
    }
    if (onboarding !== 'done') {
      setOnboarding('done');
    }
    setActiveTab(tab);
  }, [initialized, handleInit, onboarding]);

  // --- Onboarding flow ---

  /** Phase 1: Hero tap → play supermarket as "normal hearing" */
  const startDemo = async () => {
    await handleInit();
    const env = new EnvironmentEngine(engineRef.current.context, engineRef.current.master);
    demoEngineRef.current = env;
    env.start('スーパー', '健聴', new Set());
    setOnboarding('normal-playing');
  };

  /** Phase 2: Apply hypersensitive filter */
  const applyHypersensitive = () => {
    if (demoEngineRef.current) {
      demoEngineRef.current.applyProfile('聴覚過敏');
    }
    setOnboarding('hypersensitive');
  };

  /** Phase 3: Reveal / transition to main app */
  const proceedToApp = () => {
    if (demoEngineRef.current) {
      demoEngineRef.current.stop();
      demoEngineRef.current = null;
    }
    setOnboarding('done');
    setActiveTab('env');
  };

  const skipOnboarding = async () => {
    if (demoEngineRef.current) {
      demoEngineRef.current.stop();
      demoEngineRef.current = null;
    }
    if (!initialized) await handleInit();
    setOnboarding('done');
  };

  // --- Render ---

  // Hero / Onboarding screen
  if (onboarding !== 'done') {
    return (
      <div className="min-h-screen bg-black text-cyan-400 font-mono flex flex-col">
        {/* Back */}
        <a href="/"
          className="fixed top-4 left-4 md:top-6 md:left-6 z-50 px-2 py-1.5 text-sm
                     border border-cyan-400/50 bg-black/50 text-cyan-400 tracking-widest
                     hover:bg-cyan-400/10 transition-colors duration-300">
          {'<'} BACK
        </a>

        <div className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-md w-full text-center space-y-6">

            {onboarding === 'hero' && (
              <>
                <div className="text-cyan-400/30 text-xs tracking-[0.3em]">SOUND UMWELT</div>
                <h1 className="text-xl md:text-2xl leading-relaxed font-[system-ui]">
                  <span className="text-cyan-400/90">あなたが聞いている音は、</span><br />
                  <span className="text-cyan-400 glow">本当に「みんな」が聞いている音ですか？</span>
                </h1>

                <HeroWaveform />

                <p className="text-cyan-400/50 text-sm font-[system-ui] leading-relaxed">
                  このページでは音が鳴ります。<br />
                  スーパーの音を流すので、<br />
                  まずは普通に聴いてみてください。
                </p>

                <button onClick={startDemo}
                  className="w-full py-4 border-2 border-cyan-400/60 text-cyan-400
                             text-base tracking-wider
                             hover:bg-cyan-400/10 hover:border-cyan-400
                             transition-all duration-300 cursor-pointer
                             animate-pulse">
                  TAP — スーパーの音を聴く
                </button>

                <button onClick={skipOnboarding}
                  className="text-cyan-400/20 text-[10px] hover:text-cyan-400/40 transition-colors cursor-pointer">
                  skip {'>>'}
                </button>
              </>
            )}

            {onboarding === 'normal-playing' && (
              <>
                <div className="text-cyan-400/30 text-xs tracking-[0.3em] animate-pulse">
                  PLAYING: スーパー
                </div>
                <div className="space-y-2">
                  <p className="text-cyan-400/80 text-base font-[system-ui] leading-relaxed">
                    BGM、レジのビープ音、空調の音…
                  </p>
                  <p className="text-cyan-400/60 text-sm font-[system-ui] leading-relaxed">
                    よくある、ごく普通のスーパーの音です。<br />
                    特に何も感じないかもしれません。
                  </p>
                </div>

                <HeroWaveform />

                <p className="text-cyan-400/90 text-sm font-[system-ui] font-bold">
                  では — この音が、ある人にはどう聞こえているか体験してみてください。
                </p>

                <button onClick={applyHypersensitive}
                  className="w-full py-4 border-2 border-red-400/60 text-red-400
                             text-base tracking-wider
                             hover:bg-red-400/10 hover:border-red-400
                             transition-all duration-300 cursor-pointer">
                  TAP — 聴覚過敏の聞こえ方に切り替える
                </button>
              </>
            )}

            {onboarding === 'hypersensitive' && (
              <>
                <div className="text-red-400/60 text-xs tracking-[0.3em] animate-pulse">
                  PROFILE: 聴覚過敏
                </div>

                <div className="space-y-3">
                  <p className="text-red-400/90 text-base font-[system-ui] leading-relaxed font-bold">
                    レジのビープ音が突き刺さるように聞こえませんか？
                  </p>
                  <p className="text-cyan-400/70 text-sm font-[system-ui] leading-relaxed">
                    中〜高音域が大幅に増幅されています。<br />
                    これは大げさではなく、聴覚過敏（発達障害やASD等に多い）の方が<br />
                    日常的に経験している音の世界の近似です。
                  </p>
                  <p className="text-cyan-400/50 text-sm font-[system-ui] leading-relaxed">
                    スーパーに行くだけで疲弊する。<br />
                    「気のせいでしょ」と言われる。<br />
                    でも、この音を毎日聴いて暮らしていると想像してみてください。
                  </p>
                </div>

                <div className="border border-cyan-400/20 p-4 text-left space-y-2">
                  <div className="text-cyan-400/60 text-xs font-[system-ui]">
                    英国やオーストラリアのスーパーでは<strong className="text-cyan-400/80">「クワイエットアワー」</strong>を導入しています。
                    BGMを消し、照明を落とし、レジのビープ音を止める時間帯です。
                    音環境を「調整」するだけで、排除が包摂に変わります。
                  </div>
                </div>

                <button onClick={proceedToApp}
                  className="w-full py-4 border-2 border-cyan-400/60 text-cyan-400
                             text-base tracking-wider
                             hover:bg-cyan-400/10 hover:border-cyan-400
                             transition-all duration-300 cursor-pointer">
                  もっと詳しく体験する →
                </button>

                <div className="text-cyan-400/30 text-[10px] font-[system-ui]">
                  音声学、ピアノの整音、建築音響、福祉 —<br />
                  4つの「音を調える」世界を自分で操作できます
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- Main app (post-onboarding) ---
  return (
    <div className="min-h-screen bg-black text-cyan-400 font-mono">
      {/* Back button */}
      <a href="/"
        className="fixed top-4 left-4 md:top-6 md:left-6 z-50
                   px-2 py-1.5 md:px-3 md:py-2 text-sm
                   border border-cyan-400/50 bg-black/50
                   text-cyan-400 font-mono tracking-widest
                   hover:bg-cyan-400/10 hover:border-cyan-400
                   transition-colors duration-300">
        {'<'} BACK
      </a>

      {/* Volume control (top right) */}
      <div className="fixed top-4 right-4 md:top-6 md:right-6 z-50
                      flex items-center gap-2 px-3 py-2
                      bg-black/80 border border-cyan-400/20">
        <span className="text-cyan-400/50 text-[10px]">VOL</span>
        <input
          type="range" min={0} max={100} value={volume}
          onChange={(e) => handleVolumeChange(Number(e.target.value))}
          className="w-16 h-1 bg-cyan-400/20 appearance-none cursor-pointer
                     [&::-webkit-slider-thumb]:appearance-none
                     [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                     [&::-webkit-slider-thumb]:bg-cyan-400
                     [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3
                     [&::-moz-range-thumb]:bg-cyan-400 [&::-moz-range-thumb]:border-0"
          aria-label="Master volume"
        />
      </div>

      {/* Main content */}
      <div className="max-w-2xl mx-auto px-4 pt-16 pb-8">
        {/* Header */}
        <div className="mb-4 space-y-1">
          <div className="text-cyan-400/40 text-xs">{'>'} SOUND_UMWELT.exe</div>
          <h1 className="text-lg md:text-xl tracking-wider glow">Sound Umwelt</h1>
          <div className="text-cyan-400/40 text-[10px] font-[system-ui]">
            音を調える4つの世界 — 自分でパラメータを操作して、音の変化を体感してください
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 mb-6 overflow-x-auto pb-2 -mx-4 px-4">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`
                px-3 py-2 text-xs whitespace-nowrap border transition-all duration-200
                cursor-pointer min-h-[44px] flex-shrink-0
                ${activeTab === tab.id
                  ? `${tab.colorClass} bg-white/5`
                  : 'border-cyan-400/15 text-cyan-400/30 hover:border-cyan-400/30 hover:text-cyan-400/50'
                }
              `}
            >
              [{tab.label}]
            </button>
          ))}
        </div>

        {/* Module header */}
        <div className="text-cyan-400/30 text-[10px] mb-4 border-b border-cyan-400/10 pb-2">
          {'>'} MODULE: {MODULE_NAMES[activeTab]}
        </div>

        {/* Simulation content */}
        <Suspense fallback={<LoadingFallback />}>
          {activeTab === 'voice' && initialized && (
            <ArticulationSim engine={engineRef.current} />
          )}
          {activeTab === 'piano' && initialized && (
            <VoicingSim engine={engineRef.current} />
          )}
          {activeTab === 'room' && initialized && (
            <RoomSim engine={engineRef.current} />
          )}
          {activeTab === 'env' && initialized && (
            <EnvironmentSim engine={engineRef.current} />
          )}
          {activeTab === 'insight' && <InsightSection />}
        </Suspense>

        {/* Footer */}
        <div className="mt-12 pt-4 border-t border-cyan-400/10 text-center space-y-2">
          <div className="text-cyan-400/20 text-[10px]">
            SOUND UMWELT | AOI Future
          </div>
          <div className="text-cyan-400/15 text-[10px]">
            音を調える、4つの世界
          </div>
        </div>
      </div>
    </div>
  );
}
