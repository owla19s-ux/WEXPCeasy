import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import electron from 'electron';
const root=await mkdtemp(join(tmpdir(),'wex-github-ui-'));
try{
 const code=await new Promise((resolve,reject)=>{
  const child=spawn(electron,['app/desktop/tests/github-tools.mjs'],{stdio:'inherit',env:{...process.env,WEX_GITHUB_UI_ROOT:root}});
  child.on('error',reject);child.on('exit',code=>resolve(code??1));
 });
 assert.equal(code,0,'official MCP desktop UI process failed');
}finally{await rm(root,{recursive:true,force:true,maxRetries:10,retryDelay:150});}
