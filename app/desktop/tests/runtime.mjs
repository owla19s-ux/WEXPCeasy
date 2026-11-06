import {app} from 'electron';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,lstat,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {runDesktop} from '../../../dist/app/src/desktop-runtime.js';
import {startFoundations} from '../../../dist/app/src/index.js';
import {openSqliteStore} from '../../../dist/shared/src/index.js';
app.enableSandbox();
const root=await mkdtemp(join(tmpdir(),'wex-desktop-'));
const id=randomUUID();await writeFile(join(root,'.wex-root.json'),JSON.stringify({format:1,id}));
app.setPath('userData',join(root,'electron-user'));
app.setPath('sessionData',join(root,'electron-session'));
let failClose=true;
const startup=()=>startFoundations({dataRoot:root,expectedRootId:id,trust:{current:()=>undefined,canManage:()=>false,canReadHistory:()=>false},
 openStore(path,namespace){const db=openSqliteStore(path,namespace);return {...db,close(){if(failClose){failClose=false;throw Error('injected-close');}db.close();}};}});
const timer=setTimeout(()=>{console.error('desktop_runtime_timeout');app.exit(1);},45000);
try{
 const runtime=await runDesktop({url:pathToFileURL(resolve('desktop-dist/index.html')).href,preload:resolve('desktop-dist/preload.cjs'),start:startup,show:false});
 await runtime.lifecycle.start();
 const wc=runtime.window.webContents;
 const facts=await wc.executeJavaScript(`(async()=>({node:typeof require,process:typeof process,bridge:Object.keys(window.wexHost).sort(),reply:await window.wexHost.readStatus(),title:document.title,text:document.body.innerText}))()`);
 assert.equal(facts.node,'undefined');assert.equal(facts.process,'undefined');
 assert.deepEqual(facts.bridge,['readStatus','requestQuit']);assert.equal(facts.reply.ok,true);
 assert.equal(facts.reply.value.phase,'ready');assert.equal(facts.title,'WEXPCeasy');assert.match(facts.text,/WEXPCeasy/);
 const prefs=wc.getLastWebPreferences();assert.equal(prefs.sandbox,true);assert.equal(prefs.contextIsolation,true);assert.equal(prefs.nodeIntegration,false);
 assert.equal((await lstat(join(root,'.wex-write-lock'))).isDirectory(),true);
 const network=await wc.executeJavaScript(`fetch('https://example.com').then(()=>false,()=>true)`);assert.equal(network,true);
 const before=wc.getURL();await wc.executeJavaScript(`window.open('https://example.com');true`);assert.equal(wc.getURL(),before);
 // A close failure must leave the process and root lease alive, then permit retry.
 app.quit();
 await new Promise((res,rej)=>{const end=Date.now()+8000;const poll=()=>runtime.readStatus().phase==='release-pending'?res():Date.now()>end?rej(Error('release phase timeout')):setTimeout(poll,20);poll();});
 assert.equal(runtime.window.isDestroyed(),false);assert.equal((await lstat(join(root,'.wex-write-lock'))).isDirectory(),true);
 assert.equal((await runtime.lifecycle.stop()).status,'stopped');
 const reopened=await startFoundations({dataRoot:root,trust:{current:()=>undefined,canManage:()=>false,canReadHistory:()=>false}});
 assert.equal(reopened.status,'ready');assert.equal((await reopened.stop()).status,'stopped');
 const report={source:process.env.GITHUB_SHA??'unknown',platform:process.platform,electron:process.versions.electron,node:process.versions.node,sqlite:process.versions.sqlite,checks:['sandboxed React and narrow preload','default-deny identity','CSP network denied','window open denied','quit waits and retains lease on release failure','retry releases real SQLite and root; restart succeeds']};
 await writeFile(resolve('desktop-acceptance',process.platform+'.json'),JSON.stringify(report,null,2));
 console.log('DESKTOP_ACCEPTANCE '+JSON.stringify(report));clearTimeout(timer);await rm(root,{recursive:true,force:true});app.quit();
}catch(error){console.error(error);clearTimeout(timer);app.exit(1);}
