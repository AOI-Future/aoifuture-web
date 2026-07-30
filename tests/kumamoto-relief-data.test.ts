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

  it('行動URLはopenカードだけが持つ', () => {
    for (const item of kumamotoReliefItems) {
      if (item.status === 'open') {
        expect(item.actionUrl).toMatch(/^https:\/\//);
      } else {
        expect(item.actionUrl).toBeUndefined();
      }
    }
  });

  it('公式URL以外の口座番号や決済情報を保存しない', () => {
    const serialized = JSON.stringify(kumamotoReliefItems);
    expect(serialized).not.toMatch(/\b\d{7,}\b/);
    expect(serialized).not.toMatch(/口座番号|銀行口座|振込先/);
  });
});
