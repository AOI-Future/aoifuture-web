/** Quest lifecycle as a pure reducer: DRAFT -> ACCEPTED -> ACTIVE -> COMPLETED | ABANDONED | EXPIRED. */
export type QuestStatus = 'DRAFT'|'ACCEPTED'|'ACTIVE'|'COMPLETED'|'ABANDONED'|'EXPIRED';
export type QuestStep = { anchor:string; title:string; ja:string };
export type Quest = { id:string; title:string; ja:string; steps:QuestStep[]; status:QuestStatus; step:number; expiresAt?:number };
export type QuestEvent =
  | { type:'accept' } | { type:'start' } | { type:'reach'; anchor:string }
  | { type:'abandon' } | { type:'expire'; now:number };

export const isFinished=(q:Quest)=>q.status==='COMPLETED'||q.status==='ABANDONED'||q.status==='EXPIRED';
export const currentStep=(q:Quest)=>q.status==='ACTIVE'?q.steps[q.step]:undefined;

/** Invalid events return the same object so callers can detect a no-op by identity. */
export function questReducer(q:Quest,e:QuestEvent):Quest {
  if(isFinished(q)) return q;
  switch(e.type) {
    case 'accept': return q.status==='DRAFT'?{...q,status:'ACCEPTED'}:q;
    case 'start': return q.status==='ACCEPTED'?{...q,status:'ACTIVE',step:0}:q;
    case 'reach': {
      if(q.status!=='ACTIVE'||q.steps[q.step]?.anchor!==e.anchor) return q;
      const step=q.step+1;
      return step>=q.steps.length?{...q,step,status:'COMPLETED'}:{...q,step};
    }
    // Abandon is allowed from any unfinished status (DRAFT, ACCEPTED, ACTIVE): a player may decline before accepting or quit mid-quest.
    case 'abandon': return {...q,status:'ABANDONED'};
    case 'expire': return q.expiresAt!==undefined&&e.now>=q.expiresAt?{...q,status:'EXPIRED'}:q;
  }
}

const STATUSES:readonly QuestStatus[]=['DRAFT','ACCEPTED','ACTIVE','COMPLETED','ABANDONED','EXPIRED'];
const isText=(v:unknown):v is string=>typeof v==='string';

/** Structural check for untrusted data (e.g. a localStorage save). Anchors, when given, must all be known. */
export function isQuest(v:unknown,anchors?:ReadonlySet<string>):v is Quest {
  if(!v||typeof v!=='object') return false;
  const q=v as Record<string,unknown>;
  if(!isText(q.id)||!isText(q.title)||!isText(q.ja)||!STATUSES.includes(q.status as QuestStatus)) return false;
  if(q.expiresAt!==undefined&&!Number.isFinite(q.expiresAt)) return false;
  const steps=q.steps;
  if(!Array.isArray(steps)||!steps.length||!steps.every(s=>s&&typeof s==='object'&&isText(s.anchor)&&isText(s.title)&&isText(s.ja)&&(!anchors||anchors.has(s.anchor)))) return false;
  const step=q.step;
  if(!Number.isInteger(step)||(step as number)<0||(step as number)>steps.length) return false;
  if(q.status==='ACTIVE'&&step===steps.length) return false;
  return q.status!=='COMPLETED'||step===steps.length;
}

export function draftQuest(id:string,title:string,ja:string,steps:QuestStep[],expiresAt?:number):Quest {
  if(!steps.length) throw new Error('a quest needs at least one step');
  return {id,title,ja,steps,status:'DRAFT',step:0,expiresAt};
}
