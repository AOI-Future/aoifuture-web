import { describe, expect, it } from 'vitest';
import { kumamotoReliefItems } from '../src/data/kumamoto-relief';

describe('令和8年熊本地震の公式支援情報', () => {
  it('初期カードを3件持つ', () => {
    expect(kumamotoReliefItems).toHaveLength(3);
  });

  it('すべてのカードがHTTPSの公式URLと宛先・用途を持つ', () => {
    const officialUrls = new Set([
      'https://www.pref.kumamoto.jp/soshiki/27/274572.html',
      'https://www.akaihane.or.jp/saigai/2026kumamoto_earthquake/',
      'https://www.fukushi-kumamoto.or.jp/kvc/',
    ]);

    for (const item of kumamotoReliefItems) {
      expect(item.officialUrl).toMatch(/^https:\/\//);
      expect(officialUrls.has(item.officialUrl)).toBe(true);
      expect(item.recipient.trim()).not.toBe('');
      expect(item.purpose.trim()).not.toBe('');
    }
  });

  it('熊本県義援金は配分を断定せず、公式ページ未確認を明記する', () => {
    const item = kumamotoReliefItems.find(({ id }) => id === 'kumamoto-prefecture-relief-fund');

    expect(item?.purpose).toContain('被災された方々を支援するため');
    expect(item?.purpose).not.toContain('配分するため');
    expect(item?.notes).toContain('配分先・配分時期は公式ページで未確認');
    expect(item?.notes).toContain('断定しない');
  });

  it('ボラサポは直接配分ではなく活動助成の原資で、終了日未確認ならpreparingにする', () => {
    const item = kumamotoReliefItems.find(({ id }) => id === 'kumamoto-volasapo-2026');

    expect(item?.notes).toContain('被災者へ直接配分する義援金ではなく');
    expect(item?.notes).toContain('ボランティアグループ・NPO活動への助成原資');
    expect(item?.status).toBe('preparing');
    expect(item?.actionUrl).toBeUndefined();
  });

  it('行動URLはopenカードだけが持つ', () => {
    for (const item of kumamotoReliefItems) {
      if (item.status === 'open') {
        expect(item.actionUrl).toBeDefined();
        expect(item.actionUrl).toMatch(/^https:\/\//);
      } else {
        expect(item.actionUrl).toBeUndefined();
      }
    }
  });

  it('actionUrlはofficialUrlまたは明示した公式URLだけを許可する', () => {
    const allowedActionUrls = new Set([
      'https://www.pref.kumamoto.jp/soshiki/27/274572.html',
      'https://www.akaihane.or.jp/saigai/2026kumamoto_earthquake/',
      'https://www.fukushi-kumamoto.or.jp/kvc/',
    ]);

    for (const item of kumamotoReliefItems) {
      if (item.actionUrl) {
        expect(allowedActionUrls.has(item.actionUrl)).toBe(true);
        expect(item.actionUrl === item.officialUrl || allowedActionUrls.has(item.actionUrl)).toBe(true);
      }
    }
  });

  it('公式URL以外の口座番号や決済情報を保存しない', () => {
    const serialized = JSON.stringify(kumamotoReliefItems);
    expect(serialized).not.toMatch(/\b\d{7,}\b/);
    expect(serialized).not.toMatch(/口座番号|銀行口座|振込先/);
  });
});
