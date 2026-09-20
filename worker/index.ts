import {emptyState,stateSchema} from '../lib/finance.ts';
interface Env {DB:D1Database;ASSETS:Fetcher}
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export default {
 async fetch(req:Request,env:Env):Promise<Response>{
  const url=new URL(req.url);
  if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(req);
  if(url.pathname!=='/api/finance')return reply({error:'Rota inexistente.'},404);
  // Trust ONLY Sites dispatcher headers. Never expose this Worker outside that boundary.
  const user=req.headers.get('oai-authenticated-user-id');
  if(!user)return reply({error:'Entre na sua conta para acessar os dados.'},401);
  if(req.method==='GET'){
   try {const row=await env.DB.prepare('SELECT data,revision FROM finance_state WHERE user_id=?').bind(user).first<{data:string,revision:number}>();return reply(row?{state:JSON.parse(row.data),revision:row.revision}:{state:emptyState,revision:0});}
   catch {console.error('finance_read_failed');return reply({error:'Não foi possível carregar os dados. Tente novamente.'},503);}
  }
  if(req.method!=='PUT')return reply({error:'Método não permitido.'},405);
  if(req.headers.get('Origin')!==url.origin||req.headers.get('Sec-Fetch-Site')==='cross-site')return reply({error:'Origem inválida.'},403);
  if(Number(req.headers.get('Content-Length'))>2_000_000)return reply({error:'Limite de dados excedido.'},413);
  let body:{state:unknown,revision:number};
  try{
   const reader=req.body?.getReader();if(!reader)return reply({error:'Corpo obrigatório.'},400);
   const chunks:Uint8Array[]=[];let size=0;
   while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2_000_000){await reader.cancel();return reply({error:'Limite de dados excedido.'},413);}chunks.push(value);}
   const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
   body=JSON.parse(new TextDecoder().decode(bytes));
  }catch{return reply({error:'JSON inválido.'},400);}
  const parsed=stateSchema.safeParse(body?.state);
  if(!parsed.success||!Number.isSafeInteger(body.revision)||body.revision<0)return reply({error:parsed.success?'Revisão inválida.':parsed.error.issues[0].message},400);
  try{
   const data=JSON.stringify(parsed.data);
   const result=body.revision===0
    ?await env.DB.prepare('INSERT INTO finance_state(user_id,data,revision) VALUES(?,?,1) ON CONFLICT(user_id) DO NOTHING').bind(user,data).run()
    :await env.DB.prepare('UPDATE finance_state SET data=?,revision=revision+1 WHERE user_id=? AND revision=?').bind(data,user,body.revision).run();
   if(!result.meta.changes)return reply({error:'Outra aba alterou os dados. Recarregue antes de salvar.'},409);
   return reply({revision:body.revision+1});
  }catch{console.error('finance_write_failed');return reply({error:'Não foi possível salvar. Seus campos foram preservados.'},503);}
 }
};
