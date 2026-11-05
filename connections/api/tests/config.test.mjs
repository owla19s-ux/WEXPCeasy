import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';

test('independent API connections and manual models retain stable IDs and revisions after SQLite restart',t=>{
 const h=fixture(t),a=h.connection(),b=h.connection({name:'second',endpoint:'https://other.example.org/v2'});assert.equal(a.status,'committed');assert.equal(b.status,'committed');assert.notEqual(a.id,b.id);
 const m=h.model(a.id);assert.equal(m.status,'committed');assert.equal(h.query('model',m.id).value.observation,null);
 assert.equal(h.execute({kind:'connection.edit',intent:'rename',id:a.id,expectedRevision:1,name:'renamed'}).status,'committed');h.reopen();
 assert.equal(h.query('connection',a.id).value.name,'renamed');assert.equal(h.query('connection',a.id).value.revision,2);assert.equal(h.query('connection',b.id).value.revision,1);assert.equal(h.query('model',m.id).value.connectionId,a.id);
});
test('business intents replay original results across restart and reject changed content or stale revisions',t=>{
 const h=fixture(t),cmd={kind:'connection.create',intent:'original',name:'A',provider:'custom',protocol:'openai-chat',endpoint:'https://example.org/v1',endpointMode:'base',credentialRef:null,enabled:true,parameters:{}};
 const a=h.execute(cmd);assert.equal(a.status,'committed');h.connection();h.reopen();assert.deepEqual(h.execute(cmd),a);
 assert.equal(h.execute({...cmd,name:'changed'}).reason,'intent_conflict');assert.equal(h.execute({kind:'connection.edit',intent:'edit',id:a.id,expectedRevision:1,name:'new'}).status,'committed');assert.equal(h.execute({kind:'connection.edit',intent:'stale',id:a.id,expectedRevision:1,name:'old'}).reason,'revision_conflict');
 h.revoke();assert.equal(h.execute(cmd).status,'rejected');assert.equal(h.query('connection',a.id).status,'rejected');
});
test('connection metadata rejects plaintext credential fields, URL credentials and insecure remote HTTP',t=>{
 const h=fixture(t);
 for(const patch of [{apiKey:'do-not-store'},{endpoint:'https://user:secret@example.org/v1'},{endpoint:'http://example.org/v1'},{endpoint:'https://example.org/v1?key=secret'},{headers:{Authorization:'secret'}}])assert.equal(h.connection(patch).status,'rejected');
 assert.equal(h.connection({endpoint:'http://127.0.0.1:1234/v1',credentialRef:null}).status,'committed');
});
test('configuration changes cannot smuggle reserved parameter keys or invalid parameter setting shapes',t=>{
 const h=fixture(t);
 for(const parameters of [{model:{mode:'value',value:'override'}},{Authorization:{mode:'value',value:'secret'}},{temperature:{mode:'value'}},{temperature:null}])assert.equal(h.connection({parameters}).status,'rejected');
 assert.equal(h.connection({parameters:{temperature:{mode:'value',value:0},custom:{mode:'disabled'}}}).status,'committed');
});
test('ID collisions and unsupported destructive commands do not overwrite existing records',t=>{
 const h=fixture(t,{id:()=> 'fixed'}),a=h.connection();assert.equal(a.status,'committed');assert.equal(h.connection().reason,'id_collision');assert.equal(h.model(a.id).reason,'id_collision');assert.equal(h.execute({kind:'connection.delete',intent:'delete',id:a.id}).reason,'unsupported_command');
});
test('bound endpoint mode distinguishes base URL from an explicit full request route',t=>{
 const h=fixture(t);assert.equal(h.connection({endpoint:'https://example.org/v1/chat/completions',endpointMode:'base'}).status,'rejected');
 assert.equal(h.connection({endpoint:'https://example.org/custom/chat/completions',endpointMode:'request'}).status,'committed');
});

test('API connection/model lists use object grants and filter revoked projections without leaking counts',t=>{
 const h=fixture(t),a=h.connection(),b=h.connection(),m=h.model(a.id);let hidden=false;
 const evaluate=h.permission.evaluate.bind(h.permission);h.permission.evaluate=request=>{const d=evaluate(request);return hidden&&d.status==='allow'&&d.scope.target===`connection:${b.id}`?{status:'deny',reason:'private'}:d;};
 hidden=true;const list=h.service.query(h.request('connection.list','api:connections'),{kind:'connections'});assert.equal(list.status,'ok');assert.deepEqual(list.value.map(x=>x.id),[a.id]);assert.equal('total'in list,false);
 const models=h.service.query(h.request('model.list',`connection:${a.id}`),{kind:'models',connectionId:a.id});assert.equal(models.status,'ok');assert.deepEqual(models.value.map(x=>x.id),[m.id]);
});
test('missing API list projection binding fails independently of collection size',t=>{
 const h=fixture(t,{deriveRequest:undefined});const request=h.request('connection.list','api:connections'),before=h.service.query(request,{kind:'connections'});h.connection();assert.deepEqual(h.service.query(request,{kind:'connections'}),before);assert.equal(before.status,'unavailable');
});

test('non-object API queries are rejected as invalid input rather than dependency failures',t=>{
 const h=fixture(t);for(const value of [null,false,0,[]])assert.equal(h.service.query(h.request('connection.list','api:connections'),value).status,'rejected');
});

test('connection copy creates a disabled independent revision without credentials or models',t=>{
 const h=fixture(t),source=h.connection({parameters:{temperature:{mode:'value',value:0.5}}});
 h.model(source.id);
 const cmd={kind:'connection.copy',intent:'copy',id:source.id,expectedRevision:1,name:'Backup'};
 const result=h.execute(cmd);
 assert.equal(result.status,'committed');
 assert.notEqual(result.id,source.id);
 h.reopen();
 assert.deepEqual(h.execute(cmd),result);
 const copy=h.query('connection',result.id).value;
 const original=h.query('connection',source.id).value;
 assert.deepEqual(copy,{...original,id:result.id,name:'Backup',credentialRef:null,enabled:false});
 assert.deepEqual(h.service.query(h.request('model.list',`connection:${result.id}`),{kind:'models',connectionId:result.id}),{status:'ok',value:[]});
 assert.equal(h.execute({...cmd,intent:'stale',expectedRevision:2}).reason,'revision_conflict');
 assert.equal(h.execute({...cmd,intent:'secret',credentialRef:original.credentialRef}).reason,'invalid_request');
});

test('connection copy independently requires permission to read the source and create the destination',t=>{
 const h=fixture(t),source=h.connection();
 const cmd={kind:'connection.copy',intent:'copy',id:source.id,expectedRevision:1,name:'Backup'};
 const evaluate=h.permission.evaluate.bind(h.permission);
 for(const denied of ['connection.read','connection.create']){
  h.permission.evaluate=request=>{
   const d=evaluate(request);
   return d.status==='allow'&&d.scope.action===denied?{status:'deny',reason:'private'}:d;
  };
  assert.equal(h.execute(cmd).reason,'reference_unavailable');
 }
 h.permission.evaluate=evaluate;
 assert.deepEqual(h.service.query(h.request('connection.list','api:connections'),{kind:'connections'}).value.map(x=>x.id),[source.id]);
});
