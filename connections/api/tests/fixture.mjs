import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openSqliteStore} from '../../../dist/shared/src/index.js';
import * as api from '../../../dist/connections/api/src/index.js';
export function fixture(t,extra={}){
 assert.equal(typeof api.createApiService,'function');
 const dir=mkdtempSync(join(tmpdir(),'wex-api-')),path=join(dir,'api.sqlite'),requests=new WeakMap();const open=extra.openStore??openSqliteStore;let db=open(path,'api-configurations'),seq=0,enabled=true;
 const permission={evaluate(r){const scope=requests.get(r);return enabled&&scope?{status:'allow',revision:1,generation:1,scope}:{status:'deny',reason:'denied'};},recheck(r){return this.evaluate(r);}};
 const request=(action,target,context=null,patch={})=>{const r={};requests.set(r,{subject:'user',entry:'window',conversation:null,context,resource:'connections/api',action,target,relationship:'session',relationshipGeneration:1,...patch});return r;};
 const options={id:()=>`api-${++seq}`,deriveRequest(parent,scope){if(requests.has(parent))return request(scope.action,scope.target,scope.context);},...extra};
 let service=api.createApiService(db,permission,options);
 t.after(()=>{service.stop();db.close();rmSync(dir,{recursive:true,force:true});});
 const scope=c=>c.kind==='connection.create'?'api:connections':c.kind==='model.create'?`connection:${c.connectionId}`:c.kind.startsWith('connection.')?`connection:${c.id}`:`model:${c.id}`;
 const execute=(c,r=request(c.kind,scope(c)))=>service.execute(r,c);
 const query=(kind,id)=>service.query(request(`${kind}.read`,`${kind}:${id}`),{kind,id});
 const connection=(patch={})=>execute({kind:'connection.create',intent:`connection-${++seq}`,name:'DeepSeek',provider:'deepseek',protocol:'openai-chat',endpoint:'https://api.example.org/v1',endpointMode:'base',credentialRef:{id:'credential-1',revision:1},enabled:true,parameters:{},...patch});
 const model=(connectionId,patch={})=>execute({kind:'model.create',intent:`model-${++seq}`,connectionId,name:'Chat',modelId:'chat-model',parameters:{},...patch});
 return {path,permission,request,execute,query,connection,model,get service(){return service;},get db(){return db;},revoke(){enabled=false;},allow(){enabled=true;},reopen(){service.stop();db.close();db=open(path,'api-configurations');service=api.createApiService(db,permission,options);}};
}

