import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import electron from 'electron';
await mkdir('desktop-acceptance',{recursive:true});
const child=spawn(electron,['app/desktop/tests/runtime.mjs'],{stdio:'inherit',env:{...process.env,ELECTRON_ENABLE_LOGGING:'1'}});
child.on('error',error=>{console.error(error);process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
