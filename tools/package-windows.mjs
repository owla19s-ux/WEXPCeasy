import {build} from 'esbuild';
import {cp,mkdir,readFile,writeFile,rm,rename,readdir,lstat,access} from 'node:fs/promises';
import {resolve,join,relative,dirname,sep} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {stageGitHubRuntime} from './stage-github-runtime.mjs';
if(process.platform!=='win32'||process.arch!=='x64')throw Error('windows_x64_packaging_required');
const output=resolve('release/windows'),payload=join(output,'WEXPCeasy'),version='0.1.1';
await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
const electronDist=resolve('node_modules/electron/dist');
try{await access(join(electronDist,'electron.exe'));}catch{execFileSync(process.execPath,[resolve('node_modules/electron/install.js')],{stdio:'inherit'});}
await cp(electronDist,payload,{recursive:true});
await rename(join(payload,'electron.exe'),join(payload,'WEXPCeasy.exe'));
await rm(join(payload,'resources/default_app.asar'),{force:true});
const app=join(payload,'resources/app');await mkdir(join(app,'dist/app/src'),{recursive:true});
await writeFile(join(app,'package.json'),JSON.stringify({name:'wexpc-easy',productName:'WEXPCeasy',version,type:'module',main:'dist/app/src/desktop-main.js'},null,2));
await build({entryPoints:['app/src/desktop-main.ts'],bundle:true,platform:'node',format:'esm',target:'node24',external:['electron'],outfile:join(app,'dist/app/src/desktop-main.js'),banner:{js:"import {createRequire as __wexCreateRequire} from 'node:module'; const require=__wexCreateRequire(import.meta.url);"}});
await cp(resolve('desktop-dist'),join(app,'desktop-dist'),{recursive:true});
// Reuse the existing fixed, unmodified official source builder. The installed app never downloads tools.
execFileSync(process.execPath,[resolve('connections/github/tests/build-official-runtime.mjs')],{
 env:{...process.env,GITHUB_OUTPUT:join(output,'github-runtime-output.txt')},stdio:'inherit'});
const githubRuntime=await stageGitHubRuntime({buildPath:resolve('github-mcp-runtime-build.json'),resourcesPath:join(payload,'resources')});
await writeFile(join(payload,'.wex-install.ini'),'[WEX]\r\nProduct=WEXPCeasy\r\nFormat=1\r\nVersion='+version+'\r\n');
await writeFile(join(app,'provenance.json'),JSON.stringify({product:'WEXPCeasy',version,sourceSha:process.env.GITHUB_SHA??'local-build',electron:'45.2.1',architecture:'x64',signed:false},null,2));
const files=[],dirs=[];
async function walk(dir){for(const item of await readdir(dir,{withFileTypes:true})){
 const path=join(dir,item.name);if((await lstat(path)).isSymbolicLink())throw Error('package_symlink_rejected');
 if(item.isDirectory()){dirs.push(path);await walk(path);}else if(item.isFile())files.push(path);else throw Error('unsupported_package_entry');
}}
await walk(payload);
const escape=value=>value.replaceAll('$','$$').replaceAll('"','$\\"');
const rel=path=>relative(payload,path).split(sep).join('\\');
const install=files.map(path=>' SetOutPath "$INSTDIR'+(rel(dirname(path))?'\\'+escape(rel(dirname(path))):'')+'"\n File "'+escape(path)+'"').join('\n');
const remove=[...files.map(path=>' Delete "$INSTDIR\\'+escape(rel(path))+'"'),...dirs.sort((a,b)=>b.length-a.length).map(path=>' RMDir "$INSTDIR\\'+escape(rel(path))+'"')].join('\n');
const verify=[payload,...dirs,...files].map(path=>{
 const suffix=path===payload?'':'\\'+escape(rel(path));
 return " System::Call 'kernel32::GetFileAttributesW(w \"$INSTDIR"+suffix+"\") i .r0'\n IntCmp $0 -1 +5\n IntOp $1 $0 & 0x400\n IntCmp $1 0 +3\n SetErrorLevel 4\n Abort";
}).join('\n');
const installer=join(output,'WEXPCeasy-'+version+'-Setup.exe');
let script=await readFile('app/installer/windows.nsi','utf8');
// Re-probe a bounded, side-effect-free precondition: Other processes/scanners can retain owned payload files after the main app exits.
// Never replace/delete a payload while the exact exclusive writable-open check still fails.
const stopped=files.map((path,index)=>{
 const file=escape(rel(path));
 return ` IfFileExists "$INSTDIR\\${file}" 0 stopped_${index}
 StrCpy $R7 20
 probe_${index}:
 System::Call 'kernel32::CreateFileW(w "$INSTDIR\\${file}", i 0x40000000, i 0, p 0, i 3, i 0, p 0) p .r0 ?e'
 Pop $1
 IntCmp $0 -1 occupied_${index}
 System::Call 'kernel32::CloseHandle(p r0)'
 Goto stopped_${index}
 occupied_${index}:
 IntOp $R7 $R7 - 1
 IntCmp $R7 0 running_${index}
 Sleep 100
 Goto probe_${index}
 running_${index}:
 FileOpen $R8 "$TEMP\\WEXPCeasy-install.log" a
 FileSeek $R8 0 END
 FileWrite $R8 "application_locked|$INSTDIR|win32=$1|file=${file}$\\r$\\n"
 FileClose $R8
 FileOpen $R8 "$TEMP\\WEXPCeasy-install-utf16.log" a
 FileSeek $R8 0 END $R6
 IntCmp $R6 0 0 +2 +2
 FileWriteWord $R8 0xFEFF
 FileWriteUTF16LE $R8 "application_locked|$INSTDIR|win32=$1|file=${file}$\\r$\\n"
 FileClose $R8
 IfSilent +2
 MessageBox MB_OK|MB_ICONSTOP "程序文件被占用或不可写。请退出 WEXPCeasy 及相关进程，检查权限后重试。"
 SetErrorLevel 3
 Abort
 stopped_${index}:`;
}).join('\n')+'\n Return';
script=script.replaceAll('@@VERIFY_STOPPED@@',stopped).replaceAll('@@OUTPUT@@',escape(installer)).replaceAll('@@VERIFY_PATHS@@',verify).replaceAll('@@INSTALL_FILES@@',install).replaceAll('@@REMOVE_FILES@@',remove);
if(script.includes('@@'))throw Error('unrendered_installer_template');
const scriptPath=join(output,'installer.nsi');await writeFile(scriptPath,script);
const compiler=process.env.WEX_MAKENSIS??'C:\\Program Files (x86)\\NSIS\\makensis.exe';
execFileSync(compiler,['/V2',scriptPath],{stdio:'inherit'});
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest={product:'WEXPCeasy',version,sourceSha:process.env.GITHUB_SHA??'local-build',githubRuntime,installer:{file:'WEXPCeasy-'+version+'-Setup.exe',sha256:sha256(await readFile(installer))},files:await Promise.all(files.map(async path=>({path:rel(path).replaceAll('\\','/'),sha256:sha256(await readFile(path))})))};
await writeFile(join(output,'manifest.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify({installer,sourceSha:manifest.sourceSha,sha256:manifest.installer.sha256,files:files.length}));
