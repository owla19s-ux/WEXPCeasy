import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import type {RootChoice} from './desktop-root.js';
const script=String.raw`
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object Text.UTF8Encoding($false)
Add-Type -AssemblyName System.Windows.Forms
$reason=[Console]::ReadLine()
$intro=if($reason -eq 'recovery'){'原数据目录或定位记录不可用。请选择接回原目录，或明确创建新的空白数据目录。已有数据不会被覆盖。'}else{'请选择 WEX 公共数据目录。数据目录与程序安装目录分别保存，卸载程序默认保留数据。'}
$mode=[Windows.Forms.MessageBox]::Show($intro+[Environment]::NewLine+'是：打开已有 WEX 数据目录。否：创建新的空白数据目录。取消：退出。','WEXPCeasy 数据目录',[Windows.Forms.MessageBoxButtons]::YesNoCancel,[Windows.Forms.MessageBoxIcon]::Question)
if($mode -eq [Windows.Forms.DialogResult]::Cancel){exit 2}
$picker=New-Object Windows.Forms.FolderBrowserDialog
$picker.Description='选择独立的数据目录（新目录必须为空；已有目录须有 WEX 标记）'
$picker.ShowNewFolderButton=$true
if($picker.ShowDialog() -ne [Windows.Forms.DialogResult]::OK){$picker.Dispose();exit 2}
$path=$picker.SelectedPath
$picker.Dispose()
$create=$mode -eq [Windows.Forms.DialogResult]::No
if($create -and [Windows.Forms.MessageBox]::Show('确认在所选空目录中初始化新的 WEX 数据？不会导入、迁移或删除外部文件。','WEXPCeasy 确认',[Windows.Forms.MessageBoxButtons]::YesNo,[Windows.Forms.MessageBoxIcon]::Question) -ne [Windows.Forms.DialogResult]::Yes){exit 2}
[Console]::WriteLine((@{path=$path;create=$create}|ConvertTo-Json -Compress))
`;
/** Windows OS picker runs synchronously before Electron ready/cache initialization. No Renderer path input. */
export function chooseDesktopRoot(reason:'first-run'|'recovery'):RootChoice|undefined{
 if(process.platform!=='win32')throw Error('data_root_argument_required');
 const executable=join(process.env['SystemRoot']??'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
 const result=spawnSync(executable,['-NoLogo','-NoProfile','-NonInteractive','-STA','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{input:reason+'\n',encoding:'utf8',windowsHide:true,maxBuffer:65536});
 if(result.status===2)return;
 if(result.error||result.status!==0)throw Error('native_root_picker_unavailable');
 const value:unknown=JSON.parse(result.stdout.trim());
 if(!value||typeof value!=='object'||Array.isArray(value)||typeof (value as RootChoice).path!=='string'||typeof (value as RootChoice).create!=='boolean')throw Error('invalid_native_root_selection');
 return {path:(value as RootChoice).path,create:(value as RootChoice).create};
}
