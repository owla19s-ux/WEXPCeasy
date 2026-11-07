import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {join} from 'node:path';
import type {LocalHandle,LocalStat} from './file-capability.js';
/** Fixed native implementation, not a shell/command API. Selection arguments travel as JSON on stdin.
 * OPEN_REPARSE_POINT prevents following a replaced final component; directory enumeration uses the
 * same handle (NtQueryDirectoryFile), never a path-based Get-ChildItem/readdir fallback.
 */
const source=String.raw`
using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using Microsoft.Win32.SafeHandles;
public class WexSelectedHandle : IDisposable {
 [StructLayout(LayoutKind.Sequential)] struct Info {
  public uint Attributes; public System.Runtime.InteropServices.ComTypes.FILETIME Creation,Access,Write;
  public uint Volume,SizeHigh,SizeLow,Links,IndexHigh,IndexLow;
 }
 [StructLayout(LayoutKind.Sequential)] struct IOStatus { public IntPtr Status,Information; }
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]
 static extern SafeFileHandle CreateFileW(string path,uint access,uint share,IntPtr security,uint disposition,uint flags,IntPtr template);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetFileInformationByHandle(SafeFileHandle h,out Info info);
 [DllImport("ntdll.dll")] static extern int NtQueryDirectoryFile(SafeFileHandle h,IntPtr ev,IntPtr apc,IntPtr ctx,out IOStatus status,IntPtr buffer,uint length,int infoClass,[MarshalAs(UnmanagedType.U1)] bool single,IntPtr name,[MarshalAs(UnmanagedType.U1)] bool restart);
 SafeFileHandle handle; FileStream stream; bool directory,started;
 public WexSelectedHandle(string path,string kind,string mode) {
  directory=kind=="directory";
  if(!Path.IsPathRooted(path)||(kind!="file"&&!directory)||(mode!="read"&&mode!="write")||(directory&&mode!="read"))throw new IOException();
  // Share reads/writes but deny deletion/rename while this selected identity is open.
  handle=CreateFileW(path,mode=="write"?0xC0000000u:0x80000000u,3,IntPtr.Zero,3,0x02200000u,IntPtr.Zero);
  if(handle.IsInvalid){handle.Dispose();throw new IOException();}
  try {
   Info info;if(!GetFileInformationByHandle(handle,out info)||(info.Attributes&0x400)!=0||((info.Attributes&0x10)!=0)!=directory)throw new IOException();
   if(!directory)stream=new FileStream(handle,mode=="write"?FileAccess.ReadWrite:FileAccess.Read,4096,false);
  } catch { handle.Dispose();throw; }
 }
 static string T(System.Runtime.InteropServices.ComTypes.FILETIME t){return (((long)(uint)t.dwHighDateTime<<32)|(uint)t.dwLowDateTime).ToString();}
 public string[] Stat(){
  Info i;if(!GetFileInformationByHandle(handle,out i))throw new IOException();
  return new string[]{i.Volume.ToString(),(((ulong)i.IndexHigh<<32)|i.IndexLow).ToString(),(((ulong)i.SizeHigh<<32)|i.SizeLow).ToString(),T(i.Write),T(i.Creation),directory?"directory":"file"};
 }
 public string Read(int length,long offset){if(directory||length<0||length>1048576||offset<0)throw new IOException();stream.Position=offset;byte[] b=new byte[length];int n=stream.Read(b,0,length);return Convert.ToBase64String(b,0,n);}
 public int Write(string value,long offset){if(directory||offset<0)throw new IOException();byte[] b=Convert.FromBase64String(value);if(b.Length>1048576)throw new IOException();stream.Position=offset;stream.Write(b,0,b.Length);return b.Length;}
 public void Truncate(long length){if(directory||length<0||length>1048576)throw new IOException();stream.SetLength(length);}
 public void Sync(){if(directory)throw new IOException();stream.Flush(true);}
 public string[] Next(){
  if(!directory)throw new IOException();
  IntPtr buffer=Marshal.AllocHGlobal(65536);
  try {
   for(;;){
    IOStatus ios;int status=NtQueryDirectoryFile(handle,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero,out ios,buffer,65536,1,true,IntPtr.Zero,!started);started=true;
    if(status==unchecked((int)0x80000006))return null;
    if(status!=0)throw new IOException();
    long bytes=ios.Information.ToInt64();int length=Marshal.ReadInt32(buffer,60);
    if(bytes<64||length<0||length%2!=0||length>bytes-64)throw new IOException();
    string name=Marshal.PtrToStringUni(IntPtr.Add(buffer,64),length/2);
    if(name=="."||name=="..")continue;
    uint attrs=(uint)Marshal.ReadInt32(buffer,56);
    return new string[]{name,(attrs&0x400)!=0?"symlink":(attrs&0x10)!=0?"directory":"file"};
   }
  }finally{Marshal.FreeHGlobal(buffer);}
 }
 public void Dispose(){if(stream!=null){stream.Dispose();stream=null;}if(handle!=null){handle.Dispose();}}
}
`;
const script="$ErrorActionPreference='Stop'; [Console]::InputEncoding=[Text.Encoding]::UTF8; [Console]::OutputEncoding=New-Object Text.UTF8Encoding($false); Add-Type -TypeDefinition @'\n"+source+"\n'@; $selected=$null; try { while($line=[Console]::ReadLine()){ $r=$line|ConvertFrom-Json; try { $value=$null; switch($r.op){ 'open' {if($selected){throw 'already_open'}; $selected=[WexSelectedHandle]::new([string]$r.path,[string]$r.kind,[string]$r.mode)} 'stat' {$value=@($selected.Stat())} 'read' {$value=$selected.Read([int]$r.length,[long]$r.offset)} 'write' {$value=$selected.Write([string]$r.value,[long]$r.offset)} 'truncate' {$selected.Truncate([long]$r.length)} 'sync' {$selected.Sync()} 'next' {$value=$selected.Next();if($null -ne $value){$value=@($value)}} 'close' {$selected.Dispose();$selected=$null} default {throw 'invalid_operation'} }; [Console]::WriteLine((@{id=$r.id;ok=$true;value=$value}|ConvertTo-Json -Compress -Depth 4)); if($r.op -eq 'close'){break} } catch { [Console]::WriteLine((@{id=$r.id;ok=$false}|ConvertTo-Json -Compress)) } } } finally {if($selected){$selected.Dispose()}}";
export async function openWindowsSelection(path:string,kind:'file'|'directory',mode:'read'|'write'):Promise<LocalHandle>{
 if(process.platform!=='win32')throw Error('windows_handle_unavailable');
 const child=spawn(join(process.env['SystemRoot']??'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{stdio:['pipe','pipe','pipe'],windowsHide:true});
 let sequence=0,ended=false,closed=false;
 const pending=new Map<number,{resolve:(v:unknown)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
 function fail(){for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('windows_handle_unavailable'));}pending.clear();}
 const exited=new Promise<void>(resolve=>child.once('close',()=>{ended=true;fail();resolve();}));
 child.on('error',()=>{ended=true;fail();});child.stdin.on('error',fail);
 child.stderr.resume();
 const lines=createInterface({input:child.stdout,crlfDelay:Infinity});
 lines.on('line',line=>{
  if(line.length>2*1024*1024){fail();child.kill();return;}
  try{const reply=JSON.parse(line) as {id:number;ok:boolean;value:unknown};const p=pending.get(reply.id);if(!p)return;clearTimeout(p.timer);pending.delete(reply.id);
   if(reply.ok===true)p.resolve(reply.value);else p.reject(Error('windows_handle_unavailable'));
  }catch{fail();child.kill();}
 });
 const request=(op:string,extra:Record<string,unknown>={}):Promise<unknown>=>new Promise((resolve,reject)=>{
  if(ended){reject(Error('windows_handle_unavailable'));return;}
  const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error('windows_handle_timeout'));child.kill();},20000);
  pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({id,op,...extra})+'\n');
 });
 try{await request('open',{path,kind,mode});}catch(e){child.kill();await exited;throw e;}
 const handle:LocalHandle={fd:-1,
  async stat(){
   const data=await request('stat');if(!Array.isArray(data)||data.length!==6||!data.every(v=>typeof v==='string'))throw Error('windows_identity_unavailable');
   const [dev,ino,size,mtime,ctime,type]=data as string[];
   return {dev:BigInt(dev!),ino:BigInt(ino!),size:BigInt(size!),mtimeNs:BigInt(mtime!)*100n,ctimeNs:BigInt(ctime!)*100n,isFile:()=>type==='file',isDirectory:()=>type==='directory'} satisfies LocalStat;
  },
  async read(buffer,offset,length,position){
   const value=await request('read',{length,offset:position});if(typeof value!=='string')throw Error('windows_read_unavailable');
   const bytes=Buffer.from(value,'base64');if(bytes.length>length)throw Error('windows_read_unavailable');bytes.copy(buffer,offset);return {bytesRead:bytes.length};
  },
  async write(buffer,offset,length,position){
   const value=await request('write',{value:buffer.subarray(offset,offset+length).toString('base64'),offset:position});if(!Number.isSafeInteger(value)||Number(value)<0||Number(value)>length)throw Error('windows_write_unavailable');return {bytesWritten:Number(value)};
  },
  async truncate(length){await request('truncate',{length});},async sync(){await request('sync');},
  async readDirectory(){
   const value=await request('next');if(value===null)return null;
   if(!Array.isArray(value)||value.length!==2||typeof value[0]!=='string'||!['file','directory','symlink','other'].includes(String(value[1])))throw Error('windows_directory_unavailable');
   return {name:value[0],kind:value[1] as 'file'|'directory'|'symlink'|'other'};
  },
  async close(){
   if(closed)return;
   if(!ended)await request('close');
   await exited;closed=true;lines.close();
  }
 };
 return handle;
}
