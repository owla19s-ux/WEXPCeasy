import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,readFile,rm,readdir,lstat,rename} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {selectDesktopRoot} from '../dist/app/src/desktop-root.js';
import {startFoundations} from '../dist/app/src/index.js';
import {createDesktopAuthority} from '../dist/app/src/desktop-authority.js';
import {createDesktopApi} from '../dist/app/src/desktop-api.js';
import {createDesktopAi} from '../dist/app/src/desktop-ai.js';
import {createDesktopConversations} from '../dist/app/src/desktop-conversations.js';
if(process.platform!=='win32')throw Error('windows_installer_verification_required');
await mkdir('windows-delivery-acceptance',{recursive:true});
const installer=resolve('release/windows/WEXPCeasy-0.1.1-Setup.exe'),manifest=JSON.parse(await readFile('release/windows/manifest.json','utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.equal(hash(await readFile(installer)),manifest.installer.sha256);
assert.equal(manifest.sourceSha,process.env.GITHUB_SHA);
const parent=await mkdtemp(join(tmpdir(),'wex-install-')),install=join(parent,'应用 安装'),data=join(parent,'资料 数据'),foreign=join(parent,'existing documents');
let active;
const timeout=async(predicate,label,ms=60000)=>{const end=Date.now()+ms;while(!await predicate()){if(Date.now()>end)throw Error(label+'_timeout');await new Promise(r=>setTimeout(r,100));}};
const exists=async path=>{try{await lstat(path);return true;}catch{return false;}};
async function run(exe,args,ms=120000){return new Promise((res,rej)=>{const child=spawn(exe,args,{stdio:'inherit'}),timer=setTimeout(()=>{child.kill();rej(Error('installer_process_timeout'));},ms);child.once('error',e=>{clearTimeout(timer);rej(e);});child.once('exit',code=>{clearTimeout(timer);res(code);});});}
async function controls(root){
 const authority=createDesktopAuthority(),confirm=async()=>true;
 const api=createDesktopApi({authority,confirm,requestCredential:async()=>undefined,cancelCredential(){}});
 const ai=createDesktopAi({authority,confirm}),chat=createDesktopConversations({authority,confirm});
 const host=await startFoundations({dataRoot:root.path,expectedRootId:root.id,...authority.policy,api:{deriveRequest:api.derive},ai:{bindRead:ai.bindRead},conversations:true});assert.equal(host.status,'ready');api.attach(host);ai.attach(host);chat.attach(host);
 return {host,authority,api,ai,chat,async close(){chat.close();ai.close();api.close();assert.equal((await host.stop()).status,'stopped');}};
}
async function startAndClose(args){
 const exe=join(install,'WEXPCeasy.exe');active=spawn(exe,args,{stdio:'inherit'});
 let code;const ended=new Promise(resolve=>active.once('exit',v=>{code=v;resolve(v);}));
 await timeout(async()=>{if(code!==undefined)throw Error('packaged_app_exited_'+code);return exists(join(data,'.wex-write-lock'));},'data_root_lock');
 const script="$ErrorActionPreference='Stop'; $p=Get-Process -Id "+active.pid+"; if($p.MainWindowHandle -eq 0){exit 2}; Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class WexClose { [DllImport(\"user32.dll\",SetLastError=true)] public static extern bool PostMessage(IntPtr h,uint m,IntPtr w,IntPtr l); }'; if(-not [WexClose]::PostMessage($p.MainWindowHandle,0x10,[IntPtr]::Zero,[IntPtr]::Zero)){exit 3}";
 await timeout(async()=>{try{execFileSync(join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{stdio:'pipe',windowsHide:true});return true;}catch{return false;}},'native_window');
 await Promise.race([ended,new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('packaged_close_timeout')),30000);t.unref();})]);
 assert.equal(code,0);active=undefined;assert.equal(await exists(join(data,'.wex-write-lock')),false);
}
try{
 await mkdir(foreign);await writeFile(join(foreign,'keep.txt'),'external documents');
 assert.notEqual(await run(installer,['/S','/D='+foreign]),0);assert.equal(await readFile(join(foreign,'keep.txt'),'utf8'),'external documents');
 assert.equal(await run(installer,['/S','/D='+install]),0);
 for(const file of manifest.files)assert.equal(hash(await readFile(join(install,...file.path.split('/')))),file.sha256,file.path);
 await mkdir(data);
 const root=selectDesktopRoot({args:[],installationRoot:install,choose:()=>({path:data,create:true})});assert.ok(root);
 await writeFile(join(data,'keep-user.txt'),'user data outside installation');
 let c=await controls(root);
 const connection=await c.api.request({kind:'connection.create',name:'Restored Provider',provider:'fixture',endpoint:'https://example.test/v1',endpointMode:'base',enabled:true});assert.equal(connection.status,'committed');
 const role=await c.ai.request({kind:'save',id:'saved-role',expectedRevision:0,value:{kind:'role',name:'Restored Role',prompt:'Saved role prompt.'}});assert.equal(role.status,'committed');
 const created=await c.chat.request({kind:'create'});assert.equal(created.status,'committed');
 await c.authority.run(async()=>{await c.authority.confirm(async()=>true,'fixture seed history');const scope={resource:'conversations',action:'append',target:'conversation:'+created.id,context:null};c.authority.permit(scope);
  assert.equal(c.host.conversations.service.change(c.authority.bind(scope),{conversationId:created.id,intent:'seed-input',expectedRevision:1,change:{kind:'append',messageId:'saved-message',segments:[{id:'text',text:'Recovered conversation history.'}]}}).status,'committed');
 });
 await c.close();
 await startAndClose([]);
 assert.equal(await run(installer,['/S','/D='+install]),0);
 await startAndClose([]);
 c=await controls(root);
 assert.equal((await c.api.request({kind:'snapshot'})).connections[0].name,'Restored Provider');
 assert.equal((await c.ai.request({kind:'snapshot'})).entries[0].id,'saved-role');
 assert.equal((await c.chat.request({kind:'open',id:created.id})).conversation.messages[0].segments[0].text,'Recovered conversation history.');
 await c.close();
 await writeFile(join(install,'keep-unowned.txt'),'do not delete unknown files');
 assert.equal(await run(join(install,'Uninstall.exe'),['/S']),0);
 await timeout(async()=>!await exists(join(install,'WEXPCeasy.exe'))&&!await exists(join(install,'Uninstall.exe')),'uninstall');
 for(const file of manifest.files)assert.equal(await exists(join(install,...file.path.split('/'))),false,'uninstall retained '+file.path);
 assert.equal(await readFile(join(install,'keep-unowned.txt'),'utf8'),'do not delete unknown files');
 assert.equal(await readFile(join(data,'keep-user.txt'),'utf8'),'user data outside installation');
 await rename(join(install,'keep-unowned.txt'),join(parent,'kept-unowned.txt'));
 await rm(install,{recursive:true,force:true});
 assert.equal(await run(installer,['/S','/D='+install]),0);
 const recovered=selectDesktopRoot({args:[],installationRoot:install,choose:()=>({path:data,create:false})});assert.deepEqual(recovered,root);
 await startAndClose([]);
 c=await controls(root);assert.equal((await c.chat.request({kind:'open',id:created.id})).conversation.messages.length,1);await c.close();
 assert.equal(await run(join(install,'Uninstall.exe'),['/S']),0);
 await timeout(async()=>!await exists(join(install,'WEXPCeasy.exe'))&&!await exists(join(install,'Uninstall.exe')),'final_uninstall');
 assert.equal(await readFile(join(data,'keep-user.txt'),'utf8'),'user data outside installation');
 const report={sourceSha:process.env.GITHUB_SHA,installerSha256:manifest.installer.sha256,platform:process.platform,fixtures:['native root-selection choice supplied by test','local API configuration only, no external Provider request'],checks:['standalone packaged Electron contains all runtime resources','installer rejects unrelated nonempty directory','Unicode installation and independent data paths','actual packaged app opens and closes through native window message','same-path reinstall preserves locator and real SQLite API/AI/conversation records','uninstaller preserves external data and unknown installation-directory files','fresh install reconnects old root without old system index'],limits:['unsigned CI artifact','not manual Windows E4, Snap or multi-monitor DPI acceptance','native root picker interaction not automated']};
 await writeFile('windows-delivery-acceptance/report.json',JSON.stringify(report,null,2));console.log('WINDOWS_DELIVERY_ACCEPTANCE '+JSON.stringify(report));
}catch(error){
 await writeFile('windows-delivery-acceptance/failure.json',JSON.stringify({sourceSha:process.env.GITHUB_SHA,error:String(error)},null,2));throw error;
}finally{
 if(active){active.kill();await new Promise(resolve=>active.once('close',resolve));}
 await rm(parent,{recursive:true,force:true,maxRetries:10,retryDelay:200});
}
