import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
async function fixture(t){
 const f=await import('../../dist/app/src/desktop-root.js');
 const parent=await mkdtemp(join(tmpdir(),'wex-first-start-')),installationRoot=join(parent,'应用 安装'),data=join(parent,'资料 数据');
 await mkdir(installationRoot);await mkdir(data);
 t.after(()=>rm(parent,{recursive:true,force:true,maxRetries:10,retryDelay:100}));
 return {f,parent,installationRoot,data};
}
test('first run explicitly creates an empty root and restores it without an old system index',async t=>{
 const h=await fixture(t),{selectDesktopRoot,desktopCachePaths}=h.f;
 const root=selectDesktopRoot({args:[],installationRoot:h.installationRoot,choose:reason=>{assert.equal(reason,'first-run');return {path:h.data,create:true};}});
 const marker=JSON.parse(await readFile(join(h.data,'.wex-root.json'),'utf8'));assert.equal(marker.format,1);assert.equal(marker.id,root.id);
 assert.ok(desktopCachePaths(root).every(v=>v.path.startsWith(root.path)));
 const restored=selectDesktopRoot({args:[],installationRoot:h.installationRoot,choose:()=>{throw Error('unexpected_picker');}});assert.deepEqual(restored,root);
 await rm(join(h.installationRoot,'.wex-launch.json'));
 assert.deepEqual(selectDesktopRoot({args:[],installationRoot:h.installationRoot,choose:()=>({path:h.data,create:false})}),root);
 assert.deepEqual(Object.keys(JSON.parse(await readFile(join(h.installationRoot,'.wex-launch.json'),'utf8'))).sort(),['format','id','path']);
});
test('cancelled first run and missing explicit roots never fabricate a data directory',async t=>{
 const h=await fixture(t);
 assert.equal(h.f.selectDesktopRoot({args:[],installationRoot:h.installationRoot,choose:()=>undefined}),undefined);
 assert.deepEqual(await readdir(h.data),[]);assert.deepEqual(await readdir(h.installationRoot),[]);
 assert.throws(()=>h.f.selectDesktopRoot({args:['--data-root',join(h.parent,'missing')],installationRoot:h.installationRoot,choose:()=>{throw Error('unexpected_picker');}}));
 assert.deepEqual(await readdir(h.parent),['应用 安装','资料 数据'].sort());
});
test('nonempty directories, incompatible roots and overlapping install/data paths are rejected without overwrites',async t=>{
 const h=await fixture(t),select=(path,create)=>h.f.selectDesktopRoot({args:[],installationRoot:h.installationRoot,choose:()=>({path,create})});
 await writeFile(join(h.data,'keep.txt'),'existing user file');
 assert.throws(()=>select(h.data,true));assert.deepEqual(await readdir(h.data),['keep.txt']);
 await writeFile(join(h.data,'.wex-root.json'),'{"format":999,"id":"old"}');
 assert.throws(()=>select(h.data,false));assert.equal(await readFile(join(h.data,'.wex-root.json'),'utf8'),'{"format":999,"id":"old"}');
 assert.throws(()=>select(h.installationRoot,true));assert.throws(()=>select(h.parent,false));
 const nested=join(h.installationRoot,'nested');await mkdir(nested);assert.throws(()=>select(nested,true));
});
test('lost roots and corrupt locators require explicit recovery and cannot silently initialize replacement data',async t=>{
 const h=await fixture(t),file=join(h.installationRoot,'.wex-launch.json');
 await writeFile(file,JSON.stringify({format:1,path:join(h.parent,'lost-volume'),id:'old-root'}));
 assert.equal(h.f.selectDesktopRoot({args:[],installationRoot:h.installationRoot,choose:reason=>{assert.equal(reason,'recovery');return;}}),undefined);
 assert.equal((await readdir(h.parent)).includes('lost-volume'),false);
 await writeFile(file,'broken');
 await writeFile(join(h.data,'.wex-root.json'),JSON.stringify({format:1,id:'restored-root'}));
 const root=h.f.selectDesktopRoot({args:[],installationRoot:h.installationRoot,choose:reason=>{assert.equal(reason,'recovery');return {path:h.data,create:false};}});
 assert.equal(root.id,'restored-root');
});
test('symlink markers and cache locations are refused before desktop caches can be redirected',async t=>{
 const h=await fixture(t),outside=join(h.parent,'outside');await mkdir(outside);
 await writeFile(join(outside,'marker'),JSON.stringify({format:1,id:'root'}));await symlink(join(outside,'marker'),join(h.data,'.wex-root.json'),'file');
 assert.throws(()=>h.f.selectDesktopRoot({args:['--data-root',h.data],installationRoot:h.installationRoot,choose:()=>undefined}));
 await rm(join(h.data,'.wex-root.json'));await writeFile(join(h.data,'.wex-root.json'),JSON.stringify({format:1,id:'root'}));
 await symlink(outside,join(h.data,'electron-session'),process.platform==='win32'?'junction':'dir');
 assert.throws(()=>h.f.desktopCachePaths({path:h.data,id:'root'}));
 assert.deepEqual(await readdir(outside),['marker']);
});

test('Windows native root picker script parses and its folder dialog can be constructed before Electron ready',{skip:process.platform!=='win32'},async()=>{
 const {spawnSync}=await import('node:child_process');
 const {desktopRootPickerScript}=await import('../../dist/app/src/desktop-root-picker.js');
 const code="$ErrorActionPreference='Stop';$source=[Console]::In.ReadToEnd();$tokens=$null;$errors=$null;[void][Management.Automation.Language.Parser]::ParseInput($source,[ref]$tokens,[ref]$errors);if($errors.Count){throw 'picker_script_parse_failed'};Add-Type -AssemblyName System.Windows.Forms;$picker=New-Object Windows.Forms.FolderBrowserDialog;$picker.ShowNewFolderButton=$true;$picker.Dispose()";
 const result=spawnSync(join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-STA','-EncodedCommand',Buffer.from(code,'utf16le').toString('base64')],{input:desktopRootPickerScript,encoding:'utf8',windowsHide:true,timeout:20000});
 assert.equal(result.status,0,result.stderr);
});
