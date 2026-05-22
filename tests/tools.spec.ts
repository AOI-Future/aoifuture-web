import { expect, test, type Page } from '@playwright/test';

const tools = [
  'url-extractor', 'char-counter', 'json-formatter', 'markdown-preview', 'slug-generator',
  'base64', 'color-converter', 'contrast-checker', 'gradient-generator', 'color-palette',
  'box-shadow-generator', 'px-converter', 'aspect-ratio', 'typography-scale', 'image-resizer',
  'svg-cleaner', 'qr-generator', 'timestamp-converter', 'uuid-generator', 'regex-tester',
  'lorem-ipsum', 'bezier-editor', 'emoji-search', 'text-diff', 'dummy-data',
  'border-radius-generator', 'image-color-picker', 'password-generator', 'typography-preview',
  'css-animation-preview', 'jwt-decoder',
];

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR42mP8z8Dwn4GBgYGJAQoAAD62BAQRtDaRAAAAAElFTkSuQmCC',
  'base64',
);

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', err => errors.push(`pageerror: ${err.message}`));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  return errors;
}

async function openTool(page: Page, slug: string) {
  const errors = collectErrors(page);
  await page.goto(`/tools/${slug}`);
  await expect(page.locator('main h1').first()).toBeVisible();
  return errors;
}

async function setRange(page: Page, selector: string, value: string) {
  await page.locator(selector).evaluate((el, nextValue) => {
    const input = el as HTMLInputElement;
    input.value = String(nextValue);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

test.describe('AOI tools catalogue', () => {
  for (const slug of tools) {
    test(`${slug} loads without browser errors`, async ({ page }) => {
      const errors = await openTool(page, slug);
      await page.waitForTimeout(100);
      expect(errors).toEqual([]);
    });
  }
});

test.describe('AOI tools core behavior', () => {
  test('url extractor extracts http and https URLs', async ({ page }) => {
    const errors = await openTool(page, 'url-extractor');
    await page.locator('#input').fill('A https://aoifuture.com/path and http://example.test?q=1');
    await page.locator('#extract-btn').click();
    await expect(page.locator('#count')).toContainText('2');
    await expect(page.locator('#output')).toHaveValue(/https:\/\/aoifuture\.com\/path/);
    expect(errors).toEqual([]);
  });

  test('char counter updates counts', async ({ page }) => {
    const errors = await openTool(page, 'char-counter');
    await page.locator('#input-text').fill('hello world\nAOI');
    await expect(page.locator('#chars-all')).toHaveText('15');
    await expect(page.locator('#words')).toHaveText('3');
    await expect(page.locator('#lines')).toHaveText('2');
    expect(errors).toEqual([]);
  });

  test('json formatter formats and minifies JSON', async ({ page }) => {
    const errors = await openTool(page, 'json-formatter');
    await page.locator('#json-input').fill('{"a":1,"b":[2]}');
    await page.locator('#format-btn').click();
    await expect(page.locator('#json-output')).toHaveValue(/\n  "a": 1/);
    await page.locator('#minify-btn').click();
    await expect(page.locator('#json-output')).toHaveValue('{"a":1,"b":[2]}');
    expect(errors).toEqual([]);
  });

  test('markdown preview renders markdown and sanitizes scripts', async ({ page }) => {
    const errors = await openTool(page, 'markdown-preview');
    await page.locator('#md-input').fill('# Title\n\n<script>alert(1)</script>\n\n**bold**');
    await expect(page.locator('#md-preview h1')).toHaveText('Title');
    await expect(page.locator('#md-preview strong')).toHaveText('bold');
    await expect(page.locator('#md-preview script')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('slug generator creates URL-safe slugs', async ({ page }) => {
    const errors = await openTool(page, 'slug-generator');
    await page.locator('#slug-input').fill('Hello, AOI Future!');
    await expect(page.locator('#slug-output')).toHaveValue('hello-aoi-future');
    expect(errors).toEqual([]);
  });

  test('base64 encodes and decodes unicode text', async ({ page }) => {
    const errors = await openTool(page, 'base64');
    await page.locator('#b64-input').fill('AOI 未来');
    await page.locator('#encode-btn').click();
    const encoded = await page.locator('#b64-output').inputValue();
    expect(encoded.length).toBeGreaterThan(0);
    await page.locator('#b64-input').fill(encoded);
    await page.locator('#decode-btn').click();
    await expect(page.locator('#b64-output')).toHaveValue('AOI 未来');
    expect(errors).toEqual([]);
  });

  test('color converter converts hex to rgb and hsl', async ({ page }) => {
    const errors = await openTool(page, 'color-converter');
    await page.locator('#hex-input').fill('#ff0000');
    await expect(page.locator('#rgb-input')).toHaveValue('255, 0, 0');
    await expect(page.locator('#hsl-input')).toHaveValue('0, 100%, 50%');
    expect(errors).toEqual([]);
  });

  test('contrast checker calculates WCAG ratio', async ({ page }) => {
    const errors = await openTool(page, 'contrast-checker');
    await page.locator('#fg-hex').fill('#000000');
    await page.locator('#bg-hex').fill('#ffffff');
    await expect(page.locator('#ratio')).toContainText('21');
    await expect(page.locator('#aa-normal')).toContainText('PASS');
    expect(errors).toEqual([]);
  });

  test('gradient generator updates CSS output', async ({ page }) => {
    const errors = await openTool(page, 'gradient-generator');
    await page.locator('#angle-input').fill('45');
    await expect(page.locator('#css-output')).toHaveValue(/linear-gradient\(45deg/);
    await page.locator('#add-stop-btn').click();
    await expect(page.locator('#stops-list .stop-color')).toHaveCount(3);
    expect(errors).toEqual([]);
  });

  test('color palette extracts colors from uploaded image', async ({ page }) => {
    const errors = await openTool(page, 'color-palette');
    await page.locator('#file-input').setInputFiles({ name: 'tiny.png', mimeType: 'image/png', buffer: tinyPng });
    await expect(page.locator('#palette-container')).toBeVisible();
    await expect(page.locator('#palette-grid > div').first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('box shadow generator updates CSS output', async ({ page }) => {
    const errors = await openTool(page, 'box-shadow-generator');
    await setRange(page, '#x-offset', '12');
    await setRange(page, '#blur', '24');
    await expect(page.locator('#css-output')).toHaveValue(/box-shadow: 12px .* 24px/);
    expect(errors).toEqual([]);
  });

  test('px converter converts px to rem em and pt', async ({ page }) => {
    const errors = await openTool(page, 'px-converter');
    await page.locator('#input-px').fill('32');
    await expect(page.locator('#input-rem')).toHaveValue('2.0000');
    await expect(page.locator('#input-pt')).toHaveValue('24.0000');
    expect(errors).toEqual([]);
  });

  test('aspect ratio calculator fills missing dimension', async ({ page }) => {
    const errors = await openTool(page, 'aspect-ratio');
    await page.locator('#input-width').fill('1920');
    await page.locator('#input-ratio').fill('16:9');
    await page.locator('#calc-btn').click();
    await expect(page.locator('#input-height')).toHaveValue('1080');
    await expect(page.locator('#result-text')).toContainText('1920 × 1080');
    expect(errors).toEqual([]);
  });

  test('typography scale generates modular scale rows', async ({ page }) => {
    const errors = await openTool(page, 'typography-scale');
    await page.locator('#base-size').fill('18');
    await expect(page.locator('#scale-table tr')).toHaveCount(12);
    await expect(page.locator('#scale-table')).toContainText('18.0');
    expect(errors).toEqual([]);
  });

  test('image resizer reads image dimensions', async ({ page }) => {
    const errors = await openTool(page, 'image-resizer');
    await page.locator('#file-input').setInputFiles({ name: 'tiny.png', mimeType: 'image/png', buffer: tinyPng });
    await expect(page.locator('#resize-settings')).toBeVisible();
    await expect(page.locator('#out-width')).toHaveValue('2');
    await page.locator('#out-width').fill('4');
    await expect(page.locator('#out-height')).toHaveValue('4');
    expect(errors).toEqual([]);
  });

  test('svg cleaner removes unsafe and noisy attributes', async ({ page }) => {
    const errors = await openTool(page, 'svg-cleaner');
    await page.locator('#svg-input').fill('<svg width="10" height="10"><rect onclick="x" fill="#fff"/></svg>');
    await page.locator('#clean-btn').click();
    await expect(page.locator('#svg-output')).toHaveValue(/<svg/);
    await expect(page.locator('#svg-output')).not.toHaveValue(/onclick/);
    expect(errors).toEqual([]);
  });

  test('qr generator renders a canvas', async ({ page }) => {
    const errors = await openTool(page, 'qr-generator');
    await page.locator('#qr-text').fill('https://aoifuture.com');
    await page.locator('#generate-btn').click();
    await expect(page.locator('#qr-container')).toBeVisible();
    await expect(page.locator('#qr-output canvas')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('timestamp converter converts unix seconds and date input', async ({ page }) => {
    const errors = await openTool(page, 'timestamp-converter');
    await page.locator('#ts-input').fill('0');
    await page.locator('#convert-btn').click();
    await expect(page.locator('#res-iso')).toContainText('1970-01-01T00:00:00.000Z');
    await page.locator('#date-input').fill('2026-05-23T00:00');
    await page.locator('#date-convert-btn').click();
    await expect(page.locator('#date-result')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('uuid generator creates requested UUID count', async ({ page }) => {
    const errors = await openTool(page, 'uuid-generator');
    await page.locator('#uuid-count').fill('3');
    await page.locator('#generate-btn').click();
    await expect(page.locator('.uuid-item')).toHaveCount(3);
    await expect(page.locator('#uuid-output')).toHaveValue(/[0-9a-f-]{36}/);
    expect(errors).toEqual([]);
  });

  test('regex tester highlights matches and reports groups', async ({ page }) => {
    const errors = await openTool(page, 'regex-tester');
    await page.locator('#pattern').fill('(AOI)');
    await page.locator('#test-string').fill('AOI Future AOI');
    await expect(page.locator('#match-count')).toContainText('2 matches');
    await expect(page.locator('#highlight-output mark')).toHaveCount(2);
    expect(errors).toEqual([]);
  });

  test('lorem ipsum generates Japanese sentences', async ({ page }) => {
    const errors = await openTool(page, 'lorem-ipsum');
    await page.locator('#lang-ja').check();
    await page.locator('#lorem-count').fill('2');
    await page.locator('#generate-btn').click();
    const value = await page.locator('#lorem-output').inputValue();
    expect(value.length).toBeGreaterThan(10);
    expect(errors).toEqual([]);
  });

  test('bezier editor updates CSS from numeric controls', async ({ page }) => {
    const errors = await openTool(page, 'bezier-editor');
    await page.locator('#x1').fill('0.3');
    await expect(page.locator('#css-output')).toHaveValue(/cubic-bezier\(0.3/);
    expect(errors).toEqual([]);
  });

  test('emoji search filters emoji results', async ({ page }) => {
    const errors = await openTool(page, 'emoji-search');
    await expect(page.locator('#emoji-grid button').first()).toBeVisible();
    await page.locator('#emoji-search').fill('rocket');
    await expect(page.locator('#emoji-grid')).toContainText('🚀');
    expect(errors).toEqual([]);
  });

  test('text diff reports additions and deletions', async ({ page }) => {
    const errors = await openTool(page, 'text-diff');
    await page.locator('#diff-original').fill('a\nb\nc');
    await page.locator('#diff-modified').fill('a\nB\nc\nd');
    await page.locator('#compare-btn').click();
    await expect(page.locator('#diff-stats')).toContainText('+2行 追加, -1行 削除');
    await expect(page.locator('#diff-output')).toContainText('+');
    expect(errors).toEqual([]);
  });

  test('dummy data generates table rows and JSON data', async ({ page }) => {
    const errors = await openTool(page, 'dummy-data');
    await page.locator('#count').fill('4');
    await page.locator('#gen-btn').click();
    await expect(page.locator('#tbody tr')).toHaveCount(4);
    await expect(page.locator('#table-wrap')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('border radius generator updates all corners', async ({ page }) => {
    const errors = await openTool(page, 'border-radius-generator');
    await setRange(page, '#master', '25');
    await expect(page.locator('#css-output')).toHaveValue('border-radius: 25% 25% 25% 25%');
    await page.locator('#unit-px').click();
    await expect(page.locator('#css-output')).toHaveValue('border-radius: 25px 25px 25px 25px');
    expect(errors).toEqual([]);
  });

  test('image color picker samples uploaded pixels', async ({ page }) => {
    const errors = await openTool(page, 'image-color-picker');
    await page.locator('#file-input').setInputFiles({ name: 'tiny.png', mimeType: 'image/png', buffer: tinyPng });
    await expect(page.locator('#canvas-wrap')).toBeVisible();
    const box = await page.locator('#canvas').boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + 1, box!.y + 1);
    await expect(page.locator('#live-info')).toBeVisible();
    await page.mouse.click(box!.x + 1, box!.y + 1);
    await expect(page.locator('#history-section')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('password generator creates secure random passwords', async ({ page }) => {
    const errors = await openTool(page, 'password-generator');
    await page.locator('#count').fill('3');
    await setRange(page, '#length', '20');
    await page.locator('#gen-btn').click();
    await expect(page.locator('[data-pwd]')).toHaveCount(3);
    const first = (await page.locator('[data-pwd]').first().textContent()) ?? '';
    expect(first.length).toBe(20);
    expect(errors).toEqual([]);
  });

  test('typography preview updates CSS without injecting HTML', async ({ page }) => {
    const errors = await openTool(page, 'typography-preview');
    await page.locator('#preview-text').fill('<img src=x onerror=alert(1)>\nAOI');
    await setRange(page, '#font-size', '40');
    await expect(page.locator('#css-output')).toHaveValue(/font-size: 40px/);
    await expect(page.locator('#preview img')).toHaveCount(0);
    await expect(page.locator('#preview')).toContainText('<img src=x onerror=alert(1)>');
    expect(errors).toEqual([]);
  });

  test('css animation preview updates generated CSS', async ({ page }) => {
    const errors = await openTool(page, 'css-animation-preview');
    await setRange(page, '#duration', '1200');
    await page.locator('#property').selectOption('opacity');
    await expect(page.locator('#css-output')).toHaveValue(/transition: opacity 1\.2s/);
    await page.locator('#play-btn').click();
    await expect(page.locator('#ball')).toBeVisible();
    expect(errors).toEqual([]);
  });


  test('jwt decoder decodes sample token and time claims', async ({ page }) => {
    const errors = await openTool(page, 'jwt-decoder');
    await page.locator('#sample-btn').click();
    await expect(page.locator('#result')).toBeVisible();
    await expect(page.locator('#header-output')).toHaveValue(/"alg": "HS256"/);
    await expect(page.locator('#payload-output')).toHaveValue(/"name": "AOI Future"/);
    await expect(page.locator('#exp')).toContainText('2026-05-24T');
    expect(errors).toEqual([]);
  });
});
