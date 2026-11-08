import {createGitHubMcpAdapter} from './mcp.js';
import type {GitHubMcpAdapterOptions} from './mcp.js';
import type {AdapterAccess,ConnectionConfig,ConfiguredCapabilityAdapter} from '../../src/index.js';
import type {Json} from '../../../shared/src/index.js';
type Session=ReturnType<typeof createGitHubMcpAdapter>;
/** Connection-owned MCP sessions. Each invocation supplies a fresh ephemeral authorization lease.
 * Serialization covers start/rebind plus the full call, not just individual SDK requests.
 */
export function createGitHubMcpConnectionAdapter(options:GitHubMcpAdapterOptions):ConfiguredCapabilityAdapter{
 // Validate trusted runtime options before accepting the adapter into the host.
 const first=createGitHubMcpAdapter(options);let unused:Session|undefined=first;
 const sessions=new Map<string,{core:Session;connection:Readonly<ConnectionConfig>;tail:Promise<unknown>}>();
 let stopping=false;
 function run(connection:Readonly<ConnectionConfig>,access:AdapterAccess,work:(core:Session)=>Promise<unknown>,signal?:AbortSignal):Promise<Json>{
  const captured=Object.freeze({...connection});
  if(stopping||!access.check())return Promise.reject(Error('github_mcp_unavailable'));
  let session=sessions.get(captured.id);
  if(!session){
   session={core:unused??createGitHubMcpAdapter(options),connection:captured,tail:Promise.resolve()};
   unused=undefined;sessions.set(captured.id,session);
  }
  const slot=session;
  const job=slot.tail.then(async()=>{
   if(stopping||!access.check())throw Error('github_mcp_unavailable');
   if(slot.core.status().state==='error'||JSON.stringify(slot.connection)!==JSON.stringify(captured))
    await slot.core.stop();
   await slot.core.start(captured,access,signal);slot.connection=captured;
   const value=await work(slot.core);
   if(!access.check())throw Error('github_mcp_unavailable');
   // MCP is JSON; retain all protocol fields without narrowing to file-shaped results.
   return JSON.parse(JSON.stringify(value)) as Json;
  });
  slot.tail=job.catch(()=>{});return job;
 }
 return Object.freeze({
  id:'github',version:'0.1.1',
  discover(connection:Readonly<ConnectionConfig>,signal:AbortSignal,access:AdapterAccess):Promise<Json>{
   return run(connection,access,core=>core.listTools(signal),signal);
  },
  invoke(connection:Readonly<ConnectionConfig>,name:string,args:Readonly<Record<string,Json>>,access:AdapterAccess):Promise<Json>{
   const captured=structuredClone(args);
   return run(connection,access,core=>core.callTool(name,captured));
  },
  async stop():Promise<void>{
   stopping=true;
   const results=await Promise.allSettled([...sessions.values()].flatMap(slot=>[slot.core.stop(),slot.tail]));
   if(results.some(r=>r.status==='rejected'))throw Error('github_mcp_release_unconfirmed');
   sessions.clear();
  },
 });
}
