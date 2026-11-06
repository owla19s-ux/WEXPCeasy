import {app,BrowserWindow} from 'electron';
import {mkdirSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
app.enableSandbox();const root=process.env.WEX_DESKTOP_FIXTURE_ROOT;assert.ok(root);
for(const folder of ['electron-user','electron-session'])mkdirSync(join(root,folder),{recursive:true});
app.setPath('userData',join(root,'electron-user'));app.setPath('sessionData',join(root,'electron-session'));
async function verify(){
 const {createCredentialPrompt}=await import('../../../dist/app/src/credential-prompt.js');
 await app.whenReady();
 const parent=new BrowserWindow({show:false,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
 const pageUrl=pathToFileURL(resolve('desktop-dist/credential.html')).href;
 const prompt=createCredentialPrompt({parent,pageUrl,preload:resolve('desktop-dist/credential-preload.cjs'),show:false});
 const timer=setTimeout(()=>{console.error('credential_entry_timeout');app.exit(1);},30000);
 const target={connectionName:'Fixture connection',provider:'fixture',endpoint:'https://example.test/v1/'};
 const pending=prompt.request(target);
 const child=BrowserWindow.getAllWindows().find(w=>w!==parent);assert.ok(child);
 await new Promise((res,rej)=>{const until=Date.now()+10000;const loop=async()=>{try{if(await child.webContents.executeJavaScript("typeof window.wexCredential==='object'&&!!document.querySelector('button[type=submit]:not(:disabled)')"))return res();}catch{}if(Date.now()>until)return rej(Error('credential_preload_unavailable'));setTimeout(loop,25);};void loop();});
 assert.deepEqual(await child.webContents.executeJavaScript('window.wexCredential.target()'),{ok:true,value:target});
 const facts=await child.webContents.executeJavaScript("({node:typeof require,process:typeof process,keys:Object.keys(window.wexCredential).sort()})");
 assert.equal(facts.node,'undefined');assert.equal(facts.process,'undefined');assert.deepEqual(facts.keys,['cancel','submit','target']);
 const preferences=child.webContents.getLastWebPreferences();assert.equal(preferences.sandbox,true);assert.equal(preferences.contextIsolation,true);assert.equal(preferences.nodeIntegration,false);assert.equal(child.webContents.session.isPersistent(),false);
 const arg=preferences.additionalArguments.find(x=>x.startsWith('--wex-credential-session=')),nonce=arg.slice('--wex-credential-session='.length);
 const peer=new BrowserWindow({show:false,webPreferences:{preload:resolve('app/desktop/tests/credential-attack.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true}});await peer.loadURL(pageUrl);
 for(const [method,payload] of [['target',{}],['submit','foreign-fixture-token'],['cancel',{}]]){
  const reply=await peer.webContents.executeJavaScript('window.credentialAttack.invoke('+JSON.stringify('wex:credential:'+nonce+':'+method)+','+JSON.stringify(payload)+')');
  assert.deepEqual(reply,{ok:false,error:'untrusted_sender'});
 }
 assert.equal((await child.webContents.executeJavaScript("window.wexCredential.submit({secret:'injected'})")).ok,false);
 const fixture='fixture-only-not-a-provider-key';
 await child.webContents.executeJavaScript("document.querySelector('input[type=password]').value="+JSON.stringify(fixture)+";document.querySelector('form').requestSubmit();true");
 assert.equal(await pending,fixture);assert.equal(child.isDestroyed(),true);
 const cancelled=prompt.request(target),next=BrowserWindow.getAllWindows().find(w=>w!==parent&&w!==peer);assert.ok(next);prompt.cancel();assert.equal(await cancelled,undefined);assert.equal(next.isDestroyed(),true);
 peer.destroy();parent.destroy();clearTimeout(timer);
 const report={source:process.env.GITHUB_SHA,platform:process.platform,fixture:'dummy secret typed into private UI only',checks:['private nonpersistent sandboxed credential window','narrow preload returns metadata only','same URL foreign WebContents cannot target/submit/cancel','object payload rejected','actual password form submit reaches main only','cancel destroys credential window']};
 await writeFile(resolve('desktop-acceptance',process.platform+'-credential-entry.json'),JSON.stringify(report,null,2));console.log('CREDENTIAL_ENTRY_ACCEPTANCE '+JSON.stringify(report));app.quit();
}
void verify().catch(error=>{console.error(error);app.exit(1);});
