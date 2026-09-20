import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import worker from '../worker/index.ts';
import {emptyState} from '../lib/finance.ts';
test('API: autenticação, persistência, isolamento, validação e conflito',async()=>{
 const sqlite=new DatabaseSync(':memory:');
 sqlite.exec('CREATE TABLE finance_state (user_id TEXT PRIMARY KEY,data TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0)');
 const DB={
  prepare(sql:string){
   return {bind(...params:unknown[]){
    return {
     async first(){return sqlite.prepare(sql).get(...params as never[]);},
     async run(){const r=sqlite.prepare(sql).run(...params as never[]);return {meta:{changes:Number(r.changes)}};}
    };
   }};
  }
 };
 const env={DB,ASSETS:{fetch:async()=>new Response('<!doctype html>')}} as unknown as Parameters<typeof worker.fetch>[1];
 const req=(user='',method='GET',body?:unknown,origin='https://test.local')=>new Request('https://test.local/api/finance',{method,headers:{'oai-authenticated-user-id':user,Origin:origin},...(body===undefined?{}:{body:JSON.stringify(body)})});
 assert.equal((await worker.fetch(req(),env)).status,401);
 const initial=await (await worker.fetch(req('A'),env)).json() as {revision:number};
 assert.equal(initial.revision,0);
 const state={...emptyState,plan:{...emptyState.plan,target:40000}};
 assert.equal((await worker.fetch(req('A','PUT',{state,revision:0}),env)).status,200);
 const stored=await (await worker.fetch(req('A'),env)).json() as {state:typeof state,revision:number};
 assert.equal(stored.state.plan.target,40000);assert.equal(stored.revision,1);
 const other=await (await worker.fetch(req('B'),env)).json() as {revision:number};
 assert.equal(other.revision,0);
 assert.equal((await worker.fetch(req('A','PUT',{state,revision:0}),env)).status,409);
 assert.equal((await worker.fetch(req('A','PUT',{state,revision:1}),env)).status,200);
 assert.equal((await worker.fetch(req('A','PUT',{state,revision:2},'https://foreign.local'),env)).status,403);
 assert.equal((await worker.fetch(req('A','PUT',{state:{...state,plan:{...state.plan,term:0}},revision:2}),env)).status,400);
 assert.equal((await worker.fetch(new Request('https://test.local/'),env)).status,200);
 sqlite.close();
});
