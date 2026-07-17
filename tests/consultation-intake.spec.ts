import { test, expect } from '@playwright/test';
import { analyticsPayload, captureGoogleAnalytics, type CapturedAnalyticsRequest } from './helpers/google-analytics';

async function reachConfirmation(page:any,url='/consulting/intake'){await page.goto(url);await page.getByLabel('特定の仕事の流れを見直したい').check();await page.getByLabel(/いま、仕事の中で何が起きていますか/).fill('毎週の確認作業で担当と完了条件が曖昧になっています。');await page.getByRole('button',{name:'返信先の入力へ'}).click();await page.getByLabel(/返信先のメールアドレス/).fill('test@example.com');await page.getByRole('button',{name:'入力内容を確認する'}).click();}
test('two-step validation and confirmation',async({page})=>{await page.goto('/consulting/intake');await expect(page).toHaveTitle(/仕事の相談を整理する/);await page.getByRole('button',{name:'返信先の入力へ'}).click();await expect(page.getByText(/いちばん近い段階を1つ/)).toBeVisible();await reachConfirmation(page);await expect(page.getByRole('heading',{name:'この内容で相談しますか？'})).toBeVisible();await expect(page.getByText('毎週の確認作業で担当と完了条件が曖昧になっています。')).toBeVisible();});
test('503 retains values and success waits for API',async({page})=>{let attempts=0;await page.route('**/api/consultation-intake',async route=>{attempts++;if(attempts===1)await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'storage_unavailable'})});else await route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({ok:true,receiptId:'AOI-TEST0001',duplicate:false})});});await reachConfirmation(page);await page.getByLabel(/機密情報や認証情報/).check();await page.getByLabel(/プライバシーポリシーに同意/).check();await page.getByRole('button',{name:'この内容で相談を送る'}).click();await expect(page.getByText(/入力内容は残っています/)).toBeVisible();await page.getByRole('button',{name:'入力を修正する'}).click();await expect(page.getByLabel(/いま、仕事の中で何が起きていますか/)).toHaveValue(/毎週の確認作業/);await page.getByRole('button',{name:'返信先の入力へ'}).click();await page.getByRole('button',{name:'入力内容を確認する'}).click();await page.getByRole('button',{name:'この内容で相談を送る'}).click();await expect(page.getByRole('heading',{name:'相談を受け付けました'})).toBeVisible();await expect(page.getByText('AOI-TEST0001')).toBeVisible();});
test('375px has no horizontal overflow',async({page})=>{await page.setViewportSize({width:375,height:800});await page.goto('/consulting/intake');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);});

test('missing campaign attribution is reported as unattributed, never inferred as direct',async({page})=>{await page.addInitScript(()=>localStorage.setItem('cookie-consent','accepted'));await page.goto('/consulting/intake');await page.getByLabel('特定の仕事の流れを見直したい').check();const event=await page.evaluate(()=>(window as any).dataLayer.find((entry:any)=>entry[0]==='event'&&entry[1]==='consultation_intake_start'));expect(event[2].source).toBe('unattributed');expect(JSON.stringify(event)).not.toContain('direct');});

test('replaceState failure is contained and GA still receives only sanitized page context',async({page})=>{const analyticsRequests:CapturedAnalyticsRequest[]=[];const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await page.addInitScript(()=>{localStorage.setItem('cookie-consent','accepted');history.replaceState=()=>{throw new Error('history unavailable');};});await captureGoogleAnalytics(page,analyticsRequests);await page.goto('/consulting/intake?cell_id=cell-history&utm_source=google&gclid=raw-history&email=history%40example.com');await expect(page).toHaveTitle(/仕事の相談を整理する/);expect(await page.evaluate(()=>(window as any).__aoiSafeIntakeAttribution.cellId)).toBe('cell-history');await expect.poll(()=>analyticsRequests.length).toBeGreaterThanOrEqual(1);const captured=analyticsPayload(analyticsRequests[0]);expect(captured.body.get('page_location')).toBe('http://127.0.0.1:4327/consulting/intake');expect(captured.body.get('page_referrer')).toBe('');expect(captured.text).not.toMatch(/raw-history|history%40|history@example|gclid/i);expect(errors).toEqual([]);});

test('accepted analytics is allowlisted with one page-lifetime success attempt after retry',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('cookie-consent','accepted'));
  const payloads:any[]=[];let attempts=0;
  await page.route('**/api/consultation-intake',async route=>{payloads.push(route.request().postDataJSON());attempts++;await route.fulfill({status:attempts===1?503:201,contentType:'application/json',body:JSON.stringify(attempts===1?{error:'storage_unavailable'}:{ok:true,receiptId:'AOI-DURABLE',duplicate:false})});});
  await reachConfirmation(page,'/consulting/intake?cell_id=cell-7&utm_source=google&utm_medium=cpc&utm_campaign=agent_security&utm_content=rsa-1&entry_path=%2Fagent-security%2Fverification-support%2F&offer=sprint&gclid=raw-click&email=private%40example.com');
  await page.getByLabel(/機密情報や認証情報/).check();await page.getByLabel(/プライバシーポリシーに同意/).check();
  await page.getByRole('button',{name:'この内容で相談を送る'}).click();await expect(page.getByText(/入力内容は残っています/)).toBeVisible();
  await page.getByRole('button',{name:'この内容で相談を送る'}).click();await expect(page.getByRole('heading',{name:'相談を受け付けました'})).toBeVisible();
  expect(payloads).toHaveLength(2);expect(payloads[0].attribution).toEqual({cellId:'cell-7',utmSource:'google',utmMedium:'cpc',utmCampaign:'agent_security',utmContent:'rsa-1',entryPath:'/agent-security/verification-support/',offer:'sprint'});expect(payloads[1].attribution).toEqual(payloads[0].attribution);
  const events=await page.evaluate(()=>(window as any).dataLayer.filter((entry:any)=>entry[0]==='event'&&String(entry[1]).startsWith('consultation_intake_')).map((entry:any)=>({name:entry[1],fields:entry[2]})));
  expect(events.map((event:any)=>event.name)).toEqual(['consultation_intake_start','consultation_intake_submit_success']);
  for(const event of events){expect(Object.keys(event.fields).sort()).toEqual(['cell_id','entry_path','offer','source']);expect(JSON.stringify(event)).not.toMatch(/test@example|毎週|AOI-DURABLE|gclid|raw-click|idempotency|receipt|token/i);}
});

test('intake strips the browser query, retains safe durable attribution, and sends sanitized GA requests',async({page})=>{
  const analyticsRequests:CapturedAnalyticsRequest[]=[];let payload:any;
  await page.addInitScript(()=>localStorage.setItem('cookie-consent','accepted'));
  await captureGoogleAnalytics(page,analyticsRequests);
  await page.route('**/api/consultation-intake',async route=>{payload=route.request().postDataJSON();await route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({ok:true,receiptId:'AOI-NETWORK-PRIVATE',duplicate:false})});});
  await page.goto('/privacy?email=referrer-private%40example.com&gclid=referrer-click-id');
  analyticsRequests.length=0;
  await page.evaluate(()=>{window.location.href='/consulting/intake?cell_id=cell-network&utm_source=google&utm_medium=cpc&utm_campaign=agent_security&utm_content=rsa-network&entry_path=%2Fagent-security%2Fverification-support%2F&offer=sprint&gclid=raw-click-id&email=query-private%40example.com&token=secret-token&receipt=AOI-QUERY-SECRET';});
  await expect(page).toHaveURL('http://127.0.0.1:4327/consulting/intake');
  await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content','no-referrer');
  await page.getByLabel('特定の仕事の流れを見直したい').check();await page.getByLabel(/いま、仕事の中で何が起きていますか/).fill('GA通信に個人情報を含めず、相談受付を確認します。');await page.getByRole('button',{name:'返信先の入力へ'}).click();await page.getByLabel(/返信先のメールアドレス/).fill('form-private@example.test');await page.getByRole('button',{name:'入力内容を確認する'}).click();await page.getByLabel(/機密情報や認証情報/).check();await page.getByLabel(/プライバシーポリシーに同意/).check();await page.getByRole('button',{name:'この内容で相談を送る'}).click();await expect(page.getByText('AOI-NETWORK-PRIVATE')).toBeVisible();
  expect(payload.attribution).toEqual({cellId:'cell-network',utmSource:'google',utmMedium:'cpc',utmCampaign:'agent_security',utmContent:'rsa-network',entryPath:'/agent-security/verification-support/',offer:'sprint'});
  await expect.poll(()=>analyticsRequests.length).toBeGreaterThanOrEqual(3);
  for(const request of analyticsRequests){const captured=analyticsPayload(request);expect(captured.body.get('page_location')).toBe('http://127.0.0.1:4327/consulting/intake');expect(captured.body.get('page_referrer')).toBe('');expect(captured.text).not.toMatch(/query-private|referrer-private|form-private|example\.(com|test)|gclid|raw-click-id|referrer-click-id|AOI-(QUERY-SECRET|NETWORK-PRIVATE)|secret-token|receipt|idempotency/i);}
});

test('rejected analytics does not block form or durable attribution',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('cookie-consent','rejected'));let payload:any;
  await page.route('**/api/consultation-intake',async route=>{payload=route.request().postDataJSON();await route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({ok:true,receiptId:'AOI-REJECTED',duplicate:false})});});
  await reachConfirmation(page,'/consulting/intake?cell_id=cell-9&utm_source=google&entry_path=%2Fagent-security%2Fverification-support%2F&offer=fail_review');
  await expect(page).toHaveURL('http://127.0.0.1:4327/consulting/intake');
  await page.getByLabel(/機密情報や認証情報/).check();await page.getByLabel(/プライバシーポリシーに同意/).check();await page.getByRole('button',{name:'この内容で相談を送る'}).click();
  await expect(page.getByText('AOI-REJECTED')).toBeVisible();expect(payload.attribution).toMatchObject({cellId:'cell-9',utmSource:'google',entryPath:'/agent-security/verification-support/',offer:'fail_review'});
  expect(await page.evaluate(()=>(window as any).dataLayer.filter((entry:any)=>entry[0]==='event'&&String(entry[1]).startsWith('consultation_intake_')).length)).toBe(0);
});

test('throwing analytics is consumed once and cannot replace durable success with an error',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('cookie-consent','accepted'));
  await page.route('**/api/consultation-intake',async route=>route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({ok:true,receiptId:'AOI-DURABLE-QA',duplicate:false})}));
  await page.goto('/consulting/intake');
  await page.evaluate(()=>{
    (window as any).__analyticsAttempts=[];
    (window as any).gtag=(command:string,name:string)=>{
      if(command==='event') (window as any).__analyticsAttempts.push(name);
      throw new Error('analytics unavailable');
    };
  });
  await page.getByLabel('特定の仕事の流れを見直したい').check();
  await page.getByLabel(/いま、仕事の中で何が起きていますか/).fill('毎週の確認作業で担当と完了条件が曖昧になっています。');
  await page.getByLabel(/いま、仕事の中で何が起きていますか/).fill('分析障害があっても相談内容は送信できます。');
  await page.getByRole('button',{name:'返信先の入力へ'}).click();
  await page.getByLabel(/返信先のメールアドレス/).fill('test@example.com');
  await page.getByRole('button',{name:'入力内容を確認する'}).click();
  await page.getByLabel(/機密情報や認証情報/).check();
  await page.getByLabel(/プライバシーポリシーに同意/).check();
  await page.getByRole('button',{name:'この内容で相談を送る'}).click();
  await expect(page.getByRole('heading',{name:'相談を受け付けました'})).toBeVisible();
  await expect(page.locator('[data-submit-error]')).toBeHidden();
  await expect(page.getByText('AOI-DURABLE-QA')).toBeVisible();
  expect(await page.evaluate(()=>(window as any).__analyticsAttempts)).toEqual(['consultation_intake_start','consultation_intake_submit_success']);
});
