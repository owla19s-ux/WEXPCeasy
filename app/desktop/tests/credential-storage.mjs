import {app,safeStorage} from 'electron';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createWindowsCredentialCipher} from '../../../dist/app/src/desktop-credentials.js';
import {createCredentialVault,openSqliteStore} from '../../../dist/shared/src/index.js';
async function verify(){
 app.enableSandbox();
 const root=process.env.WEX_DESKTOP_FIXTURE_ROOT;assert.ok(root);
 for(const folder of ['electron-user','electron-session'])await mkdir(join(root,folder),{recursive:true});
 app.setPath('userData',join(root,'electron-user'));app.setPath('sessionData',join(root,'electron-session'));
 await app.whenReady();
 const cipher=createWindowsCredentialCipher(safeStorage);
 const path=join(root,'fixture-credentials.sqlite'),binding={connectionId:'fixture-connection',endpoint:'https://example.test/v1/',provider:'fixture'};
 let db=openSqliteStore(path,'credentials'),vault=createCredentialVault(db,cipher,()=>true);
 const input={id:'fixture-key',intent:'fixture-save',expectedRevision:0,binding,secret:'fixture-only-not-a-provider-key-987654321'};
 const recover=process.argv.includes('--recover');
 if(process.platform==='win32'){
  assert.equal(cipher.available(),true);
  if(!recover){
   const stored=vault.put({},input);assert.equal(stored.status,'committed');
   assert.equal(JSON.stringify(db.read()).includes(input.secret),false);assert.equal((await readFile(path)).includes(Buffer.from(input.secret)),false);
  }else{
   const reference={id:'fixture-key',revision:1};
   assert.equal(vault.resolve({},reference,binding).secret,input.secret);
   assert.equal(vault.resolve({},reference,{...binding,endpoint:'https://other.test/'}).status,'denied');
   assert.equal(vault.revoke({}, {id:'fixture-key',intent:'fixture-revoke',expectedRevision:1}).status,'committed');
   assert.equal(vault.resolve({},reference,binding).status,'denied');
  }
 }else{
  assert.equal(cipher.available(),false);assert.equal(vault.put({},input).status,'unavailable');assert.equal(db.read().revision,0);
 }
 db.close();
 const report={source:process.env.GITHUB_SHA,platform:process.platform,electron:process.versions.electron,
  stage:recover?'new-process-decrypt-revoke':'encrypt-save',backend:process.platform==='win32'?'Electron45-Windows-DPAPI':'disabled-no-weak-fallback',
  fixture:'dummy secret only; no real provider credentials or calls',checks:process.platform==='win32'?(recover?['new-process OS decryption','endpoint binding denied','revocation denied']:['real OS encryption','ciphertext-only SQLite persistence']):['unsupported platform refuses credential persistence']};
 await writeFile(resolve('desktop-acceptance',process.platform+'-credentials-'+(recover?'recover':'save')+'.json'),JSON.stringify(report,null,2));
 console.log('CREDENTIAL_BACKEND_ACCEPTANCE '+JSON.stringify(report));app.quit();
}
void verify().catch(error=>{console.error(error);app.exit(1);});
