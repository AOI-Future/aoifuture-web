const root = document.querySelector<HTMLElement>('[data-intake]');
const form = document.querySelector<HTMLFormElement>('#intake-form');
if (!root || !form) throw new Error('intake_form_missing');
const startedAt = Date.now();
let idempotencyKey = crypto.randomUUID();
let submissionAttempted = false;
const resetIdempotencyAfterEdit = () => {
  if (submissionAttempted) {
    idempotencyKey = crypto.randomUUID();
    submissionAttempted = false;
  }
};
form.addEventListener('input', resetIdempotencyAfterEdit);
form.addEventListener('change', resetIdempotencyAfterEdit);
const panels = [...document.querySelectorAll<HTMLElement>('[data-panel]')];
const show = (name: string) => { panels.forEach(p => p.hidden = p.dataset.panel !== name); window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); document.querySelector<HTMLElement>(`[data-panel="${name}"] h1`)?.focus({ preventScroll: true }); };
const value = (name: string) => (new FormData(form).get(name)?.toString() || '').trim();
const setError = (name: string, message = '') => { const el = document.querySelector<HTMLElement>(`[data-error="${name}"]`); if (el) { el.textContent = message; el.hidden = !message; } };
const failFocus = (name: string) => { const input = form.elements.namedItem(name); (input instanceof RadioNodeList ? document.querySelector<HTMLElement>(`[name="${name}"]`) : input as HTMLElement)?.focus(); };
function validateStep1() { let first = ''; setError('stage'); setError('situation'); if (!value('stage')) { setError('stage', '入力を確認してください：いちばん近い段階を1つ選んでください。迷う場合は「まだ言葉にできない」を選べます。'); first ||= 'stage'; } if (!value('situation')) { setError('situation', '入力を確認してください：いま起きていることを、短くてもよいので入力してください。'); first ||= 'situation'; } const advice = document.querySelector<HTMLElement>('[data-advice="situation"]'); if (advice) advice.textContent = value('situation').length > 0 && value('situation').length < 40 ? 'もう少し書けそうなら、「どの仕事で」「どこに困るか」を加えると返信しやすくなります。' : ''; if (first) failFocus(first); return !first; }
function validateStep2() { setError('email'); const email = value('email'); if (!email) { setError('email', '入力を確認してください：返信先のメールアドレスを入力してください。'); failFocus('email'); return false; } if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('email', '入力を確認してください：メールアドレスの形式を確認してください。'); failFocus('email'); return false; } return true; }
document.querySelector('[data-next]')?.addEventListener('click', () => { if (validateStep1()) show('2'); });
document.querySelectorAll<HTMLElement>('[data-back],[data-edit]').forEach(button => button.addEventListener('click', () => show(button.dataset.back || button.dataset.edit || '1')));
const labels: Record<string,string> = { deciding_where_to_start:'何から始めるか決めたい', trial_not_adopted:'AIやツールを試したが、仕事に定着していない', workflow_review:'特定の仕事の流れを見直したい', moving_to_operation:'すでにある自動化やAIエージェントを、実運用に近づけたい', aligning_team_decisions:'チーム内の役割や判断基準を揃えたい', unclear_or_other:'まだ言葉にできない / どれとも違う' };
const renderReview = () => { const render = (selector:string, rows:Array<[string,string]>) => { const dl=document.querySelector(selector); if (!dl) return; dl.replaceChildren(...rows.filter(([,v])=>v).flatMap(([k,v])=>{ const dt=document.createElement('dt');dt.textContent=k;const dd=document.createElement('dd');dd.textContent=v;return [dt,dd]; })); }; render('[data-review="work"]', [['現在地',labels[value('stage')]||''],['いま起きていること',value('situation')],['持ち帰りたいこと',value('desiredTakeaway')]]); render('[data-review="contact"]',[['お名前',value('displayName')],['メールアドレス',value('email')],['会社名・チーム名',value('organization')]]); };
document.querySelector('[data-confirm]')?.addEventListener('click', () => { if (validateStep2()) { renderReview(); show('confirm'); } });
document.querySelectorAll<HTMLTextAreaElement>('textarea[maxlength]').forEach(el => { const out=document.querySelector<HTMLOutputElement>(`[data-count="${el.name}"]`); const update=()=>{ if(out) out.value=`${el.value.length} / ${el.maxLength}`; }; el.addEventListener('input',update);update(); });
let turnstileToken = '';
type TurnstileWindow = Window & { turnstile?: { render: (el: Element, options: Record<string, unknown>) => string } };
const sitekey=root.dataset.turnstileSiteKey;
if(sitekey){ const mount=()=>{const el=document.querySelector('[data-turnstile]'); const turnstile=(window as TurnstileWindow).turnstile; if(el&&turnstile) turnstile.render(el,{sitekey,callback:(token:string)=>turnstileToken=token,'expired-callback':()=>turnstileToken=''}); else setTimeout(mount,100);};mount(); }
form.addEventListener('submit', async event => { event.preventDefault(); setError('noSensitiveData');setError('privacyPolicy'); const noSensitive=(form.elements.namedItem('noSensitiveData') as HTMLInputElement).checked; const privacy=(form.elements.namedItem('privacyPolicy') as HTMLInputElement).checked; if(!noSensitive){setError('noSensitiveData','入力を確認してください：機密情報が含まれていないことを確認してください。');failFocus('noSensitiveData');return;} if(!privacy){setError('privacyPolicy','入力を確認してください：プライバシーポリシーへの同意が必要です。');failFocus('privacyPolicy');return;} const button=document.querySelector<HTMLButtonElement>('[data-submit]')!; const error=document.querySelector<HTMLElement>('[data-submit-error]')!;submissionAttempted=true;button.disabled=true;button.textContent='送信しています…';error.hidden=true;
 const payload={schemaVersion:'2026-07-14',idempotencyKey,source:'aoifuture.com/consulting/intake',inquiryType:'Work Consultation',stage:value('stage'),situation:value('situation'),desiredTakeaway:value('desiredTakeaway'),displayName:value('displayName'),email:value('email'),organization:value('organization'),consent:{privacyPolicy:true,noSensitiveData:true,version:'2026-07-14'},antiSpam:{turnstileToken,website:value('website'),formStartedAt:startedAt}};
 try{const res=await fetch('/api/consultation-intake',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await res.json();if(!res.ok)throw new Error(data.error||'request_failed');document.querySelector<HTMLElement>('[data-success-copy]')!.textContent=`お送りいただいた内容を読み、1〜2営業日以内に ${value('email')} へ返信します。まずは、いま整理できている範囲で十分です。追加で確認したいことがあれば、返信の中でお聞きします。`;document.querySelector<HTMLElement>('[data-receipt]')!.textContent=data.receiptId;show('success');form.reset();idempotencyKey=crypto.randomUUID();submissionAttempted=false;}catch{error.textContent='送信できませんでした。入力内容は残っています。通信環境を確認して、もう一度お試しください。';error.hidden=false;}finally{button.disabled=false;button.textContent='この内容で相談を送る';}
});
