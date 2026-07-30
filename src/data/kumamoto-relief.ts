export type KumamotoReliefStatus = 'open' | 'preparing' | 'information';
export type KumamotoReliefKind = 'donation' | 'activity-support' | 'information';

export interface KumamotoReliefItem {
  id: string;
  name: string;
  kind: KumamotoReliefKind;
  recipient: string;
  purpose: string;
  actionLabel: string;
  officialUrl: `https://${string}`;
  actionUrl?: `https://${string}`;
  sourceUpdatedAt: string;
  checkedAtJst: string;
  status: KumamotoReliefStatus;
  notes: string;
}

/**
 * 令和8年熊本地震に関する、一次情報で確認した支援先・確認入口。
 *
 * 金銭の受け取りや口座情報の転載は行わず、行動先は公式ページへ戻す。
 */
export const kumamotoReliefItems: readonly KumamotoReliefItem[] = [
  {
    id: 'kumamoto-prefecture-relief-fund',
    name: '熊本県義援金',
    kind: 'donation',
    recipient: '令和8年熊本地震で被災された方々',
    purpose: '集められた義援金を、被災された方々へ配分するため',
    actionLabel: '熊本県の公式ページで確認する',
    officialUrl: 'https://www.pref.kumamoto.jp/soshiki/27/274572.html',
    actionUrl: 'https://www.pref.kumamoto.jp/soshiki/27/274572.html',
    sourceUpdatedAt: '2026-07-29',
    checkedAtJst: '2026-07-31',
    status: 'open',
    notes: '受付期間は2026年7月29日から10月30日まで。受付条件や方法は、必ず公式ページで確認してください。',
  },
  {
    id: 'kumamoto-volasapo-2026',
    name: 'ボラサポ・令和8年熊本地震',
    kind: 'activity-support',
    recipient: '被災地の災害ボランティアセンター等と連携するボランティアグループ・NPO',
    purpose: '被災地で活動するボランティアグループ・NPOの活動を支えるため',
    actionLabel: '中央共同募金会の公式ページで確認する',
    officialUrl: 'https://www.akaihane.or.jp/saigai/2026kumamoto_earthquake/',
    actionUrl: 'https://www.akaihane.or.jp/saigai/2026kumamoto_earthquake/',
    sourceUpdatedAt: '2026-07-31',
    checkedAtJst: '2026-07-31',
    status: 'open',
    notes: '対象となる活動や受付状況は変更されることがあるため、中央共同募金会の公式ページで確認してください。',
  },
  {
    id: 'kumamoto-disaster-volunteer-information',
    name: '熊本県災害ボランティア情報',
    kind: 'information',
    recipient: '熊本県内で支援を必要とする地域と、支援を検討する人',
    purpose: '物資支援、活動支援金、災害ボランティア募集状況を公式情報で確認するため',
    actionLabel: '公式の最新情報を確認する',
    officialUrl: 'https://www.fukushi-kumamoto.or.jp/kvc/',
    sourceUpdatedAt: '2026-07-31',
    checkedAtJst: '2026-07-31',
    status: 'information',
    notes: 'このカードは公式確認入口です。物資やボランティアを募集中だと断定せず、募集条件や変更を公式ページで確認してください。',
  },
] as const;
