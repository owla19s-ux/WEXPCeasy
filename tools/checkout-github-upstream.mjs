#!/usr/bin/env node
// Fetch the complete official GitHub MCP Server source at the gitlink pinned by WEX.
// This is a development checkout step, not a Windows runtime installer.
import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const submodule='connections/github/upstream/github-mcp-server';
const expected='99d6d6503a7b2a133e2f8a595d6d0ba24b4086d3';
const directory=resolve(root,submodule);
const run=(args,cwd=root)=>{
 const result=spawnSync('git',args,{cwd,encoding:'utf8',stdio:'pipe'});
 if(result.error||result.status!==0){
  const detail=(result.stderr||result.error?.message||'unknown error').trim();
  throw Error('git '+args.join(' ')+' failed: '+detail);
 }
 return result.stdout.trim();
};
try {
 // Refuse a silently moved gitlink even if README and script still claim the old SHA.
 const tree=run(['ls-tree','HEAD','--',submodule]);
 if(!tree.includes('160000 commit '+expected+'\t'+submodule))
  throw Error('Pinned gitlink mismatch; review the upstream version before checkout');
 console.log('Checking out official GitHub MCP Server at '+expected+' ...');
 run(['submodule','update','--init','--recursive','--checkout','--',submodule]);
 const actual=run(['rev-parse','HEAD'],directory);
 if(actual!==expected)throw Error('Submodule HEAD mismatch: '+actual);
 for(const p of ['go.mod','LICENSE','cmd/github-mcp-server/main.go','pkg','internal']){
  if(!existsSync(resolve(directory,p)))throw Error('Upstream source missing: '+p);
 }
 console.log('Verified complete official module checkout: '+submodule+' @ '+actual);
} catch(error){
 console.error(error instanceof Error?error.message:String(error));
 process.exitCode=1;
}
