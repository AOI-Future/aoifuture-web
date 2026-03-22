import { useState, useRef, useEffect, useCallback } from 'react';
import SelectButtons from './SelectButtons';
import ParameterSlider from './ParameterSlider';
import InsightBadge from './InsightBadge';
import GuideText from './GuideText';
import WaveformCanvas from './WaveformCanvas';
import { RoomEngine } from '../../audio/RoomEngine';
import type { WallMaterial, RoomSource } from '../../audio/RoomEngine';
import type { AudioEngine } from '../../audio/AudioEngine';

const MATERIALS = ['コンクリート', '木', 'カーペット', '吸音パネル'] as const;
const SOURCES = ['クラップ', 'ピアノ', '声'] as const;

const MATERIAL_GUIDE: Record<WallMaterial, { what: string; listen: string; real: string }> = {
  コンクリート: {
    what: 'コンクリートはほとんど音を吸収しません（吸音率2%）。音のエネルギーの98%が跳ね返ります。',
    listen: '手を叩くと「パーーーン」と長く響きます。音が消えるまでの時間（残響時間）が非常に長いのが特徴です。お風呂場で声が響くのと同じ原理です。',
    real: '体育館、地下駐車場、トンネルがこれです。会話が聞き取りにくく、音が重なって「うるさい」と感じやすい空間です。',
  },
  木: {
    what: '木材は適度に音を吸収します（吸音率10%）。中音域を程よく反射するため、温かみのある響きになります。',
    listen: 'コンクリートより残響が短く、音に温かみがあります。楽器の音が心地よく響く程度の残響です。',
    real: 'コンサートホールの多くが木を採用する理由がここにあります。音楽にとって「ちょうどいい」残響を作れるのです。',
  },
  カーペット: {
    what: 'カーペットは音をかなり吸収します（吸音率30%）。特に高音域を吸いやすい特徴があります。',
    listen: '残響がぐっと短くなります。音が「デッド」になり、ドライで直接的な音になります。木と比べてみてください。',
    real: 'オフィスやホテルの廊下にカーペットが敷かれているのは、足音や会話の反響を抑えるためです。',
  },
  吸音パネル: {
    what: '専用の吸音材は音の80%を吸収します。録音スタジオやコールセンターで使われます。',
    listen: '残響がほぼ消え、非常にドライな音になります。「手を叩いた音がそのまま消える」感覚です。会議室で壁に吸音パネルを貼ると、声の明瞭度が劇的に上がります。',
    real: 'この「過度に静かな空間」は、逆に不快に感じる人もいます。人間は適度な残響がある方が自然に感じるのです。',
  },
};

const SOCIAL_WHY = '建築音響は「その空間にいる人の聴覚体験を設計する」行為です。学校の教室が響きすぎれば先生の声が聞き取れない。オフィスが反響だらけなら集中できない。特に聴覚障害のある方にとって、残響の制御は「会話できるかどうか」を左右する死活問題です。バリアフリーは段差だけの問題ではありません。';

interface Props {
  engine: AudioEngine;
}

export default function RoomSim({ engine }: Props) {
  const [material, setMaterial] = useState<WallMaterial>('コンクリート');
  const [volume, setVolume] = useState(500);
  const [source, setSource] = useState<RoomSource>('クラップ');
  const [showMore, setShowMore] = useState(false);
  const [t60, setT60] = useState(0);

  const roomEngineRef = useRef<RoomEngine | null>(null);
  const setupTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (engine.initialized) {
      const re = new RoomEngine(engine.context, engine.master);
      roomEngineRef.current = re;
      re.setupRoom(material, volume);
      setT60(re.getT60(material, volume));
    }
    return () => {
      roomEngineRef.current?.dispose();
    };
  }, [engine]);

  const setupRoom = useCallback((mat: WallMaterial, vol: number) => {
    if (setupTimeoutRef.current) clearTimeout(setupTimeoutRef.current);
    setupTimeoutRef.current = setTimeout(() => {
      roomEngineRef.current?.setupRoom(mat, vol);
      if (roomEngineRef.current) setT60(roomEngineRef.current.getT60(mat, vol));
    }, 300);
  }, []);

  const handleMaterialChange = (mat: WallMaterial) => {
    setMaterial(mat);
    setupRoom(mat, volume);
  };

  const handleVolumeChange = (vol: number) => {
    setVolume(vol);
    setupRoom(material, vol);
  };

  const play = () => {
    roomEngineRef.current?.play(source);
  };

  const materialColors: Record<WallMaterial, string> = {
    コンクリート: 'rgba(150,150,160,0.3)',
    木: 'rgba(180,120,60,0.3)',
    カーペット: 'rgba(100,60,60,0.3)',
    吸音パネル: 'rgba(60,60,100,0.3)',
  };

  const guide = MATERIAL_GUIDE[material];

  // T60 interpretation
  const t60Label = t60 > 3 ? '大聖堂級 — 会話困難' :
                   t60 > 1.5 ? 'ホール級 — 音楽向き' :
                   t60 > 0.5 ? '部屋級 — 自然な響き' :
                   'スタジオ級 — デッド';

  return (
    <div className="space-y-4">
      {/* Intro */}
      <div className="text-cyan-400/60 text-xs md:text-sm font-[system-ui] leading-relaxed">
        同じ手拍子でも、お風呂場とカーペットの部屋では全く違って聞こえます。
        壁の素材を変えて、空間がどれほど音を変えるか体感してください。
      </div>

      {/* Room visualization */}
      <div className="bg-black/40 border border-cyan-400/10 p-4">
        <div className="relative" style={{ perspective: '400px' }}>
          <div className="mx-auto border transition-all duration-500"
            style={{
              width: `${40 + Math.log10(volume) * 15}%`,
              height: `${60 + Math.log10(volume) * 8}px`,
              backgroundColor: materialColors[material],
              borderColor: 'rgba(77,127,255,0.3)',
              transform: 'rotateX(5deg)',
            }}>
            <div className="flex items-center justify-center h-full">
              <span className="text-room font-mono text-xs opacity-60">{volume}m³</span>
            </div>
          </div>
        </div>
        <div className="text-center mt-2 space-y-1">
          <div className="text-room font-mono text-sm">
            残響時間 T60: {t60.toFixed(2)}秒
          </div>
          <div className="text-cyan-400/40 text-[10px] font-[system-ui]">
            {t60Label}
          </div>
          <div className="text-cyan-400/30 text-[9px] font-[system-ui]">
            T60 = 音が60dB（1/1000）に減衰するまでの時間
          </div>
        </div>
      </div>

      {/* Waveform */}
      <WaveformCanvas analyser={engine.initialized ? engine.analyserNode : null} color="#4d7fff" height={80} />

      {/* Primary: Wall material */}
      <SelectButtons label="WALL — 壁の素材" options={MATERIALS} value={material} onChange={handleMaterialChange} colorClass="border-room text-room" />

      {/* Dynamic guide */}
      <GuideText what={guide.what} listen={guide.listen} />

      <div className="text-cyan-400/50 text-xs font-[system-ui] italic pl-3 border-l-2 border-room/30">
        {guide.real}
      </div>

      {/* Play */}
      <button onClick={play}
        className="w-full py-3 border border-room text-room font-mono text-sm
                   hover:bg-room transition-all duration-200 cursor-pointer tracking-wider min-h-[44px]">
        {'>'} PLAY [{source}]
      </button>

      <div className="text-cyan-400/30 text-[9px] font-[system-ui]">
        コンクリートで再生してから吸音パネルに切り替えて再生すると、残響の違いが最もわかりやすいです。
      </div>

      {/* Secondary */}
      <button onClick={() => setShowMore(!showMore)}
        className="text-cyan-400/40 font-mono text-xs hover:text-cyan-400/60 transition-colors cursor-pointer">
        {'>'} MORE OPTIONS — 部屋の大きさ・音源を変える {showMore ? '[-]' : '[+]'}
      </button>

      {showMore && (
        <div className="space-y-3 pl-2 border-l border-cyan-400/10">
          <ParameterSlider label="ROOM SIZE — 部屋の容積" value={volume} min={30} max={30000} step={10} unit="m³" onChange={handleVolumeChange} />
          <div className="text-cyan-400/40 text-[10px] font-[system-ui]">
            30m³ ≈ 浴室、500m³ ≈ 教室、30000m³ ≈ 大聖堂。部屋が大きいほど音が消えるまでの時間が長くなります。
          </div>
          <SelectButtons label="SOURCE — 音源" options={SOURCES} value={source} onChange={setSource} colorClass="border-room text-room" />
          <div className="text-cyan-400/40 text-[10px] font-[system-ui]">
            クラップ（手拍子）は短い衝撃音なので残響がわかりやすく、声は残響の中で「聞き取れるかどうか」を体感できます。
          </div>
        </div>
      )}

      <InsightBadge text={SOCIAL_WHY} />
    </div>
  );
}
