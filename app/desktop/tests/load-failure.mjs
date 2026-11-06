import {app} from 'electron';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,lstat,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {runDesktop} from '../../../dist/app/src/desktop-runtime.js';
import {startFoundations} from '../../../dist/app/src/index.js';
import {openSqliteStore} from '../../../dist/shared/src/index.js';
async function verify(){
 app.enableSandbox();
 const root=await mkdtemp(join(tmpdir(),'wex-desktop-load-failure-'));
 await writeFile(join(root,'.wex-root.json'),JSON.stringify({format:1,id:randomUUID()}));
 for(const folder of ['electron-user','electron-session'])await mkdir(join(root,folder));
 app.setPath('userData',join(root,'electron-user'));app.setPath('sessionData',join(root,'electron-session'));
 let fail=true;
 const timer=setTimeout(()=>{console.error('load_failure_timeout');app.exit(1);},30000);
 const runtime=await runDesktop({url:pathToFileURL(join(root,'missing.html')).href,preload:resolve('desktop-dist/preload.cjs'),show:false,
  start:()=>startFoundations({dataRoot:root,trust:{current:()=>undefined,canManage:()=>false,canReadHistory:()=>false},
   openStore(path,namespace){const db=openSqliteStore(path,namespace);return {...db,close(){if(fail){fail=false;throw Error('injected-close');}db.close();}};}})});
 await new Promise((res,rej)=>{const end=Date.now()+8000;const poll=()=>runtime.readStatus().phase==='release-pending'?res():Date.now()>end?rej(Error('release phase timeout')):setTimeout(poll,20);poll();});
 assert.equal(runtime.window.isDestroyed(),false);assert.equal((await lstat(join(root,'.wex-write-lock'))).isDirectory(),true);
 assert.equal((await runtime.lifecycle.stop()).status,'stopped');
 const report={source:process.env.GITHUB_SHA,platform:process.platform,checks:['page load failure requests confirmed release','failed release keeps root lease and process','retry completes release']};
 await writeFile(resolve('desktop-acceptance',process.platform+'-load-failure.json'),JSON.stringify(report,null,2));
 console.log('DESKTOP_LOAD_FAILURE '+JSON.stringify(report));clearTimeout(timer);await rm(root,{recursive:true,force:true});app.quit();
}
void verify().catch(error=>{console.error(error);app.exit(1);});
