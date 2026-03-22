const DOMAINS = [
  { key: 'VOICE', label: '声の調音', target: '声道の形状', purpose: '意図した音の生成', operation: '口の形を変える', color: 'text-voice',
    social: '構音障害のリハビリ — 言語聴覚士が「どこで・どう音を作るか」を再設計する' },
  { key: 'PIANO', label: 'ピアノの整音', target: 'ハンマーフェルト', purpose: '表現域の最大化', operation: '針で柔らかさを変える', color: 'text-piano',
    social: 'AIに置き換えられない職人技 — 1本1本のハンマーを手で調整する知覚の設計' },
  { key: 'ROOM', label: '空間の調音', target: '部屋の音場', purpose: '聴取体験の最適化', operation: '壁材を変える', color: 'text-room',
    social: '音のバリアフリー — 残響制御が「会話できるかどうか」を左右する' },
  { key: 'ENV', label: '環境の整音', target: '音環境全体', purpose: '知覚への適応', operation: 'BGMを消す・補聴器', color: 'text-env',
    social: 'クワイエットアワー — 環境を調整するだけで「排除」が「包摂」に変わる' },
];

export default function InsightSection() {
  return (
    <div className="space-y-6">
      {/* Intro */}
      <div className="text-cyan-400/60 text-xs md:text-sm font-[system-ui] leading-relaxed">
        4つのシミュレーションを体験して、気づいたことはありませんか？
        一見バラバラに見える4つの領域が、実は同じ構造を持っています。
      </div>

      <div className="font-mono text-cyan-400/60 text-xs space-y-1">
        <div>{'>'} CROSS-DOMAIN ANALYSIS COMPLETE</div>
      </div>

      {/* Comparison table */}
      <div className="overflow-x-auto -mx-4 px-4">
        <table className="w-full font-mono text-xs border-collapse min-w-[500px]">
          <thead>
            <tr className="text-cyan-400/80">
              <th className="text-left p-2 border border-cyan-400/20">DOMAIN</th>
              <th className="text-left p-2 border border-cyan-400/20">何を調整するか</th>
              <th className="text-left p-2 border border-cyan-400/20">何のために</th>
              <th className="text-left p-2 border border-cyan-400/20">社会的意味</th>
            </tr>
          </thead>
          <tbody>
            {DOMAINS.map((d) => (
              <tr key={d.key} className="hover:bg-cyan-400/5 transition-colors">
                <td className={`p-2 border border-cyan-400/20 ${d.color} font-bold whitespace-nowrap`}>
                  {d.label}
                </td>
                <td className="p-2 border border-cyan-400/20 text-cyan-400/70">
                  {d.target}
                </td>
                <td className="p-2 border border-cyan-400/20 text-cyan-400/70">
                  {d.purpose}
                </td>
                <td className="p-2 border border-cyan-400/20 text-cyan-400/50 text-[10px] font-[system-ui]">
                  {d.social}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Structure revelation */}
      <div className="border border-cyan-400/20 p-4 space-y-4">
        <div className="text-cyan-400 font-mono text-sm glow">
          {'>'} PATTERN DETECTED
        </div>
        <p className="text-cyan-400/80 text-sm leading-relaxed font-[system-ui]">
          4つの領域すべてに共通する構造：
        </p>
        <div className="space-y-2 text-xs md:text-sm font-[system-ui]">
          <div className="flex gap-2">
            <span className="text-cyan-400/40 font-mono shrink-0">1.</span>
            <span className="text-cyan-400/70">
              <strong className="text-cyan-400/90">調整対象がある</strong> — 声道、ハンマー、壁、音環境
            </span>
          </div>
          <div className="flex gap-2">
            <span className="text-cyan-400/40 font-mono shrink-0">2.</span>
            <span className="text-cyan-400/70">
              <strong className="text-cyan-400/90">「聴く主体」がいる</strong> — 話し相手、聴衆、住人、買い物客
            </span>
          </div>
          <div className="flex gap-2">
            <span className="text-cyan-400/40 font-mono shrink-0">3.</span>
            <span className="text-cyan-400/70">
              <strong className="text-cyan-400/90">主体の知覚世界を設計している</strong> — 伝わる音、美しい音、快適な音、耐えられる音
            </span>
          </div>
        </div>
      </div>

      {/* Umwelt conclusion */}
      <div className="border border-cyan-400/30 bg-cyan-400/5 p-5 space-y-4">
        <div className="text-cyan-400 font-mono text-sm glow tracking-wider">
          {'>'} CONCLUSION: UMWELT DESIGN
        </div>
        <p className="text-cyan-400/90 text-sm md:text-base leading-relaxed font-[system-ui]">
          すべての「調音」と「整音」は、<strong>誰かの環世界（Umwelt）を設計する行為</strong>です。
        </p>
        <p className="text-cyan-400/60 text-xs md:text-sm leading-relaxed font-[system-ui]">
          生物学者ユクスキュルが提唱した「環世界（Umwelt）」とは、
          すべての生物が固有の知覚フィルタを通して世界を経験しているという考え方です。
          ダニはダニの、人間は人間の世界を生きている。
          そして同じ人間同士でも — 聴覚過敏の方と健聴者は、同じスーパーにいても<strong>異なる音の世界を生きている</strong>。
        </p>
        <p className="text-cyan-400/50 text-xs leading-relaxed font-[system-ui]">
          音を調えるとは、技術的な操作ではなく、
          誰かの知覚世界そのものに手を差し伸べることです。
          クワイエットアワーを導入する店長も、ハンマーに針を刺す調律師も、
          教室の壁に吸音材を貼る設計者も、同じことをしています —
          <strong>他者のUmweltを想像し、設計する</strong>。
        </p>
      </div>

      <div className="text-center space-y-2">
        <div className="text-cyan-400/30 font-mono text-[10px]">
          {'<'} ALL DOMAINS = UMWELT DESIGN {'>'}
        </div>
      </div>
    </div>
  );
}
