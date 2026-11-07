import {app,safeStorage,dialog} from 'electron';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {startFoundations} from './foundations.js';
import {createWindowsCredentialCipher} from './desktop-credentials.js';
import {runDesktop} from './desktop-runtime.js';
import {selectDesktopRoot,desktopCachePaths} from './desktop-root.js';
import {chooseDesktopRoot} from './desktop-root-picker.js';
try{
 app.enableSandbox();
 const installationRoot=app.isPackaged?dirname(process.execPath):fileURLToPath(new URL('../../../',import.meta.url));
 const root=selectDesktopRoot({args:process.argv.slice(app.isPackaged?1:2),installationRoot,choose:chooseDesktopRoot});
 if(!root)app.exit(0);
 else{
  // Native selection and every controllable Chromium path are resolved before app.ready.
  for(const cache of desktopCachePaths(root))app.setPath(cache.name,cache.path);
  const assets=new URL('../../../desktop-dist/',import.meta.url);
  void runDesktop({url:new URL('index.html',assets).href,preload:fileURLToPath(new URL('preload.cjs',assets)),spaceRootId:root.id,
   start:policy=>startFoundations({dataRoot:root.path,expectedRootId:root.id,
    trust:{current:()=>undefined,canManage:()=>false,canReadHistory:()=>false},
    space:{},api:{},githubOfficial:{},conversations:true,ai:{bindRead:()=>undefined},localFiles:{coordinateWrites:true},localDirectories:{},
    technicalDiagnostics:{},credentials:{cipher:createWindowsCredentialCipher(safeStorage)},...policy})}).catch(()=>{console.error('desktop_start_failed');app.exit(1);});
 }
}catch(error){
 const reason=error instanceof Error?error.message:'startup_unavailable';
 console.error('desktop_start_failed: '+reason);
 if(app.isPackaged)dialog.showErrorBox('WEXPCeasy 无法打开数据目录','数据目录缺失、格式不兼容、身份不符或路径不可用。已有数据未被清空。请接回原数据目录后重试。');
 app.exit(1);
}
