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
 let allowed=true,available=true;const dbs=new Set();
 const cipher={available:()=>available,seal(secret){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv);const body=Buffer.concat([c.update(secret,'utf8'),c.final()]);return Buffer.concat([iv,body,c.getAuthTag()]).toString('base64');},
  unseal(value){const bytes=Buffer.from(value,'base64'),d=createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));d.setAuthTag(bytes.subarray(-16));return Buffer.concat([d.update(bytes.subarray(12,-16)),d.final()]).toString('utf8');}};
 function open(){const raw=openSqliteStore(path,'credentials'),db={...raw,close(){raw.close();dbs.delete(db);}};dbs.add(db);return {db,vault:createCredentialVault(db,cipher,()=>allowed)};}
 const h=open(),binding={connectionId:'connection-a',endpoint:'https://example.test/v1/',provider:'test-provider'};
 t.after(async()=>{for(const db of dbs)db.close();await rm(dir,{recursive:true,force:true});});
 return {...h,path,open,binding,cipher,deny(){allowed=false;},unavailable(){available=false;}};
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

test('ciphertext cannot be relabelled for another endpoint or credential revision',async t=>{
 const h=await fixture(t);h.vault.put({}, {id:'key-a',intent:'one',expectedRevision:0,binding:h.binding,secret:'bound-fixture'});
 const snapshot=h.db.read(),state=structuredClone(snapshot.value);state.entries[0].binding.endpoint='https://attacker.test/';state.entries[0].revision=2;state.intents.push('tamper');
 assert.equal(h.db.commit({intent:'tamper',expectedRevision:snapshot.revision,value:state}).status,'committed');
 assert.equal(h.vault.resolve({},{id:'key-a',revision:2},{...h.binding,endpoint:'https://attacker.test/'}).status,'denied');
});
test('weak cipher fallback and authorization loss during sealing cannot persist a credential',async t=>{
 const h=await fixture(t),echo=createCredentialVault(h.db,{available:()=>true,seal:value=>value,unseal:value=>value},()=>true);
 assert.equal(echo.put({}, {id:'key-a',intent:'echo',expectedRevision:0,binding:h.binding,secret:'never-plaintext'}).status,'unavailable');
 const seal=h.cipher.seal;h.cipher.seal=value=>{const result=seal(value);h.deny();return result;};
 assert.equal(h.vault.put({}, {id:'key-a',intent:'denied',expectedRevision:0,binding:h.binding,secret:'revoked'}).status,'denied');
 assert.equal(h.db.read().revision,0);
});
test('uncertain credential commit is retained and never automatically resealed or replayed',async t=>{
 const h=await fixture(t);let writes=0;
 const store={...h.db,commit(input){writes++;const result=h.db.commit(input);return result.status==='committed'?{status:'unknown',intent:input.intent}:result;}};
 const vault=createCredentialVault(store,h.cipher,()=>true),input={id:'key-a',intent:'uncertain',expectedRevision:0,binding:h.binding,secret:'unknown-fixture'};
 assert.deepEqual(vault.put({},input),{status:'unknown',intent:'uncertain'});
 assert.equal(vault.put({},input).status,'conflict');assert.equal(writes,1);
 assert.equal(vault.resolve({},{id:'key-a',revision:1},h.binding).status,'ok');
});

test('credential receipts confirm uncertain writes after reopen without exposing or replaying secrets',async t=>{
 const h=await fixture(t);let writes=0;
 const store={...h.db,commit(input){writes++;const result=h.db.commit(input);return result.status==='committed'?{status:'unknown',intent:input.intent}:result;}};
 const vault=createCredentialVault(store,h.cipher,()=>true),input={id:'key-a',intent:'receipt-one',expectedRevision:0,binding:h.binding,secret:'receipt-fixture-secret'};
 assert.equal(vault.put({},input).status,'unknown');
 const receipt=vault.query({}, {id:input.id,intent:input.intent,binding:h.binding});
 assert.equal(receipt.status,'committed');assert.deepEqual(receipt.reference,{id:'key-a',revision:1});assert.equal(receipt.operation,'put');assert.equal(receipt.current,'current');
 assert.equal(JSON.stringify(receipt).includes(input.secret),false);assert.equal(writes,1);
 h.db.close();const reopened=h.open();assert.equal(reopened.vault.query({}, {id:input.id,intent:input.intent,binding:h.binding}).status,'committed');
 assert.equal(reopened.vault.revoke({}, {id:'key-a',intent:'receipt-revoke',expectedRevision:1}).status,'committed');
 assert.equal(reopened.vault.query({}, {id:'key-a',intent:input.intent,binding:h.binding}).current,'revoked');
 assert.equal(reopened.vault.query({}, {id:'key-a',intent:'receipt-revoke',binding:h.binding}).operation,'revoke');
});
test('receipt absence stays unknown and revoked authorization cannot reveal receipt metadata',async t=>{
 const h=await fixture(t);
 assert.equal(h.vault.query({}, {id:'key-a',intent:'missing',binding:h.binding}).status,'unknown');
 h.vault.put({}, {id:'key-a',intent:'saved',expectedRevision:0,binding:h.binding,secret:'fixture'});
 assert.equal(h.vault.query({}, {id:'key-a',intent:'saved',binding:{...h.binding,endpoint:'https://other.test/'}}).status,'denied');
 h.deny();assert.equal(h.vault.query({}, {id:'key-a',intent:'saved',binding:h.binding}).status,'denied');
});

test('legacy credential data remains readable and upgrades only on a confirmed mutation',async t=>{
 const h=await fixture(t),ciphertext=h.cipher.seal(JSON.stringify({format:1,id:'legacy-key',revision:1,binding:h.binding,secret:'legacy-fixture'}));
 const legacy={format:1,domain:'credentials',entries:[{id:'legacy-key',revision:1,binding:h.binding,ciphertext,revoked:false}],intents:['legacy-intent']};
 assert.equal(h.db.commit({intent:'legacy-intent',expectedRevision:0,value:legacy}).status,'committed');
 const vault=createCredentialVault(h.db,h.cipher,()=>true);
 assert.equal(vault.resolve({}, {id:'legacy-key',revision:1},h.binding).secret,'legacy-fixture');assert.equal(h.db.read().value.format,1);
 assert.equal(vault.query({}, {id:'legacy-key',intent:'legacy-intent',binding:h.binding}).status,'unknown');
 assert.equal(vault.put({}, {id:'new-key',intent:'new-intent',expectedRevision:0,binding:h.binding,secret:'new-fixture'}).status,'committed');
 const state=h.db.read().value;assert.equal(state.format,2);assert.equal(state.entries[0].ciphertext,ciphertext);
 assert.equal(vault.resolve({}, {id:'legacy-key',revision:1},h.binding).status,'ok');
 assert.equal(vault.query({}, {id:'new-key',intent:'new-intent',binding:h.binding}).status,'committed');
});
test('receipt query rechecks authorization after reading its durable proof',async t=>{
 const h=await fixture(t);h.vault.put({}, {id:'key-a',intent:'save',expectedRevision:0,binding:h.binding,secret:'fixture'});
 let allowed=true;
 const store={...h.db,query(intent){const proof=h.db.query(intent);allowed=false;return proof;}};
 const vault=createCredentialVault(store,h.cipher,()=>allowed);
 assert.equal(vault.query({}, {id:'key-a',intent:'save',binding:h.binding}).status,'denied');
});
