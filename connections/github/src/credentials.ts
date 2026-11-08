import type {ConnectionConfig} from '../../src/index.js';
import type {CredentialReference,CredentialBinding} from '../../../shared/src/index.js';

function capture(connection:Readonly<ConnectionConfig>):Readonly<ConnectionConfig> {
 if(connection.adapter!=='github'||connection.endpoint!=='https://api.github.com'||!connection.enabled)throw Error('github_connection_unavailable');
 return Object.freeze({...connection});
}

/** Opaque config metadata only: an exact vault reference, never a Key or implicit latest revision. */
export function githubCredentialRef(reference:Readonly<CredentialReference>):string {
 if(!reference||typeof reference.id!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(reference.id)||
  !Number.isSafeInteger(reference.revision)||reference.revision<1)throw Error('invalid_github_credential_reference');
 return 'github-credential:'+JSON.stringify([reference.id,reference.revision]);
}
/** Trusted host binding facts derived from this connector's canonical configuration. */
export function githubCredentialTarget(connection:Readonly<ConnectionConfig>):{
 reference:Readonly<CredentialReference>;binding:Readonly<CredentialBinding>
}|undefined {
 try{
  const current=capture(connection);
  if(typeof current.id!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(current.id)||
   typeof current.credentialRef!=='string'||!current.credentialRef.startsWith('github-credential:'))return;
  const fields:unknown=JSON.parse(current.credentialRef.slice('github-credential:'.length));
  if(!Array.isArray(fields)||fields.length!==2)return;
  const reference={id:fields[0],revision:fields[1]} as CredentialReference;
  if(githubCredentialRef(reference)!==current.credentialRef)return;
  return Object.freeze({reference:Object.freeze(reference),
   binding:Object.freeze({connectionId:current.id,endpoint:current.endpoint,provider:'github'})});
 }catch{return;}
}
