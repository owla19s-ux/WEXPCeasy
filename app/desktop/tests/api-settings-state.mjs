import assert from 'node:assert/strict';
import {app,BrowserWindow} from 'electron';
import {build} from 'esbuild';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

app.enableSandbox();app.disableHardwareAcceleration();
app.on('window-all-closed',()=>{});
const timer=setTimeout(()=>{console.error('api_settings_state_timeout');app.exit(1);},30000);
async function verify(){
await app.whenReady();
const directory=await mkdtemp(join(process.env.WEX_DESKTOP_FIXTURE_ROOT??process.env.WEX_GITHUB_UI_ROOT??tmpdir(),'wex-api-state-'));
let window;
try{
 await build({entryPoints:['UI/tests/fixtures/api-settings-state.mjs'],bundle:true,platform:'browser',format:'iife',
  target:'chrome140',outfile:join(directory,'test.js'),define:{'process.env.NODE_ENV':'"development"'}});
 await writeFile(join(directory,'index.html'),'<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'self\'; connect-src \'none\'"><body><script src="test.js"></script></body>');
 window=new BrowserWindow({show:false,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
 await window.loadFile(join(directory,'index.html'));
 const evidence=await window.webContents.executeJavaScript('globalThis.apiSettingsStateResult');
 assert.equal(evidence?.ok,true,evidence?.error??'renderer test did not start');
 assert.equal(evidence.checks.length,3);
 assert.equal(window.webContents.getLastWebPreferences().sandbox,true);
 await mkdir('desktop-acceptance',{recursive:true});
 await writeFile('desktop-acceptance/api-settings-state-'+process.platform+'.json',JSON.stringify({sha:process.env.GITHUB_SHA,platform:process.platform,...evidence},null,2));
 console.info('API settings state acceptance passed: '+evidence.checks.length+' real React late-response checks.');
}catch(error){console.error(error);process.exitCode=1;}
finally{
 clearTimeout(timer);window?.destroy();await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});app.exit(process.exitCode??0);
}
}
void verify().catch(error=>{console.error(error);clearTimeout(timer);app.exit(1);});
