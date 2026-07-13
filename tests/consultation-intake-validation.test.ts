import { describe, expect, it } from 'vitest';
import { addBusinessDays, validateConsultationIntake } from '../src/lib/consultation-intake';
const now = Date.parse('2026-07-14T12:00:00Z');
const valid = () => ({ schemaVersion:'2026-07-14', idempotencyKey:'123e4567-e89b-42d3-a456-426614174000', stage:'workflow_review', situation:'\r\nA\u0000 situation\r\n', email:' Person@Example.com ', consent:{privacyPolicy:true,noSensitiveData:true,version:'2026-07-14'}, antiSpam:{turnstileToken:'',website:'',formStartedAt:now-4000}, source:'consulting_page' });
describe('consultation schema',()=>{
 it('normalizes bounded input',()=>{const r=validateConsultationIntake(valid(),now);expect(r.ok).toBe(true);if(r.ok){expect(r.value.situation).toBe('A situation');expect(r.value.email).toBe('Person@Example.com');}});
 it.each([['stage','bad'],['situation',''],['email','bad']])('rejects invalid %s',(key,value)=>{const input={...valid(),[key]:value};expect(validateConsultationIntake(input,now).ok).toBe(false);});
 it('rejects unknown and nested unknown keys',()=>{expect(validateConsultationIntake({...valid(),extra:true},now)).toMatchObject({ok:false,errors:{extra:'unknown_field'}});expect(validateConsultationIntake({...valid(),consent:{...valid().consent,extra:true}},now)).toMatchObject({ok:false,errors:{'consent.extra':'unknown_field'}});});
 it('enforces limits, consent, honeypot and dwell',()=>{expect(validateConsultationIntake({...valid(),situation:'x'.repeat(801)},now).ok).toBe(false);expect(validateConsultationIntake({...valid(),consent:{...valid().consent,noSensitiveData:false}},now).ok).toBe(false);expect(validateConsultationIntake({...valid(),antiSpam:{...valid().antiSpam,website:'bot'}},now).ok).toBe(false);expect(validateConsultationIntake({...valid(),antiSpam:{...valid().antiSpam,formStartedAt:now-10}},now).ok).toBe(false);});
 it('adds business days',()=>expect(addBusinessDays(new Date('2026-07-17T10:00:00Z'),2).toISOString()).toBe('2026-07-21T10:00:00.000Z'));
});
