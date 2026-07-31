import { describe, expect, it } from 'vitest';
import { kumamotoReliefItems } from '../src/data/kumamoto-relief';

describe('令和8年熊本地震の公式支援情報', () => {
  it('4件の支援カードを持つ', () => {
    expect(kumamotoReliefItems).toHaveLength(4);
  });

  it('各カードの根拠URLは対応する公式ページである', () => {
    expect(kumamotoReliefItems.map(({ id, sourceUrl }) => ({ id, sourceUrl }))).toEqual([
      { id: 'kumamoto-prefecture-relief-fund', sourceUrl: 'https://www.pref.kumamoto.jp/soshiki/27/274572.html' },
      { id: 'kumamoto-volasapo-2026', sourceUrl: 'https://www.akaihane.or.jp/saigai-news/vorasapo/49434/' },
      { id: 'kumamoto-disaster-volunteer-information', sourceUrl: 'https://www.fukushi-kumamoto.or.jp/kvc/' },
      { id: 'nippon-foundation-kumamoto-2026', sourceUrl: 'https://en.nippon-foundation.or.jp/news/articles/2026/20260731-113468.html' },
    ]);
  });

  it('各カードが支援の届き方による表示分類を持つ', () => {
    expect(kumamotoReliefItems.map(({ id, supportCategory }) => ({ id, supportCategory }))).toEqual([
      { id: 'kumamoto-prefecture-relief-fund', supportCategory: '被災された方への義援金' },
      { id: 'kumamoto-volasapo-2026', supportCategory: '現地で活動する団体への支援金' },
      { id: 'kumamoto-disaster-volunteer-information', supportCategory: '公式情報の確認入口' },
      { id: 'nippon-foundation-kumamoto-2026', supportCategory: '現地で活動する団体への支援金' },
    ]);
  });

  it('日本財団支援金は被災者への直接義援金と混同せず、用途と留保を明記する', () => {
    const item = kumamotoReliefItems.find(({ id }) => id === 'nippon-foundation-kumamoto-2026');

    expect(item?.name).toContain('日本財団');
    expect(item?.name).toContain('令和8年熊本地震');
    expect(item?.kind).toBe('activity-support');
    expect(item?.status).toBe('open');
    expect(item?.recipient).toContain('NGO');
    expect(item?.recipient).toContain('ボランティア');
    expect(item?.recipient).not.toContain('被災された方々');
    expect(item?.purpose).toContain('現地救援活動');
    expect(item?.notes).toContain('管理費には使わない');
    expect(item?.notes).toContain('将来災害');
    expect(item?.notes).toContain('使い切れない');
    expect(item?.officialUrl).toBe('https://www.nippon-foundation.or.jp/donation/disaster_fund');
    expect(item?.actionUrl).toBe(item?.officialUrl);
    expect(item?.sourceUpdatedAt).toBe('2026-07-31');
    expect(item?.checkedAtJst).toBe('2026-07-31T12:52:41+09:00');
  });

  it('すべてのカードがHTTPSの公式URLと宛先・用途を持つ', () => {
    for (const item of kumamotoReliefItems) {
      expect(item.officialUrl).toMatch(/^https:\/\//);
      expect(item.sourceUrl).toMatch(/^https:\/\//);
      expect(item.recipient.trim()).not.toBe('');
      expect(item.purpose.trim()).not.toBe('');
    }
  });

  it('熊本県義援金は配分を断定せず、公式ページ未確認を明記する', () => {
    const item = kumamotoReliefItems.find(({ id }) => id === 'kumamoto-prefecture-relief-fund');

    expect(item?.purpose).toContain('被災された方々を支援するため');
    expect(item?.notes).toContain('被災者への支援を目的とする義援金');
    expect(item?.purpose).not.toContain('配分するため');
    expect(item?.notes).toContain('配分先・配分時期は公式ページで未確認');
    expect(item?.notes).toContain('断定しない');
  });

  it('分類表示に根拠のない比較・順位づけを含めない', () => {
    const serialized = JSON.stringify(kumamotoReliefItems);
    expect(serialized).not.toMatch(/中間マージン|手数料|最も届く|一番効果|効率順位|直接性の順位/);
  });

  it('ボラサポは直接配分ではなく活動助成の原資で、公式告知の寄付受付開始をopenとして示す', () => {
    const item = kumamotoReliefItems.find(({ id }) => id === 'kumamoto-volasapo-2026');

    expect(item?.notes).toContain('被災者へ直接配分する義援金ではなく');
    expect(item?.notes).toContain('ボランティアグループ・NPO活動への助成原資');
    expect(item?.status).toBe('open');
    expect(item?.actionLabel).toBe('寄付受付を公式に確認する');
    expect(item?.officialUrl).toBe('https://www.akaihane.or.jp/saigai-news/vorasapo/49434/');
    expect(item?.actionUrl).toBe(item?.officialUrl);
    expect(item?.sourceUrl).toBe(item?.officialUrl);
    expect(item?.sourceUpdatedAt).toBe('2026-07-29');
    expect(item?.checkedAtJst).toBe('2026-07-31T19:52:00+09:00');
    expect(item?.notes).not.toContain('受付状況は未確認');
    expect(item?.notes).not.toContain('終了日や対象となる活動、受付状況は公式ページで未確認');
    expect(item?.notes).not.toMatch(/終了日.*\d{4}年|\d{4}年\d+月\d+日まで/);
  });

  it('openは公式URLと同じactionUrlを必須とし、non-openはCTA用actionUrlを持たない', () => {
    for (const item of kumamotoReliefItems) {
      if (item.status === 'open') {
        expect(item.actionUrl).toBeDefined();
        expect(item.actionUrl).toMatch(/^https:\/\//);
        expect(item.actionUrl).toBe(item.officialUrl);
      } else {
        expect(item).not.toHaveProperty('actionUrl');
      }
    }
  });

  it('ボラサポは公式告知日を表示し、受付期間・終了日を断定しない', () => {
    const item = kumamotoReliefItems.find(({ id }) => id === 'kumamoto-volasapo-2026');

    expect(item?.sourceUpdatedAt).toBe('2026-07-29');
    expect(item?.checkedAtJst).toBe('2026-07-31T19:52:00+09:00');
    expect(item?.status).toBe('open');
    expect(item?.actionUrl).toBe(item?.officialUrl);
    expect(item?.notes).not.toMatch(/終了日.*(?:未確認|\d{4}年\d+月\d+日まで)/);
  });

  it('すべてのcheckedAtJstは監査用のISO JST datetime形式である', () => {
    for (const item of kumamotoReliefItems) {
      expect(item.checkedAtJst).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/);
    }
  });

  it('公式URL以外の口座番号や決済情報を保存しない', () => {
    const serialized = JSON.stringify(kumamotoReliefItems).replace(/https?:\/\/[^"']+/g, '');
    expect(serialized).not.toMatch(/\b\d{7,}\b/);
    expect(serialized).not.toMatch(/口座番号|銀行口座|振込先/);
  });
});
