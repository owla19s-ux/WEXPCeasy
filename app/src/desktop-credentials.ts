import type {CredentialCipher} from '../../shared/src/index.js';
export interface WindowsSecretStorage {
 isEncryptionAvailable():boolean;
 encryptString(value:string):Buffer;
 decryptString(value:Buffer):string;
}
/** Electron 45's documented Windows DPAPI backend only. Main-process technical port, never Renderer IPC.
 * Do not infer Linux basic_text or an unrecognized platform to be system credential protection.
 */
export function createWindowsCredentialCipher(storage:WindowsSecretStorage,platform:string=process.platform):CredentialCipher{
 const available=()=>{try{return platform==='win32'&&storage.isEncryptionAvailable()===true;}catch{return false;}};
 return Object.freeze({available,
  seal(value:string){
   if(!available()||typeof value!=='string'||!value||value.length>131072)throw Error('credential_backend_unavailable');
   const encrypted=storage.encryptString(value);
   if(!Buffer.isBuffer(encrypted)||!encrypted.length||!available())throw Error('credential_backend_unavailable');
   return encrypted.toString('base64');
  },
  unseal(value:string){
   if(!available()||typeof value!=='string'||!value||value.length>262144||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))throw Error('credential_ciphertext_unavailable');
   const encrypted=Buffer.from(value,'base64');if(encrypted.toString('base64')!==value)throw Error('credential_ciphertext_unavailable');
   const result=storage.decryptString(encrypted);
   if(typeof result!=='string'||!available())throw Error('credential_backend_unavailable');
   return result;
  }
 });
}
