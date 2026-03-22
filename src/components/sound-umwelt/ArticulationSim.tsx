import { useState, useRef, useEffect } from 'react';
import SelectButtons from './SelectButtons';
import ToggleSwitch from './ToggleSwitch';
import InsightBadge from './InsightBadge';
import GuideText from './GuideText';
import WaveformCanvas from './WaveformCanvas';
import { ArticulationEngine } from '../../audio/ArticulationEngine';
import type { Place, Manner, Vowel } from '../../audio/ArticulationEngine';
import type { AudioEngine } from '../../audio/AudioEngine';

const PLACES = ['両唇', '歯茎', '軟口蓋', '声門'] as const;
const MANNERS = ['破裂', '摩擦', '鼻', '接近'] as const;
const VOWELS = ['あ', 'い', 'う', 'え', 'お'] as const;

// --- Contextual descriptions per parameter ---

const PLACE_GUIDE: Record<Place, { what: string; listen: string; example: string }> = {
  両唇: {
    what: '唇を閉じて音を作ります。「ぱ」「ば」「ま」の子音がここで生まれます。',
    listen: '音の出だしに注目 — 唇がはじけるような「破裂感」が聞こえます。低めの、こもった立ち上がりが特徴です。',
    example: '「ぱ」と言ってみてください。唇が触れ合ってから離れる瞬間に音が生まれます。',
  },
  歯茎: {
    what: '舌先を上の歯茎に当てて音を作ります。「た」「さ」「な」「ら」の子音がここです。',
    listen: '両唇より高く鋭い音になります。舌先が作る狭い隙間が、より高い周波数のノイズを生みます。',
    example: '「た」と「ぱ」を交互に言ってみてください。「た」の方がシャープに聞こえるはずです。',
  },
  軟口蓋: {
    what: '舌の奥を軟口蓋（口の天井の奥の柔らかい部分）に当てます。「か」「が」の子音です。',
    listen: '「歯茎」と比べると、音の立ち上がりがやや鈍く、口の奥で響く印象があります。中音域のノイズが特徴です。',
    example: '「か」と「た」を比べてみてください。「か」の方が喉に近い場所で鳴っている感覚がありませんか？',
  },
  声門: {
    what: '喉の奥、声帯そのもので音を作ります。「は」の子音や、声門閉鎖音（「あっ」の「っ」）がここです。',
    listen: '他の部位と違い、口の中で狭めを作らず、息の流れだけで音が生まれます。ふわっとした、空気感のある音です。',
    example: 'ため息をつくように「はー」と言ってみてください。口の形を変えなくても音が出ます。それが声門の音です。',
  },
};

const MANNER_GUIDE: Record<Manner, { what: string; listen: string }> = {
  破裂: {
    what: '空気の流れを完全にせき止めてから、一気に解放します。瞬間的な「パン！」という音。',
    listen: '音が始まる瞬間の短い無音（閉鎖）と、直後の破裂音に注目。非常に短い音です。',
  },
  摩擦: {
    what: '狭い隙間に空気を通し続けて、ザーッという摩擦音を作ります。「さ」「は」「ふ」の子音。',
    listen: '破裂と違い、音が持続します。「しゅー」というノイズが聞こえるはずです。',
  },
  鼻: {
    what: '口を閉じたまま、空気を鼻から出します。「ま」「な」「ん」の音。',
    listen: '柔らかく、ハミングのような響きがあります。破裂や摩擦に比べてノイズが少なく、穏やかです。',
  },
  接近: {
    what: '調音器官を近づけるだけで、完全には閉じません。「ら」「わ」「や」のような音。',
    listen: '子音と母音の境界が曖昧です。なめらかに母音へ移行するのが特徴です。',
  },
};

const SOCIAL_WHY = '私たちは毎日、無意識にこれらの調音を使い分けて会話しています。構音障害（発音が困難になる障害）を持つ方は、この「どこで・どう音を作るか」のコントロールに困難を抱えています。言語聴覚士はまさにこの仕組みを理解してリハビリを行います。';

interface Props {
  engine: AudioEngine;
}

export default function ArticulationSim({ engine }: Props) {
  const [place, setPlace] = useState<Place>('歯茎');
  const [manner, setManner] = useState<Manner>('破裂');
  const [vowel, setVowel] = useState<Vowel>('あ');
  const [voiced, setVoiced] = useState(true);
  const [showMore, setShowMore] = useState(false);

  const artEngineRef = useRef<ArticulationEngine | null>(null);

  useEffect(() => {
    if (engine.initialized) {
      artEngineRef.current = new ArticulationEngine(engine.context, engine.master);
    }
    return () => {
      artEngineRef.current?.dispose();
    };
  }, [engine]);

  const play = () => {
    artEngineRef.current?.play(place, manner, vowel, voiced);
  };

  const placePositions: Record<Place, { x: number; label: string }> = {
    両唇: { x: 15, label: '唇' },
    歯茎: { x: 35, label: '歯茎' },
    軟口蓋: { x: 60, label: '軟口蓋' },
    声門: { x: 85, label: '声門' },
  };

  const placeGuide = PLACE_GUIDE[place];
  const mannerGuide = MANNER_GUIDE[manner];

  return (
    <div className="space-y-4">
      {/* Intro */}
      <div className="text-cyan-400/60 text-xs md:text-sm font-[system-ui] leading-relaxed">
        人間の声は、口の中の「どこで」「どうやって」空気の流れを変えるかで決まります。
        ボタンを切り替えて、音の違いを聴き比べてみてください。
      </div>

      {/* Voice tract visualization */}
      <div className="relative bg-black/40 border border-cyan-400/10 p-4">
        <svg viewBox="0 0 100 40" className="w-full h-auto" style={{ maxHeight: '120px' }}>
          <path d="M 10,30 Q 20,10 40,15 Q 60,8 80,20 Q 90,25 95,30" fill="none" stroke="rgba(0,255,255,0.3)" strokeWidth="1" />
          <path d="M 10,35 Q 20,38 40,35 Q 60,38 80,35 Q 90,33 95,30" fill="none" stroke="rgba(0,255,255,0.3)" strokeWidth="1" />
          {/* All positions shown faintly */}
          {(Object.entries(placePositions) as [Place, { x: number; label: string }][]).map(([p, pos]) => (
            <g key={p}>
              <circle cx={pos.x} cy={22} r={p === place ? 4 : 2}
                fill={p === place ? 'rgba(255,77,106,0.3)' : 'rgba(0,255,255,0.1)'}
                stroke={p === place ? '#ff4d6a' : 'rgba(0,255,255,0.2)'}
                strokeWidth="0.5"
              >
                {p === place && <animate attributeName="r" values="3;5;3" dur="1.5s" repeatCount="indefinite" />}
              </circle>
              <text x={pos.x} y={10} textAnchor="middle"
                fill={p === place ? '#ff4d6a' : 'rgba(0,255,255,0.3)'}
                fontSize="3.5" fontFamily="monospace">
                {pos.label}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* Waveform */}
      <WaveformCanvas analyser={engine.initialized ? engine.analyserNode : null} color="#ff4d6a" height={80} />

      {/* Primary: Place */}
      <SelectButtons label="PLACE — どこで音を作るか" options={PLACES} value={place} onChange={setPlace} colorClass="border-voice text-voice" />

      {/* Dynamic guide for current place */}
      <GuideText what={placeGuide.what} listen={placeGuide.listen} />

      {/* Try-this prompt */}
      <div className="text-cyan-400/50 text-xs font-[system-ui] italic pl-3 border-l-2 border-voice/30">
        {placeGuide.example}
      </div>

      {/* Play button */}
      <button onClick={play}
        className="w-full py-3 border border-voice text-voice font-mono text-sm
                   hover:bg-voice transition-all duration-200 cursor-pointer tracking-wider min-h-[44px]">
        {'>'} PLAY [{place} + {manner} + {vowel}]
      </button>

      {/* Secondary */}
      <button onClick={() => setShowMore(!showMore)}
        className="text-cyan-400/40 font-mono text-xs hover:text-cyan-400/60 transition-colors cursor-pointer">
        {'>'} MORE OPTIONS — 調音方法・母音を変える {showMore ? '[-]' : '[+]'}
      </button>

      {showMore && (
        <div className="space-y-4 pl-2 border-l border-cyan-400/10">
          <SelectButtons label="METHOD — どうやって音を作るか" options={MANNERS} value={manner} onChange={setManner} colorClass="border-voice text-voice" />
          <GuideText what={mannerGuide.what} listen={mannerGuide.listen} />

          <SelectButtons label="VOWEL — 母音" options={VOWELS} value={vowel} onChange={setVowel} colorClass="border-voice text-voice" />
          <div className="text-cyan-400/50 text-xs font-[system-ui]">
            母音を変えると、口の中の空間の形が変わります。「い」は口を横に引いて高い音、「お」は口をすぼめて低い音になります。
          </div>

          <ToggleSwitch label="VOICED — 声帯の振動" checked={voiced} onChange={setVoiced} />
          <div className="text-cyan-400/50 text-xs font-[system-ui]">
            {voiced
              ? '声帯が振動しています（有声音）。喉に手を当てると振動を感じるはずです。「が」「ざ」「だ」「ば」がこれです。'
              : '声帯は振動していません（無声音）。ささやき声に近い、息だけの音です。「か」「さ」「た」「ぱ」がこれです。'
            }
          </div>
        </div>
      )}

      <InsightBadge text={SOCIAL_WHY} />
    </div>
  );
}
