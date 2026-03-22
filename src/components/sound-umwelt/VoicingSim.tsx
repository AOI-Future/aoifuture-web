import { useState, useRef, useEffect } from 'react';
import ParameterSlider from './ParameterSlider';
import InsightBadge from './InsightBadge';
import GuideText from './GuideText';
import WaveformCanvas from './WaveformCanvas';
import { VoicingEngine } from '../../audio/VoicingEngine';
import { noteToMidi } from '../../audio/utils';
import type { AudioEngine } from '../../audio/AudioEngine';

const NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const OCTAVES = [3, 4, 5] as const;

function getHardnessGuide(hardness: number): { what: string; listen: string } {
  if (hardness < 25) {
    return {
      what: 'フェルトが非常に柔らかい状態。ハンマーが弦に長く接触し、高い倍音が吸収されます。',
      listen: '「ぼわん」とした、こもった音になります。基音（一番低い音）が支配的で、キラキラ感がほとんどありません。ジャズのバラードで聴くような、温かく暗い音色です。',
    };
  }
  if (hardness < 50) {
    return {
      what: 'やや柔らかめのフェルト。自然な倍音バランスに近い状態です。',
      listen: '柔らかさの中にも少し明るさがあります。倍音が自然に減衰し、聴き疲れしにくい音です。家庭のアップライトピアノに近い音色。',
    };
  }
  if (hardness < 75) {
    return {
      what: 'やや硬めのフェルト。高い倍音が出やすくなり、音の輪郭がはっきりします。',
      listen: '音にキラキラした成分が増えてきます。スペクトル表示で高次の倍音バーが伸びているのが見えるはずです。コンサートホール向けの華やかな音色。',
    };
  }
  return {
    what: 'フェルトが非常に硬い状態。ハンマーが弦に短く鋭く当たり、高い倍音が強調されます。',
    listen: '「キンキン」した金属的な音になります。高次倍音のバーが基音に迫る高さまで伸びているのが見えます。これは調律師が「硬すぎる」と判断する状態です。',
  };
}

const SOCIAL_WHY = 'ピアノ調律師の「整音」は、針でハンマーのフェルトを刺して柔らかさを調整する繊細な作業です。同じピアノでも整音次第で全く違う楽器に聞こえます。コンサートピアニストは曲ごとに異なる音色を求め、調律師はハンマー1本1本を手作業で調整します。AIの時代にも置き換えられない、人間の耳と手による「知覚の設計」です。';

interface Props {
  engine: AudioEngine;
}

export default function VoicingSim({ engine }: Props) {
  const [hardness, setHardness] = useState(50);
  const [octave, setOctave] = useState(4);
  const [selectedNote, setSelectedNote] = useState('C');
  const [velocity, setVelocity] = useState(60);
  const [showMore, setShowMore] = useState(false);

  const voicingEngineRef = useRef<VoicingEngine | null>(null);

  useEffect(() => {
    if (engine.initialized) {
      voicingEngineRef.current = new VoicingEngine(engine.context, engine.master);
    }
    return () => {
      voicingEngineRef.current?.dispose();
    };
  }, [engine]);

  const play = (note?: string) => {
    const n = note || selectedNote;
    const midi = noteToMidi(`${n}${octave}`);
    voicingEngineRef.current?.play(midi, hardness, velocity);
  };

  const guide = getHardnessGuide(hardness);

  // Harmonic spectrum preview
  const harmonicLevels = Array.from({ length: 8 }, (_, i) => {
    const h = i + 1;
    let db: number;
    if (hardness <= 50) {
      const softFactor = 1 - hardness / 50;
      db = -6 * Math.log2(h) - softFactor * 20 * Math.log2(Math.max(h, 1));
    } else {
      const hardFactor = (hardness - 50) / 50;
      db = -6 * Math.log2(h) + hardFactor * 6 * Math.log2(Math.max(h, 1));
    }
    return Math.max(0, Math.min(1, 1 + db / 40));
  });

  return (
    <div className="space-y-4">
      {/* Intro */}
      <div className="text-cyan-400/60 text-xs md:text-sm font-[system-ui] leading-relaxed">
        ピアノの音色は「ハンマーのフェルトの硬さ」で決まります。
        スライダーを動かして、同じ鍵盤でも音色がどれほど変わるか体感してください。
      </div>

      {/* Harmonic spectrum bars with labels */}
      <div className="bg-black/40 border border-cyan-400/10 p-4">
        <div className="text-cyan-400/40 font-mono text-[10px] mb-1">HARMONIC SPECTRUM — 倍音の強さ</div>
        <div className="text-cyan-400/30 text-[9px] font-[system-ui] mb-2">
          左端が基音（最も低い音）、右に行くほど高い倍音。バーが高いほどその倍音が強く鳴っています。
        </div>
        <div className="flex items-end gap-1 h-16">
          {harmonicLevels.map((level, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full transition-all duration-300"
                style={{
                  height: `${level * 60}px`,
                  backgroundColor: `rgba(255, 176, 48, ${0.3 + level * 0.5})`,
                  boxShadow: level > 0.5 ? '0 0 4px rgba(255,176,48,0.3)' : 'none',
                }} />
              <span className="text-cyan-400/30 text-[8px] font-mono">
                {i === 0 ? '基' : `${i + 1}倍`}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Waveform */}
      <WaveformCanvas analyser={engine.initialized ? engine.analyserNode : null} color="#ffb030" height={80} />

      {/* Primary: Hardness slider */}
      <div>
        <ParameterSlider
          label={`HAMMER HARDNESS — ${hardness < 25 ? '非常に柔らかい' : hardness < 50 ? 'やや柔らかい' : hardness < 75 ? 'やや硬い' : '非常に硬い'}`}
          value={hardness}
          min={0}
          max={100}
          onChange={(v) => { setHardness(v); }}
        />
        <div className="flex justify-between text-[9px] text-cyan-400/30 font-mono mt-1">
          <span>柔 — こもった音</span>
          <span>硬 — キンキンした音</span>
        </div>
      </div>

      {/* Dynamic guide */}
      <GuideText what={guide.what} listen={guide.listen} />

      {/* Note buttons */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-cyan-400/60 font-mono text-xs tracking-wider">NOTE — タップで発音</span>
          <div className="flex gap-1 ml-auto">
            {OCTAVES.map((o) => (
              <button key={o} onClick={() => setOctave(o)}
                className={`px-2 py-1 font-mono text-[10px] border cursor-pointer transition-all
                  ${octave === o ? 'border-piano text-piano bg-piano' : 'border-cyan-400/20 text-cyan-400/40 hover:border-cyan-400/40'}`}>
                Oct{o}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {NOTES.map((n) => (
            <button key={n}
              onClick={() => { setSelectedNote(n); play(n); }}
              className={`py-3 font-mono text-sm border transition-all cursor-pointer min-h-[44px]
                ${selectedNote === n ? 'border-piano text-piano bg-piano' : 'border-cyan-400/20 text-cyan-400/50 hover:border-piano/50 hover:text-piano'}`}>
              {n}
            </button>
          ))}
        </div>
        <div className="text-cyan-400/30 text-[9px] font-[system-ui]">
          同じ音名でもハンマー硬度を変えてから弾き直すと音色の違いがわかります。まず硬度0で弾いてから、100に変えて同じ音を弾いてみてください。
        </div>
      </div>

      {/* Secondary */}
      <button onClick={() => setShowMore(!showMore)}
        className="text-cyan-400/40 font-mono text-xs hover:text-cyan-400/60 transition-colors cursor-pointer">
        {'>'} MORE OPTIONS {showMore ? '[-]' : '[+]'}
      </button>

      {showMore && (
        <div className="pl-2 border-l border-cyan-400/10 space-y-2">
          <ParameterSlider label="VELOCITY — 打鍵の強さ" value={velocity} min={10} max={100} onChange={setVelocity} />
          <div className="text-cyan-400/40 text-[10px] font-[system-ui]">
            弱く弾く（pp）と倍音が少なく柔らかい音、強く弾く（ff）と倍音が増えて力強い音になります。
          </div>
        </div>
      )}

      <InsightBadge text={SOCIAL_WHY} />
    </div>
  );
}
