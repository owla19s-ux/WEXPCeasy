import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';
import {startFoundations} from '../../dist/app/src/index.js';
// Platform cipher and native source identities are fixtures. Permissions, host lifecycle and SQLite are real.
test('host owns encrypted credentials, denies unbound callers, and closes the capability with its root',async t=>{
 const root=await mkdtemp(join(tmpdir(),'wex-vault-host-'));await writeFile(join(root,'.wex-root.json'),JSON.stringify({format:1,id:'root'}));
 const key=randomBytes(32),cipher={available:()=>true,seal(value){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv),body=Buffer.concat([c.update(value,'utf8'),c.final()]);return Buffer.concat([iv,body,c.getAuthTag()]).toString('base64');},unseal(value){const b=Buffer.from(value,'base64'),d=createDecipheriv('aes-256-gcm',key,b.subarray(0,12));d.setAuthTag(b.subarray(-16));return Buffer.concat([d.update(b.subarray(12,-16)),d.final()]).toString('utf8');}};
 const requests=new WeakMap(),approved=new WeakSet(),history={};
 const options={dataRoot:root,credentials:{cipher},trust:{current:r=>requests.get(r),canManage:c=>approved.has(c),canReadHistory:r=>r===history}};
 let host=await startFoundations(options);
 t.after(async()=>{await host.stop();await rm(root,{recursive:true,force:true});});
 assert.equal(host.status,'ready');assert.ok(host.credentials);
 const input={id:'key-a',intent:'create',expectedRevision:0,binding:{connectionId:'connection-a',endpoint:'https://example.test/v1/',provider:'fixture'},secret:'host-fixture-only-secret'};
 assert.equal(host.credentials.put({},input).status,'denied');
 const scope={subject:'user',entry:'native-fixture',conversation:null,context:null,resource:'credentials',action:'credential.write',target:'credential:key-a',relationship:'session',relationshipGeneration:1};
 const request={};requests.set(request,{...scope,kind:'local',entryEnabled:true,moduleEnabled:true,globalEnabled:true,sourceAllowed:true,conversationEnabled:false});
 let record=host.permissions.history(history);const change={intent:'grant',expectedRevision:record.revision,scope};approved.add(change);assert.equal(host.permissions.grant(change).status,'committed');
 const stored=host.credentials.put(request,input);assert.deepEqual(stored,{status:'committed',reference:{id:'key-a',revision:1}});
 assert.equal('resolve'in host.credentials,false);
 assert.equal(host.credentials.revoke(request,{id:'key-a',intent:'wrong-action',expectedRevision:1}).status,'denied');
 const facade=host.credentials;assert.equal((await host.stop()).status,'stopped');
 assert.equal(facade.put(request,{...input,intent:'late',expectedRevision:1}).status,'unavailable');
 assert.equal((await readFile(join(root,'wex-credentials.sqlite'))).includes(Buffer.from(input.secret)),false);
 host=await startFoundations(options);assert.equal(host.status,'ready');assert.ok(host.credentials);
});
