export const agentSecurityLinks = {
  bookJa: 'https://leanpub.com/agent-security-ja',
  bookEn: 'https://leanpub.com/agent-security',
  webhookTool: '/tools/webhook-check',
  dispatch: 'https://dispatch.aoifuture.com/s/security',
  evidenceDownload: '/agent-security/evidence-demo/AI-Agent-Security-Sample-Evidence.zip',
  checklistDownload: '/agent-security/ai-agent-security-checklist-ja.md',
} as const;

export function gumroadUrl(content: string) {
  const params = new URLSearchParams({
    utm_source: 'aoifuture_reference',
    utm_medium: 'organic',
    utm_campaign: 'agent_security_funnel',
    utm_content: content,
  });
  return `https://0xshugo.gumroad.com/l/AI-Agent?${params.toString()}`;
}

export const chapters = [
  { no: '01', title: 'エージェントセキュリティという問題', summary: 'モデルの出力ではなく、ツールを通じて行使される権限と結果を脅威モデルの中心に置く。' },
  { no: '02', title: '脅威分類', summary: 'TH-01からTH-10まで。攻撃者の目的と侵入経路で、エージェント固有の脅威を整理する。' },
  { no: '03', title: 'コントロール分類', summary: '名前を付けた脅威に対して、何を実装し、どの境界を閉じるのかを定義する。' },
  { no: '04', title: 'アイデンティティと権限', summary: '人間とエージェントの資格情報を分け、短寿命・狭いスコープ・追跡可能な委譲を設計する。' },
  { no: '05', title: 'ツールとアクションの安全性', summary: '許可リスト、入力検証、サンドボックス、承認ゲート、MCPの変更検知で実害の境界を守る。', href: '/agent-security/reference/tool-and-action-safety/' },
  { no: '06', title: '信頼できないコンテンツ・RAG・メモリ', summary: '取得コンテンツと長期記憶を、来歴・信頼レベル・TTL・可逆性を持つデータとして扱う。' },
  { no: '07', title: 'モニタリング・評価・インシデント対応', summary: 'ツール呼び出し、承認、外部送信、委譲を再構築できるログと、停止・失効・復旧の経路を作る。' },
  { no: '08', title: 'ランタイムセキュリティポスチャ', summary: '異常時に能力を段階的に縮小し、レビューなしに暗黙復帰しない状態機械を設計する。' },
  { no: '09', title: '要件仕様', summary: 'コントロールをREQ識別子とRFC 2119のSHALL／SHOULDで、真偽を判定できる要求へ変える。' },
  { no: '10', title: '検証とテスト', summary: 'VT-S・VT-D・VT-E・VT-Aで、要件を反復可能なPASS／FAILと保持できる証跡へ変える。' },
  { no: '11', title: 'ガバナンスとコンプライアンス', summary: 'リスクの所有者、例外、監督、レビュー記録を、技術的なテスト結果と接続する。' },
] as const;

export const checklistGroups = [
  {
    title: 'Identity / Delegation',
    items: [
      ['REQ-001', 'エージェントは、人間の常設クレデンシャルを共有せず、独立したワークロードIDで動く。'],
      ['REQ-002', '委譲する権限に、目的・期間・対象・操作・承認者・失効条件がある。'],
      ['REQ-051', '子エージェントのスコープは親より狭く、委譲チェーンを相関IDで追跡できる。'],
    ],
  },
  {
    title: 'Tools / Actions / MCP',
    items: [
      ['REQ-010', '利用可能なツールが明示的な許可リストにあり、ネットワーク・書込・コード・資金のリスク分類がある。'],
      ['REQ-011', 'ツール権限が最小化され、入力をツール側のスキーマ・範囲・宛先で検証する。'],
      ['REQ-012', 'コード実行・ブラウザ・ファイル操作が本番、資格情報、無制限ネットワークから隔離されている。'],
      ['REQ-015', '高影響アクションの承認画面が、具体的な差分・宛先・特権・データ分類・ロールバック条件を示す。'],
      ['REQ-050', 'MCPサーバーが審査済みで、バージョン固定・定義ハッシュ・変更時の再レビューがある。'],
    ],
  },
  {
    title: 'Content / RAG / Memory',
    items: [
      ['REQ-020', 'RAG・ツール・メモリ由来の内容に来歴と信頼レベルがあり、信頼できない内容が上位ポリシーを上書きしない。'],
      ['REQ-021', '取得・記憶した内容にTTLまたは鮮度シグナルがある。'],
      ['REQ-022', '長期メモリへの書き込みがポリシー対象で、来歴付き・取り消し可能になっている。'],
    ],
  },
  {
    title: 'Observe / Stop / Recover',
    items: [
      ['REQ-030', '入力、モデル応答、ツール結果、主体、承認、外部送信を、秘密を伏せて再構築できる。'],
      ['REQ-033', '脅威ファミリーを覆う評価を、出荷前・変更時・定期スケジュールで再実行する。'],
      ['REQ-034', 'ロールバック、状態復元、メモリ汚染からの復旧、資格情報失効を実際に演習している。'],
      ['REQ-042', 'ツール、MCP、外部送信、メモリ書込、RAG、委譲、スケジュールを個別に止められる。'],
    ],
  },
] as const;

export const sampleFindings = [
  { id: 'VT-S-001', req: 'REQ-001', threat: 'TH-05', status: 'FAIL', title: 'Agent identity is distinct from the human' },
  { id: 'VT-S-003B', req: 'REQ-003', threat: 'TH-05', status: 'FAIL', title: 'Agent credential scope is minimized' },
  { id: 'VT-S-051B', req: 'REQ-051', threat: 'TH-06', status: 'FAIL', title: 'Delegate scope is a subset of the parent' },
  { id: 'VT-S-012A-WEB-FETCH', req: 'REQ-012', threat: 'TH-08', status: 'FAIL', title: 'Network tool has an egress allowlist' },
] as const;
