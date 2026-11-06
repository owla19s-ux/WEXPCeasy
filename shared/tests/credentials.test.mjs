import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';
import {openSqliteStore,createCredentialVault} from '../../dist/shared/src/index.js';
// AES is a test cipher fixture. Windows DPAPI/OS backend needs separate platform evidence.
async function fixture(t){
 const dir=await mkdtemp(join(tmpdir(),'wex-credential-')),path=join(dir,'credentials.sqlite'),key=randomBytes(32);
 let allowed=true,available=true;const dbs=[];
 const cipher={available:()=>available,seal(secret){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv);return Buffer.concat([iv,c.getAuthTag?.bind?Buffer.alloc(0):Buffer.alloc(0),c.update(secret,'utf8'),c.final(),c.getAuthTag()]).toString('base64');},
  unseal(value){const bytes=Buffer.from(value,'base64'),d=createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));d.setAuthTag(bytes.subarray(-16));return Buffer.concat([d.update(bytes.subarray(12,-16)),d.final()]).toString('utf8');}};
 function open(){const db=openSqliteStore(path,'credentials');dbs.push(db);return {db,vault:createCredentialVault(db,cipher,()=>allowed)};}
 const h=open(),binding={connectionId:'connection-a',endpoint:'https://example.test/v1/',provider:'test-provider'};
 t.after(async()=>{for(const db of dbs)db.close();await rm(dir,{recursive:true,force:true});});
 return {...h,path,open,binding,deny(){allowed=false;},unavailable(){available=false;}};
}
test('vault stores ciphertext only and survives actual SQLite reopen',async t=>{
 const h=await fixture(t),secret='test-only-secret-ABCDEFGHIJKLMNOPQRSTUVWXYZ';
 const saved=h.vault.put({}, {id:'key-a',intent:'save-a',expectedRevision:0,binding:h.binding,secret});
 assert.deepEqual(saved,{status:'committed',reference:{id:'key-a',revision:1}});
 assert.equal(JSON.stringify(h.db.read()).includes(secret),false);
 assert.equal((await readFile(h.path)).includes(Buffer.from(secret)),false);
 h.db.close();const reopened=h.open();
 assert.deepEqual(reopened.vault.resolve({},saved.reference,h.binding),{status:'ok',secret});
});
test('vault exact binding, revision, native access and backend gates fail closed',async t=>{
 const h=await fixture(t);const saved=h.vault.put({}, {id:'key-a',intent:'save',expectedRevision:0,binding:h.binding,secret:'only-fixture-token'});
 assert.equal(h.vault.resolve({},saved.reference,{...h.binding,endpoint:'https://other.test/'}).status,'denied');
 assert.equal(h.vault.resolve({},{id:'key-a',revision:9},h.binding).status,'denied');
 h.deny();assert.equal(h.vault.resolve({},saved.reference,h.binding).status,'denied');
 assert.equal(h.vault.put({}, {id:'key-b',intent:'denied',expectedRevision:0,binding:h.binding,secret:'blocked'}).status,'denied');
});
test('vault replacement and revocation reject stale references',async t=>{
 const h=await fixture(t),first=h.vault.put({}, {id:'key-a',intent:'one',expectedRevision:0,binding:h.binding,secret:'first-fixture'});
 const next=h.vault.put({}, {id:'key-a',intent:'two',expectedRevision:1,binding:h.binding,secret:'second-fixture'});
 assert.equal(next.reference.revision,2);assert.equal(h.vault.resolve({},first.reference,h.binding).status,'denied');
 assert.equal(h.vault.put({}, {id:'key-a',intent:'stale',expectedRevision:1,binding:h.binding,secret:'stale'}).status,'conflict');
 assert.equal(h.vault.revoke({}, {id:'key-a',intent:'revoke',expectedRevision:2}).status,'committed');
 assert.equal(h.vault.resolve({},next.reference,h.binding).status,'denied');
});
test('unavailable encryption refuses persistence and never falls back to plaintext',async t=>{
 const h=await fixture(t);h.unavailable();
 assert.equal(h.vault.put({}, {id:'key-a',intent:'one',expectedRevision:0,binding:h.binding,secret:'must-not-persist'}).status,'unavailable');
 assert.equal(h.db.read().revision,0);
});
