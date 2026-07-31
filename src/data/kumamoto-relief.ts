export type KumamotoReliefStatus = 'open' | 'preparing' | 'information';
export type KumamotoReliefKind = 'donation' | 'activity-support' | 'information';
export type KumamotoReliefSourceUpdatedAt = `${number}-${number}-${number}` | 'not-published';
export type KumamotoReliefCheckedAtJst = `${number}-${number}-${number}T${number}:${number}:${number}+09:00`;

type KumamotoReliefBase = {
  id: string;
  name: string;
  kind: KumamotoReliefKind;
  supportCategory: '被災された方への義援金' | '現地で活動する団体への支援金' | '公式情報の確認入口';
  recipient: string;
  purpose: string;
  actionLabel: string;
  officialUrl: `https://${string}`;
  sourceUrl: `https://${string}`;
  sourceUpdatedAt: KumamotoReliefSourceUpdatedAt;
  checkedAtJst: KumamotoReliefCheckedAtJst;
  notes: string;
};

type OpenKumamotoReliefItem = KumamotoReliefBase & {
  status: 'open';
  actionUrl: `https://${string}`;
};

type NonOpenKumamotoReliefItem = KumamotoReliefBase & {
  status: 'preparing' | 'information';
  actionUrl?: never;
};

export type KumamotoReliefItem = OpenKumamotoReliefItem | NonOpenKumamotoReliefItem;

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
    supportCategory: '被災された方への義援金',
    recipient: '令和8年熊本地震で被災された方々',
    purpose: '被災された方々を支援するため',
    actionLabel: '熊本県の公式ページで確認する',
    officialUrl: 'https://www.pref.kumamoto.jp/soshiki/27/274572.html',
    actionUrl: 'https://www.pref.kumamoto.jp/soshiki/27/274572.html',
    sourceUrl: 'https://www.pref.kumamoto.jp/soshiki/27/274572.html',
    sourceUpdatedAt: '2026-07-29',
    checkedAtJst: '2026-07-31T08:00:00+09:00',
    status: 'open',
    notes: '被災者への支援を目的とする義援金です。受付期間は2026年7月29日から10月30日まで。配分先・配分時期は公式ページで未確認であり、断定しない。受付条件や方法は、必ず公式ページで確認してください。',
  },
  {
    id: 'kumamoto-volasapo-2026',
    name: 'ボラサポ・令和8年熊本地震',
    kind: 'activity-support',
    supportCategory: '現地で活動する団体への支援金',
    recipient: '被災地の災害ボランティアセンター等と連携するボランティアグループ・NPO',
    purpose: '被災地で活動するボランティアグループ・NPOの活動を支えるため',
    actionLabel: '寄付受付を公式に確認する',
    officialUrl: 'https://www.akaihane.or.jp/saigai-news/vorasapo/49434/',
    actionUrl: 'https://www.akaihane.or.jp/saigai-news/vorasapo/49434/',
    sourceUrl: 'https://www.akaihane.or.jp/saigai-news/vorasapo/49434/',
    sourceUpdatedAt: '2026-07-29',
    checkedAtJst: '2026-07-31T19:52:00+09:00',
    status: 'open',
    notes: '被災者へ直接配分する義援金ではなく、ボランティアグループ・NPO活動への助成原資です。受付期間・終了日や対象となる活動の詳細は、中央共同募金会の公式告知で確認してください。',
  },
  {
    id: 'kumamoto-disaster-volunteer-information',
    name: '熊本県災害ボランティア情報',
    kind: 'information',
    supportCategory: '公式情報の確認入口',
    recipient: '熊本県内で支援を必要とする地域と、支援を検討する人',
    purpose: '物資支援、活動支援金、災害ボランティア募集状況を公式情報で確認するため',
    actionLabel: '公式の最新情報を確認する',
    officialUrl: 'https://www.fukushi-kumamoto.or.jp/kvc/',
    sourceUrl: 'https://www.fukushi-kumamoto.or.jp/kvc/',
    sourceUpdatedAt: '2026-07-31',
    checkedAtJst: '2026-07-31T08:00:00+09:00',
    status: 'information',
    notes: 'このカードは公式確認入口です。物資やボランティアを募集中だと断定せず、募集条件や変更を公式ページで確認してください。',
  },
  {
    id: 'nippon-foundation-kumamoto-2026',
    name: '日本財団｜令和8年熊本地震 支援金',
    kind: 'activity-support',
    supportCategory: '現地で活動する団体への支援金',
    recipient: '被災地域で現地救援活動を行うNGO・ボランティア等',
    purpose: '2026年7月28日熊本地震の被災地域で、NGO・ボランティア等が行う現地救援活動を支えるため',
    actionLabel: '日本財団の基金ページで確認して支援する',
    officialUrl: 'https://www.nippon-foundation.or.jp/donation/disaster_fund',
    actionUrl: 'https://www.nippon-foundation.or.jp/donation/disaster_fund',
    sourceUrl: 'https://en.nippon-foundation.or.jp/news/articles/2026/20260731-113468.html',
    sourceUpdatedAt: '2026-07-31',
    checkedAtJst: '2026-07-31T12:52:41+09:00',
    status: 'open',
    notes: '寄付全額を現地救援活動に用い、日本財団の管理費には使わないと公式発表されています。ただし、被害規模や救援状況により使い切れない寄付は、将来災害の被災地で迅速な救援活動に基金から使う可能性があります。被災者へ直接配分する義援金ではなく、救援活動を支える支援金です。',
  },
] as const;
