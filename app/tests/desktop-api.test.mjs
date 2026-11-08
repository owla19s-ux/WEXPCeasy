import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';
import {startFoundations} from '../../dist/app/src/index.js';
import {createDesktopAuthority} from '../../dist/app/src/desktop-authority.js';
import {createDesktopApi} from '../../dist/app/src/desktop-api.js';
// Native confirmation/secret entry and OS cipher are fixtures; API, permissions and SQLite are real.
async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'wex-api-settings-'));await writeFile(join(root,'.wex-root.json'),JSON.stringify({format:1,id:'root'}));
 const key=randomBytes(32),cipher={available:()=>true,seal(v){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv),b=Buffer.concat([c.update(v,'utf8'),c.final()]);return Buffer.concat([iv,b,c.getAuthTag()]).toString('base64');},unseal(v){const b=Buffer.from(v,'base64'),d=createDecipheriv('aes-256-gcm',key,b.subarray(0,12));d.setAuthTag(b.subarray(-16));return Buffer.concat([d.update(b.subarray(12,-16)),d.final()]).toString('utf8');}};
 const authority=createDesktopAuthority();let consent=true,prompts=0,secretPrompts=0;
 const secret='fixture-settings-token';
 const settings=createDesktopApi({authority,confirm:async()=>{prompts++;return consent;},requestCredential:async()=>{secretPrompts++;return secret;},cancelCredential(){}});
 const host=await startFoundations({dataRoot:root,...authority.policy,credentials:{cipher},api:{deriveRequest:settings.derive}});settings.attach(host);
 t.after(async()=>{settings.close();await host.stop();await rm(root,{recursive:true,force:true});});
 return {settings,host,secret,deny:()=>consent=false,count:()=>prompts,secrets:()=>secretPrompts};
}
const input={kind:'connection.create',name:'Provider',provider:'Custom',endpoint:'https://example.test/v1/',endpointMode:'base',enabled:true};
test('API desktop rejects arbitrary dispatch, fake capabilities and plaintext credential injection',async t=>{
 const f=await fixture(t);
 for(const value of [{kind:'__proto__'},{...input,credentialRef:{id:'fake',revision:1}},{...input,secret:'injected'},{kind:'model.observe',id:'fake',observation:{}},{kind:'credential.set',connectionId:'fake',expectedRevision:1,secret:'injected'}])assert.equal((await f.settings.request(value)).status,'rejected');
 assert.equal(f.count(),0);assert.equal(f.secrets(),0);
});
test('API settings persist connection/model parameters and bind only an opaque credential reference',async t=>{
 const f=await fixture(t),created=await f.settings.request(input);assert.equal(created.status,'committed');
 const model=await f.settings.request({kind:'model.create',connectionId:created.id,name:'Model',modelId:'provider-model',parameters:{temperature:{mode:'provider-default'}}});assert.equal(model.status,'committed');
 const bound=await f.settings.request({kind:'credential.set',connectionId:created.id,expectedRevision:1});assert.equal(bound.status,'committed');assert.equal(f.secrets(),1);
 let snapshot=await f.settings.request({kind:'snapshot'});assert.equal(snapshot.status,'ok');assert.ok(snapshot.connections[0].credentialRef);assert.equal(JSON.stringify(snapshot).includes(f.secret),false);
 const models=await f.settings.request({kind:'models',connectionId:created.id});assert.equal(models.models[0].id,model.id);assert.equal(models.models[0].parameters.temperature.mode,'provider-default');
 assert.equal((await f.settings.request({kind:'connection.edit',id:created.id,expectedRevision:1,name:'stale'})).status,'rejected');
 assert.equal((await f.settings.request({kind:'credential.revoke',connectionId:created.id,expectedRevision:2})).status,'committed');
 snapshot=await f.settings.request({kind:'snapshot'});assert.equal(snapshot.connections[0].credentialRef,null);assert.equal(snapshot.connections[0].enabled,false);
});
test('declining API configuration cannot mutate or open a credential entry window',async t=>{
 const f=await fixture(t);f.deny();assert.equal((await f.settings.request(input)).status,'cancelled');assert.equal(f.secrets(),0);
 f.settings.close();assert.equal((await f.settings.request({kind:'snapshot'})).status,'unavailable');
});

test('desktop API selects supported wire protocols explicitly and persists revisions',async t=>{
 const f=await fixture(t);
 const created=await f.settings.request({...input,name:'Native Messages',protocol:'anthropic-messages',provider:'Anthropic'});
 assert.equal(created.status,'committed');
 let snapshot=await f.settings.request({kind:'snapshot'});
 assert.equal(snapshot.status,'ok');
 const native=snapshot.connections.find(c=>c.id===created.id);
 assert.equal(native.protocol,'anthropic-messages');
 const edited=await f.settings.request({kind:'connection.edit',id:created.id,expectedRevision:native.revision,protocol:'openai-chat'});
 assert.equal(edited.status,'committed');
 snapshot=await f.settings.request({kind:'snapshot'});
 assert.equal(snapshot.connections.find(c=>c.id===created.id).protocol,'openai-chat');
 const old=await f.settings.request(input);
 assert.equal(old.status,'committed');
 snapshot=await f.settings.request({kind:'snapshot'});
 assert.equal(snapshot.connections.find(c=>c.id===old.id).protocol,'openai-chat');
});

test('desktop API rejects unknown or malformed protocols before permission prompts',async t=>{
 const f=await fixture(t);
 for(const protocol of ['unknown-protocol','__proto__','anthropic-message','','OpenAI']) {
  assert.equal((await f.settings.request({...input,protocol})).status,'rejected');
 }
 assert.equal((await f.settings.request({...input,protocol:{unsafe:true}})).status,'rejected');
 assert.equal(f.count(),0);
});
