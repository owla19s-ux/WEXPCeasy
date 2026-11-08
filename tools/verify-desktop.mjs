import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,lstat,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
import electron from 'electron';
await mkdir('desktop-acceptance',{recursive:true});
function run(args,fixtureRoot){return new Promise((resolve,reject)=>{
 const child=spawn(electron,args,{stdio:'inherit',env:{...process.env,ELECTRON_ENABLE_LOGGING:'1',...(fixtureRoot?{WEX_DESKTOP_FIXTURE_ROOT:fixtureRoot}:{})}});
 child.on('error',reject);child.on('exit',code=>resolve(code??1));
});}
for(const [entry,...args] of [['runtime.mjs'],['load-failure.mjs'],['renderer-failure.mjs','idle'],['renderer-failure.mjs','startup'],['renderer-failure.mjs','stream'],['renderer-failure.mjs','destroyed'],['credential-storage.mjs'],['credential-entry.mjs'],['github-tools-state.mjs'],['api-settings-state.mjs'],['ai-settings-state.mjs'],['permission-settings-state.mjs'],['workspace-access-state.mjs']]){
 const root=await mkdtemp(join(tmpdir(),'wex-desktop-fixture-'));
 let code;
 try{code=await run(['app/desktop/tests/'+entry,...args],root);if(code===0&&entry==='credential-storage.mjs'&&process.platform==='win32')code=await run(['app/desktop/tests/'+entry,'--recover'],root);}
 finally{await rm(root,{recursive:true,force:true,maxRetries:10,retryDelay:150});}
 if(code!==0)process.exit(1);
}
const parent=await mkdtemp(join(tmpdir(),'wex-invalid-root-')),missing=join(parent,'missing-root');
assert.equal(await run(['dist/app/src/desktop-main.js','--data-root',missing]),1);
await assert.rejects(lstat(missing),{code:'ENOENT'});
await writeFile('desktop-acceptance/'+process.platform+'-entry.json',JSON.stringify({source:process.env.GITHUB_SHA,platform:process.platform,checks:['formal entry rejects missing data root without creating it']},null,2));
await rm(parent,{recursive:true,force:true});
