import { useState, useRef, useEffect, useCallback } from 'react';
import SelectButtons from './SelectButtons';
import ToggleSwitch from './ToggleSwitch';
import InsightBadge from './InsightBadge';
import GuideText from './GuideText';
import SpectrumCanvas from './SpectrumCanvas';
import { EnvironmentEngine } from '../../audio/EnvironmentEngine';
import type { HearingProfile, Environment, Intervention } from '../../audio/EnvironmentEngine';
import type { AudioEngine } from '../../audio/AudioEngine';

const PROFILES = ['健聴', '聴覚過敏', '加齢性難聴', '高音難聴'] as const;
const ENVIRONMENTS = ['スーパー', '教室', 'コンサートホール', '静かな部屋'] as const;
const INTERVENTIONS: Intervention[] = ['ノイズキャンセリング', 'クワイエットアワー', '補聴器'];

const PROFILE_GUIDE: Record<HearingProfile, { what: string; listen: string; social: string }> = {
  健聴: {
    what: '標準的な聴覚です。音がフィルタリングされずにそのまま聞こえます。',
    listen: 'これが「基準」です。他のプロファイルに切り替えたとき、同じ音がどれほど違って聞こえるかを比較してください。',
    social: '健聴者にとっては何でもない日常の音が、他の聴覚特性を持つ人には全く異なる体験になります。その違いを知ることが、この体験の目的です。',
  },
  聴覚過敏: {
    what: '2kHz〜5kHz帯域（子供の叫び声、レジのビープ音、食器のぶつかる音の周波数帯）が+15dB増幅されます。通常の音が「痛い」レベルで聞こえる状態です。',
    listen: 'スペクトル表示の中〜高音域が大きく跳ね上がるのが見えます。特にスーパーの環境音で、レジのビープ音が突き刺さるような音になります。これが聴覚過敏の方の日常です。',
    social: '発達障害（ASD等）の方の多くが聴覚過敏を持っています。スーパーに買い物に行くだけで激しい疲労や苦痛を感じ、外出そのものが困難になることがあります。これは「気のせい」ではなく、神経系の違いによる生理的な反応です。',
  },
  加齢性難聴: {
    what: '4kHz以上の高音が-30dB減衰します。加齢により内耳の有毛細胞が劣化し、高い周波数から聞こえにくくなります。65歳以上の約3人に1人が該当します。',
    listen: 'スペクトルの右側（高音域）がごっそり消えます。子音（「さ」「た」「か」の区別）が聞き取りにくくなります。母音は比較的低い周波数なので聞こえますが、「何を言っているかわからない」状態になります。',
    social: '「聞こえているのに聞き取れない」のが加齢性難聴の特徴です。声は聞こえるが言葉が判別できない。テレビの音量を上げても改善しません。補聴器はこの失われた高音域を増幅して補います。',
  },
  高音難聴: {
    what: '2kHz以上が急峻にカットされます。先天性や騒音性の難聴で見られるパターンです。',
    listen: '加齢性難聴よりさらに広い範囲の高音が消えます。音がこもり、水の中で聴いているような感覚です。スペクトルの半分以上が欠落しているのが見えます。',
    social: '工場や建設現場での長期的な騒音暴露、イヤホンでの大音量視聴がこのタイプの難聴を引き起こします。若年層でも増加しており、WHO は11億人の若者が難聴リスクにあると警告しています。',
  },
};

const ENV_GUIDE: Record<Environment, string> = {
  スーパー: 'BGM、レジのビープ音、空調音、人の声が混在する典型的な商業空間。聴覚過敏の方にとって最も辛い環境の一つです。',
  教室: '子供の声とチャイムが特徴。反響の多い教室では、難聴の子供が先生の声を聞き取れないことがあります。',
  コンサートホール: '楽器の和音が響く空間。音楽のために設計された残響ですが、聴覚過敏の方には過剰な刺激になりえます。',
  静かな部屋: '環境ノイズが最小限の空間。聴覚過敏の方にとっては安心できる場所であり、難聴の方にとっては最も会話しやすい環境です。',
};

const INTERVENTION_GUIDE: Record<Intervention, string> = {
  ノイズキャンセリング: '低周波の環境騒音（空調、交通音）をカットします。聴覚過敏の方がイヤーマフやノイキャンイヤホンを使う理由です。ON/OFFで低音ノイズの変化を聴き比べてください。',
  クワイエットアワー: 'BGMやビープ音をミュートし、全体音量を下げます。欧米のスーパーで広がっている取り組みで、照明を落とし、館内放送を止め、レジのビープ音を消す時間帯です。日本ではまだほとんど導入されていません。',
  補聴器: '難聴で失われた周波数帯を増幅して補います。聴覚過敏の場合は効果がないか、逆効果になります。ON/OFFで高音の回復を聴き比べてください。',
};

interface Props {
  engine: AudioEngine;
}

export default function EnvironmentSim({ engine }: Props) {
  const [profile, setProfile] = useState<HearingProfile>('健聴');
  const [env, setEnv] = useState<Environment>('スーパー');
  const [interventions, setInterventions] = useState<Set<Intervention>>(new Set());
  const [isPlaying, setIsPlaying] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const envEngineRef = useRef<EnvironmentEngine | null>(null);

  useEffect(() => {
    if (engine.initialized) {
      envEngineRef.current = new EnvironmentEngine(engine.context, engine.master);
    }
    return () => {
      envEngineRef.current?.dispose();
    };
  }, [engine]);

  const togglePlay = () => {
    if (!envEngineRef.current) return;
    if (isPlaying) {
      envEngineRef.current.stop();
      setIsPlaying(false);
    } else {
      envEngineRef.current.start(env, profile, interventions);
      setIsPlaying(true);
    }
  };

  const handleProfileChange = (p: HearingProfile) => {
    setProfile(p);
    if (isPlaying && envEngineRef.current) {
      envEngineRef.current.applyProfile(p);
    }
  };

  const handleEnvChange = (e: Environment) => {
    setEnv(e);
    if (isPlaying && envEngineRef.current) {
      envEngineRef.current.start(e, profile, interventions);
    }
  };

  const toggleIntervention = (intervention: Intervention) => {
    const next = new Set(interventions);
    if (next.has(intervention)) {
      next.delete(intervention);
    } else {
      next.add(intervention);
    }
    setInterventions(next);
    if (isPlaying && envEngineRef.current) {
      envEngineRef.current.applyInterventions(next);
    }
  };

  const getFrequencyData = useCallback(() => {
    return envEngineRef.current?.getFrequencyData() ?? null;
  }, []);

  const profileGuide = PROFILE_GUIDE[profile];

  return (
    <div className="space-y-4">
      {/* Intro — this is the most important section socially */}
      <div className="text-cyan-400/60 text-xs md:text-sm font-[system-ui] leading-relaxed">
        <strong className="text-cyan-400/80">同じ音が、人によって全く異なる体験になります。</strong><br />
        まず「健聴」でスーパーの音を聴いてから、「聴覚過敏」に切り替えてみてください。
        あなたが何気なく過ごしているスーパーが、ある人にとってはどれほど辛い空間かを体感できます。
      </div>

      {/* Spectrum */}
      <div>
        <SpectrumCanvas getFrequencyData={isPlaying ? getFrequencyData : null} color="#40ff80" height={100} active={isPlaying} />
        <div className="flex justify-between text-[9px] text-cyan-400/30 font-mono mt-1">
          <span>低音 ← </span>
          <span>周波数</span>
          <span> → 高音</span>
        </div>
        {!isPlaying && (
          <div className="text-center text-cyan-400/30 text-[10px] font-mono mt-2">
            PLAYを押すとスペクトルが表示されます
          </div>
        )}
      </div>

      {/* Primary: Profile */}
      <SelectButtons label="HEARING PROFILE — あなたの聴覚を切り替える" options={PROFILES} value={profile} onChange={handleProfileChange} colorClass="border-env text-env" />

      {/* Dynamic guide */}
      <GuideText what={profileGuide.what} listen={profileGuide.listen} why={profileGuide.social} />

      {/* Play/Stop */}
      <button onClick={togglePlay}
        className={`w-full py-3 border font-mono text-sm transition-all duration-200
                    cursor-pointer tracking-wider min-h-[44px]
                    ${isPlaying
                      ? 'border-red-400/50 text-red-400 hover:bg-red-400/10'
                      : 'border-env text-env hover:bg-env'}`}>
        {'>'} {isPlaying ? 'STOP' : 'PLAY'} [{env}]
      </button>

      {/* Suggested experiment */}
      <div className="text-cyan-400/50 text-xs font-[system-ui] italic pl-3 border-l-2 border-env/30">
        {profile === '健聴'
          ? '再生中に「聴覚過敏」に切り替えると、リアルタイムで音の変化を体感できます。スペクトルの変化にも注目してください。'
          : profile === '聴覚過敏'
          ? '再生中に「クワイエットアワー」をONにしてみてください。BGMとビープ音が消え、過敏な耳にとってどれほど楽になるかがわかります。'
          : '再生中に「補聴器」をONにしてみてください。失われた高音域がどの程度回復するかを聴き比べられます。'
        }
      </div>

      {/* Secondary */}
      <button onClick={() => setShowMore(!showMore)}
        className="text-cyan-400/40 font-mono text-xs hover:text-cyan-400/60 transition-colors cursor-pointer">
        {'>'} MORE OPTIONS — 環境と介入を変える {showMore ? '[-]' : '[+]'}
      </button>

      {showMore && (
        <div className="space-y-4 pl-2 border-l border-cyan-400/10">
          <SelectButtons label="ENVIRONMENT — 場所を変える" options={ENVIRONMENTS} value={env} onChange={handleEnvChange} colorClass="border-env text-env" />
          <div className="text-cyan-400/40 text-[10px] font-[system-ui]">
            {ENV_GUIDE[env]}
          </div>

          <div className="space-y-2">
            <div className="text-cyan-400/60 font-mono text-xs tracking-wider">
              INTERVENTION — 社会的介入
            </div>
            {INTERVENTIONS.map((intervention) => (
              <div key={intervention} className="space-y-1">
                <ToggleSwitch
                  label={intervention}
                  checked={interventions.has(intervention)}
                  onChange={() => toggleIntervention(intervention)}
                />
                <div className="text-cyan-400/30 text-[10px] font-[system-ui] pl-4">
                  {INTERVENTION_GUIDE[intervention]}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="text-cyan-400/30 font-mono text-[10px] leading-relaxed border border-cyan-400/10 p-2">
        NOTE: このシミュレーションは聴覚特性の概念的な体験です。実際の聴覚過敏・難聴はより複雑で個人差があります。医学的な診断・治療の代替にはなりません。
      </div>

      <InsightBadge
        text="日本ではクワイエットアワーの導入はまだ稀ですが、英国のMorrisonsやAsda、豪州のColes等では定期的に実施されています。照明を落とし、BGM・館内放送・レジ音を消すだけで、感覚過敏の方だけでなく、高齢者や小さな子供連れにとっても買い物しやすい環境になります。「環境を整音する」ことは、誰かを排除から包摂へ変える行為です。"
      />
    </div>
  );
}
