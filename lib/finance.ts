import { z } from 'zod';
const cents = z.number().int().min(0).max(100_000_000_000);
const id = z.string().min(1).max(80);
const label = z.string().trim().min(1).max(150);
const date = z.string().regex(/^20\d{2}-\d{2}-\d{2}$/).refine(s => { const d = new Date(s+'T12:00:00Z'); return Number.isFinite(+d) && d.toISOString().slice(0,10)===s; });
export const stateSchema = z.object({
  categories: z.array(z.object({id, name:label, description:z.string().max(500), color:z.string().regex(/^#[a-fA-F0-9]{6}$/), budget:cents})).max(100),
  accounts: z.array(z.object({id,name:label,type:z.enum(['cash','benefit','investment']),opening:z.number().int().min(-100_000_000_000).max(100_000_000_000),asOf:date})).max(100),
  entries: z.array(z.object({id,name:label,description:z.string().max(500),amount:cents,kind:z.enum(['income','expense','transfer']),account:id,to:z.string().max(80),category:z.string().max(80),date,recurrence:z.string().max(80)})).max(10000),
  recurring:z.array(z.object({id,name:label,description:z.string().max(500),amount:cents,kind:z.enum(['income','expense']),account:id,category:z.string().max(80),day:z.number().int().min(1).max(31),start:date,end:z.union([date,z.literal('')])})).max(300),
  plan:z.object({reserve:cents,target:cents,saved:cents,contribution:cents,keys:z.union([date,z.literal('')]),principal:cents,annual:z.number().min(0).max(100),term:z.number().int().min(1).max(600),system:z.enum(['SAC','PRICE']),fees:cents}),
}).superRefine((s,ctx)=>{
  for(const key of ['accounts','categories','entries','recurring'] as const) if(new Set(s[key].map(x=>x.id)).size!==s[key].length) ctx.addIssue({code:'custom',message:'Identificadores duplicados.'});
  for(const x of [...s.entries,...s.recurring]) {
    const a=s.accounts.find(a=>a.id===x.account);
    if(!a || (x.category&&!s.categories.some(c=>c.id===x.category))) ctx.addIssue({code:'custom',message:'Conta ou categoria inválida.'});
    if('date' in x && a && x.date<a.asOf) ctx.addIssue({code:'custom',message:'Lançamento anterior ao saldo inicial da conta.'});
    if('to' in x && x.kind==='transfer' && (!s.accounts.some(a=>a.id===x.to&&a.asOf<=x.date)||x.to===x.account)) ctx.addIssue({code:'custom',message:'Destino de transferência inválido.'});
    if('end' in x && x.end && x.end<x.start) ctx.addIssue({code:'custom',message:'Fim anterior ao início.'});
  }
  const linked=new Set<string>();
  for(const e of s.entries.filter(e=>e.recurrence)){
    const r=s.recurring.find(r=>r.id===e.recurrence);
    const key=e.recurrence+e.date.slice(0,7);
    if(!r||r.account!==e.account||r.kind!==e.kind||linked.has(key))ctx.addIssue({code:'custom',message:'Vínculo inválido ou recorrência já registrada neste mês.'});
    linked.add(key);
  }
});
export type State=z.infer<typeof stateSchema>;
export const emptyState:State={categories:[],accounts:[],entries:[],recurring:[],plan:{reserve:0,target:0,saved:0,contribution:0,keys:'',principal:0,annual:0,term:360,system:'SAC',fees:0}};
export function occurrence(r:State['recurring'][number],month:string){const [y,m]=month.split('-').map(Number);return `${month}-${String(Math.min(r.day,new Date(y,m,0).getDate())).padStart(2,'0')}`;}
export function pending(s:State,month:string){return s.recurring.flatMap(r=>{const date=occurrence(r,month);return date>=r.start&&(!r.end||date<=r.end)&&s.accounts.some(a=>a.id===r.account&&a.asOf<=date)&&!s.entries.some(e=>e.recurrence===r.id&&e.date.slice(0,7)===month)?[{...r,date}]:[];});}
export function balance(s:State,account:string,until:string){const a=s.accounts.find(a=>a.id===account);if(!a||a.asOf>until)return 0;return a.opening+s.entries.filter(e=>e.date<=until).reduce((n,e)=>n+(e.account===account?(e.kind==='income'?e.amount:-e.amount):0)+(e.kind==='transfer'&&e.to===account?e.amount:0),0);}
export function summary(s:State,month:string){const end=month+'-31';const actual=s.accounts.filter(a=>a.type==='cash').reduce((n,a)=>n+balance(s,a.id,end),0);const due=pending(s,month).filter(r=>s.accounts.find(a=>a.id===r.account)?.type==='cash');const projected=actual+due.reduce((n,r)=>n+(r.kind==='income'?r.amount:-r.amount),0);return {actual,projected,free:projected-s.plan.reserve-s.plan.contribution,due};}
export function loan(p:State['plan']) {const i=Math.pow(1+p.annual/100,1/12)-1;let debt=p.principal;const fixed=i===0?p.principal/p.term:p.principal*i/(1-Math.pow(1+i,-p.term));return Array.from({length:p.term},(_,k)=>{const interest=debt*i;const amort=Math.min(debt,p.system==='SAC'?p.principal/p.term:fixed-interest);debt=Math.max(0,debt-amort);return {month:k+1,payment:Math.round(amort+interest+p.fees),interest:Math.round(interest),debt:Math.round(debt)};});}
