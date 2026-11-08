import {createLocalWriteCoordinator} from './local-write-coordination.js';
import {createCredentialVault} from '../../shared/src/index.js';
import type {CredentialCipher,CredentialBinding} from '../../shared/src/index.js';
import {createLocalDirectoryBindings,createLocalDirectoryReader} from '../../connections/local/src/index.js';
import type {LocalDirectoryReadOptions} from '../../connections/local/src/index.js';
import {createGitHubFileAdapter,createGitHubConfiguredFileReader,createGitHubOfficialClientFactory,createGitHubMcpFileReader,githubCredentialTarget} from '../../connections/github/src/index.js';
import type {GitHubClientFactory,GitHubMcpRuntime,GitHubOfficialClientOptions} from '../../connections/github/src/index.js';
import {createLocalFileBindings,createLocalFileReader,createLocalFileAdapter} from '../../connections/local/src/index.js';
import type {LocalFileBindingOptions} from '../../connections/local/src/index.js';
import {createReadBoundary} from '../../connections/src/index.js';
import {createConversations,createConversationGeneration,inspectConversationStore} from '../../conversations/src/index.js';
import {inspectRoot,directoryLock,openSqliteStore,createPersistedDiagnostics} from '../../shared/src/index.js';
import type {RootLock,ManagedStore,Store,LockResult,PersistedDiagnosticOptions,DiagnosticCode} from '../../shared/src/index.js';
import {createPermissions,inspectPermissionStore} from '../../permissions/src/index.js';
import type {TrustPort,Permissions,Decision} from '../../permissions/src/index.js';
import {createApiService,createApiTransport} from '../../connections/api/src/index.js';
import type {ApiService,ApiOptions,ApiCredentialPort} from '../../connections/api/src/index.js';
import {createOperationLedger} from '../../connections/src/index.js';
import {createConnectionService} from '../../connections/src/index.js';
import type {ConnectionClient,ConfiguredDispatchAdapter,ConfiguredReadAdapter} from '../../connections/src/index.js';
import {openSpaceService} from '../../space/src/index.js';
import type {SpaceService,SpaceOptions} from '../../space/src/index.js';
import {createLocalEntries} from './local-entries.js';
import type {LocalEntryOptions,LocalEntryClient} from './local-entries.js';
import {createAiConfigurations,verifyModelWithApi,inspectAiConfigurationStore} from '../../AI/src/index.js';
import {assemble} from './assembly.js';
import {openDomainStore,closeStores} from './foundation-stores.js';
import {createFoundationCredentialFacade} from './foundation-credential-access.js';
import type {Host,ModuleDiagnostic} from './assembly.js';
export type FoundationTechnicalDiagnostics=Pick<ReturnType<typeof createPersistedDiagnostics>,'read'>&{reportDesktopFailure():{status:'written'|'failed'}};
export type FoundationApiClient=Pick<ApiService,'execute'|'query'|'prepare'|'resolve'>&Pick<ReturnType<typeof createApiTransport>,'send'|'refreshDirectory'|'probeGeneration'>;
export type FoundationLocalFiles=Pick<ReturnType<typeof createLocalFileBindings>,'register'>&ReturnType<typeof createReadBoundary>;
export type FoundationLocalDirectories=Pick<ReturnType<typeof createLocalDirectoryBindings>,'register'>&ReturnType<typeof createReadBoundary>;
export type FoundationCredentials=Pick<ReturnType<typeof createCredentialVault>,'put'|'revoke'|'query'>&{available():boolean};
export interface FoundationOptions {githubOfficial?:{mcpRuntime?:Readonly<GitHubMcpRuntime>;fetch?:typeof globalThis.fetch;timeoutMs?:number};credentials?:{cipher:CredentialCipher};technicalDiagnostics?:PersistedDiagnosticOptions;localDirectories?:LocalDirectoryReadOptions;githubFiles?:{client:GitHubClientFactory};localFiles?:LocalFileBindingOptions&{coordinateWrites?:boolean};conversations?:boolean;ai?:{bindRead(parent:object,scope:{resource:string;action:string;target:string;context:string|null}):object|undefined};api?:ApiOptions&{credentials?:ApiCredentialPort};dataRoot:string;expectedRootId?:string;trust:TrustPort;lock?:RootLock;openStore?:(path:string,namespace:string)=>ManagedStore;connections?:{adapters:readonly ConfiguredDispatchAdapter[];readAdapters?:readonly ConfiguredReadAdapter[];shutdownTimeoutMs?:number};local?:LocalEntryOptions;space?:Pick<SpaceOptions,'owner'|'deriveRequest'|'id'>}
export interface FoundationHost extends Host {readonly credentials?:FoundationCredentials;readonly technicalDiagnostics?:FoundationTechnicalDiagnostics;readonly localDirectories?:FoundationLocalDirectories;readonly localFiles?:FoundationLocalFiles;readonly conversations?:{service:ReturnType<typeof createConversations>;generation?:ReturnType<typeof createConversationGeneration>};readonly ai?:ReturnType<typeof createAiConfigurations>;readonly api?:FoundationApiClient;readonly permissions?:Permissions;readonly connections?:ConnectionClient;readonly space?:SpaceService;readonly local?:LocalEntryClient}
/** No business registry is exposed; callers are trusted main-process code, not Renderer/IPC. */
export async function startFoundations(options:FoundationOptions):Promise<FoundationHost>{
 const probe=await inspectRoot(options.dataRoot,options.expectedRootId);
 if(probe.status!=='available')return Object.freeze({status:'failed',diagnostics:[{module:'shared',reason:'initialization_failed' as const}],stop:async()=>({status:'stopped' as const,failed:[]})});
 let lease:LockResult;
 try{lease=await (options.lock??directoryLock).acquire(probe.root);}catch{lease={status:'unavailable'};}
 if(lease.status!=='acquired')return Object.freeze({status:'failed',diagnostics:[{module:'shared',reason:'initialization_failed' as const}],stop:async()=>({status:'stopped' as const,failed:[]})});
 let credentialVault:ReturnType<typeof createCredentialVault>|undefined,credentials:FoundationCredentials|undefined;
 const credentialStores=new Set<ManagedStore>();
 const credentialManagement=new WeakMap<object,Extract<Decision,{status:'allow'}>>();
 const credentialUses=new WeakMap<object,{decision:Extract<Decision,{status:'allow'}>;reference:{id:string;revision:number};binding:CredentialBinding}>();
 let localDirectories:FoundationLocalDirectories|undefined;
 let localFiles:FoundationLocalFiles|undefined;
 const localFileOrphans=new Set<{close():Promise<void>}>();
 let conversations:FoundationHost['conversations'];
 let ai:FoundationHost['ai'];
 let api:FoundationApiClient|undefined,apiService:ApiService|undefined,apiTransport:ReturnType<typeof createApiTransport>|undefined,apiLedger:ReturnType<typeof createOperationLedger>|undefined;
 let permissions:Permissions|undefined,connections:ConnectionClient|undefined,space:SpaceService|undefined;const release=lease.release;
 const conversationOrphans=new Set<ManagedStore>();
 const open=options.openStore??openSqliteStore,orphans=new Set<ManagedStore>(),spaceOrphans=new Set<ManagedStore>(),apiOrphans=new Set<ManagedStore>(),aiOrphans=new Set<ManagedStore>();
 const local=options.local?createLocalEntries(options.local):undefined;let stopping=false,rootActive=true;
 const technicalStores=new Set<ManagedStore>();
 let technicalLog:ReturnType<typeof createPersistedDiagnostics>|undefined;
 const diagnosticIssues:ModuleDiagnostic[]=[];
 const noteDiagnostic=(reason:ModuleDiagnostic['reason'])=>{
  if(!diagnosticIssues.some(d=>d.reason===reason))diagnosticIssues.push({module:'diagnostics',reason});
 };
 if(options.technicalDiagnostics){
  try{
   const store=await openDomainStore(probe.root,'technical-diagnostics.sqlite','technical-diagnostics',open);
   technicalStores.add(store);technicalLog=createPersistedDiagnostics(store,options.technicalDiagnostics);
  }catch{
   technicalLog=undefined;noteDiagnostic('initialization_failed');
   try{await closeStores(technicalStores);}catch{noteDiagnostic('release_failed');}
  }
 }
 const emitTechnical=(code:DiagnosticCode)=>{
  if(technicalLog?.emit({module:'app',level:'error',code}).status==='failed')noteDiagnostic('diagnostic_write_failed');
 };
 const incompleteRelease=(failed:string)=>{
  emitTechnical('release_failed');
  return {status:'incomplete' as const,failed:[failed]};
 };
 const technicalDiagnostics:FoundationTechnicalDiagnostics|undefined=technicalLog?Object.freeze({
  read(){return stopping||!technicalLog?{status:'unavailable' as const}:technicalLog.read();},
  reportDesktopFailure(){
   if(stopping||!technicalLog)return {status:'failed' as const};
   const result=technicalLog.emit({module:'app',level:'error',code:'renderer_unavailable'});
   if(result.status==='failed')noteDiagnostic('diagnostic_write_failed');return result;
  }
 }):undefined;
 const trust:TrustPort={
  current(request){if(stopping)return;if(local?.owns(request))return local.current(request);const facts=options.trust.current(request);return local&&facts?.kind==='local'?undefined:facts;},
  canManage(change){return !stopping&&options.trust.canManage(change);},
  canReadHistory(request){return !stopping&&options.trust.canReadHistory(request);}
 };
 // Space borrows only this host's acquired public-root lease; Context roots still acquire real locks.
 const spaceLock:RootLock={async acquire(root){
  if(root.path===probe.root.path&&root.id===probe.root.id)return rootActive?{status:'acquired',release:async()=>{}}:{status:'unavailable'};
  return (options.lock??directoryLock).acquire(root);
 }};
 const host=await assemble([
 {id:'shared',requires:[],async start(){
 const store=await openDomainStore(probe.root,'permissions.sqlite','permissions',open);
 return {value:Object.freeze({read:()=>store.read(),commit:(...a:Parameters<Store['commit']>)=>store.commit(...a),query:(intent:string)=>store.query(intent)}),stop:async()=>{store.close();}};
 }},
 {id:'permissions',requires:['shared'],async start(deps){
 const store=deps['shared'] as Store;
 if(inspectPermissionStore(store).status!=='ready')throw Error('permission_storage_unavailable');
 permissions=createPermissions(store,trust);
 return {value:Object.freeze({evaluate:permissions.evaluate,recheck:permissions.recheck}),stop:async()=>{permissions=undefined;}};
 }},
 ...(options.credentials?[{id:'credentials',requires:['permissions'],async start(deps:Readonly<Record<string,unknown>>){
  const permission=deps['permissions'] as Pick<Permissions,'evaluate'|'recheck'>;
  try{
   const db=await openDomainStore(probe.root,'wex-credentials.sqlite','credentials',open);credentialStores.add(db);
   credentialVault=createCredentialVault(db,options.credentials!.cipher,(request,access)=>{
    const decision=access.action==='manage'?credentialManagement.get(request):credentialUses.get(request)?.decision;
    if(!decision||permission.recheck(request,decision).status!=='allow')return false;
    if(access.action==='manage')return decision.scope.resource==='credentials'&&decision.scope.target==='credential:'+access.id&&decision.scope.context===null&&['credential.write','credential.revoke','credential.receipt'].includes(decision.scope.action);
    const use=credentialUses.get(request);
    return !!use&&use.reference.id===access.id&&use.binding.connectionId===access.binding.connectionId&&use.binding.endpoint===access.binding.endpoint&&use.binding.provider===access.binding.provider;
   });
   credentials=createFoundationCredentialFacade(credentialVault,options.credentials!.cipher,permission,credentialManagement,()=>stopping);
   return {value:Object.freeze({available:true}),stop:async()=>{await closeStores(credentialStores);credentialVault=undefined;credentials=undefined;}};
  }catch(error){credentialVault=undefined;credentials=undefined;try{await closeStores(credentialStores);}catch{/* retained for host shutdown retry */}throw error;}
 }}]:[]),
 ...(options.space?[{id:'space',requires:['permissions'],async start(deps:Readonly<Record<string,unknown>>){
  const stores=new Set<ManagedStore>();
  const trackedOpen:NonNullable<SpaceOptions['openStore']>=(path,namespace)=>{
   const db=open(path,namespace);const tracked:ManagedStore={...db,close(){db.close();stores.delete(tracked);}};stores.add(tracked);return tracked;
  };
  try{
   const opened=await openSpaceService({...options.space,dataRoot:probe.root.path,expectedRootId:probe.root.id,permission:deps['permissions'] as Pick<Permissions,'evaluate'|'recheck'>,lock:spaceLock,openStore:trackedOpen,
    ...(options.space!.deriveRequest?{deriveRequest:options.space!.deriveRequest}:local?{deriveRequest:(parent,scope)=>local.client.derive(parent,scope)}:{})});
   if(opened.status!=='ready')throw Error('space_unavailable');space=opened.service;const service=space;
   return {value:service,stop:async()=>{await service.close();await closeStores(stores);space=undefined;}};
  }catch(error){try{await closeStores(stores);}catch{for(const db of stores)spaceOrphans.add(db);}throw error;}
 }}]:[]),
 ...((options.connections||options.api||options.localFiles||options.githubFiles||options.githubOfficial||options.localDirectories)?[{id:'connections',requires:options.githubOfficial?['permissions','credentials']:['permissions'],async start(deps:Readonly<Record<string,unknown>>){
  const stores=new Set<ManagedStore>();
  let files:ReturnType<typeof createLocalFileBindings>|undefined;
  let directories:ReturnType<typeof createLocalDirectoryBindings>|undefined;
  try{
   const configs=await openDomainStore(probe.root,'connections-configs.sqlite','connection-configs',open);stores.add(configs);
   const operations=await openDomainStore(probe.root,'connections-operations.sqlite','connection-operations',open);stores.add(operations);
   const permission=deps['permissions'] as Pick<Permissions,'evaluate'|'recheck'>;
   if(options.localFiles?.coordinateWrites&&options.localFiles.acquireWrite)throw Error('ambiguous_local_write_coordination');
   const coordinator=options.localFiles?.coordinateWrites?createLocalWriteCoordinator():undefined;
   files=options.localFiles?createLocalFileBindings(permission,coordinator?{acquireWrite:coordinator.acquire}:options.localFiles):undefined;
   directories=options.localDirectories?createLocalDirectoryBindings(permission):undefined;
   const directoryReader=directories?createLocalDirectoryReader(directories.resolve,options.localDirectories):undefined;
   if(options.githubOfficial&&options.githubFiles)throw Error('ambiguous_github_profile');
   const resolveCredential:GitHubOfficialClientOptions['resolveCredential']=async(connection,access)=>{
    if(stopping||!credentialVault||!access.check())return;
    const decision=permission.evaluate(access.request);
    if(decision.status!=='allow'||decision.scope.resource!=='github'||!['read','write'].includes(decision.scope.action))return;
    // Inspect the owning service's public configuration rather than trusting connector-supplied metadata.
    const live=service.configs.get(connection.id);
    if(!live||!live.enabled||live.adapter!==connection.adapter||live.endpoint!==connection.endpoint||
     live.credentialRef!==connection.credentialRef)return;
    const target=githubCredentialTarget(live);if(!target||!access.check())return;
    credentialUses.set(access.request,{decision,reference:target.reference,binding:target.binding});
    try{
     const value=credentialVault.resolve(access.request,target.reference,target.binding);
     return value.status==='ok'&&!stopping&&access.check()&&permission.recheck(access.request,decision).status==='allow'
      ?value.secret:undefined;
    }finally{credentialUses.delete(access.request);}
   };
   const official=options.githubOfficial?createGitHubOfficialClientFactory({
    resolveCredential,...(options.githubOfficial.fetch?{fetch:options.githubOfficial.fetch}:{}),
    ...(options.githubOfficial.timeoutMs!==undefined?{timeoutMs:options.githubOfficial.timeoutMs}:{}),
   }):undefined;
   const githubClient=official??options.githubFiles?.client;
   const githubReader=options.githubOfficial?.mcpRuntime?createGitHubMcpFileReader({
    runtime:options.githubOfficial.mcpRuntime,resolveCredential,
    ...(options.githubOfficial.timeoutMs!==undefined?{timeoutMs:options.githubOfficial.timeoutMs}:{}),
   }):githubClient?createGitHubConfiguredFileReader(githubClient):undefined;
   const adapters=[...(options.connections?.adapters??[]),...(files?[createLocalFileAdapter(files.resolve)]:[]),...(githubClient?[createGitHubFileAdapter(githubClient)]:[])];
   const readAdapters=[...(options.connections?.readAdapters??[]),...(githubReader?[githubReader]:[])];
   const service=createConnectionService(permission,configs,operations,adapters,{...(options.connections??{}),readAdapters});
   if(files)localFiles=Object.freeze({register:files.register,read:createReadBoundary(permission,createLocalFileReader(files.resolve)).read});
   if(directories&&directoryReader)localDirectories=Object.freeze({register:directories.register,read:createReadBoundary(permission,directoryReader).read});
   apiLedger=createOperationLedger(operations);
   const dispatch:ConnectionClient['dispatch']=(...args)=>args[0]==='local'&&coordinator
    ?coordinator.dispatch(args[1],args[2],()=>service.operations.read().operations.some(o=>o.connection?.adapterId==='local'&&o.phase!=='observed'),()=>service.dispatch(...args))
    :service.dispatch(...args);
   connections=Object.freeze({configs:service.configs,operations:service.operations,dispatch,read:service.read});
   return {value:connections,stop:async()=>{
    if((await service.stop()).status!=='stopped')throw Error('connections_still_running');
    await files?.close();await directories?.close();
    await closeStores(stores);connections=undefined;localFiles=undefined;localDirectories=undefined;
   }};
  }catch(error){
   localFiles=undefined;localDirectories=undefined;
   if(directories)try{await directories.close();}catch{localFileOrphans.add(directories);}
   if(files)try{await files.close();}catch{localFileOrphans.add(files);}
   try{await closeStores(stores);}catch{for(const store of stores)orphans.add(store);}
   throw error;
  }
 }}]:[]),
 ...(options.api?[{id:'api',requires:options.credentials?['permissions','connections','credentials']:['permissions','connections'],async start(deps:Readonly<Record<string,unknown>>){
  const stores=new Set<ManagedStore>();
  try{
   const store=await openDomainStore(probe.root,'api-configurations.sqlite','api-configurations',open);stores.add(store);
   const permission=deps['permissions'] as Pick<Permissions,'evaluate'|'recheck'>;
   const derive=options.api!.deriveRequest??(local?((parent:object,scope:{action:string;target:string;context:string|null})=>local.client.derive(parent,scope)):undefined);
   const service=createApiService(store,permission,{...options.api,readProbeOperation:id=>apiLedger?.get(id),...(derive?{deriveRequest:derive}:{})});
   if(!apiLedger)throw Error('operation_ledger_unavailable');
   const vaultPort:ApiCredentialPort|undefined=options.credentials?{resolve(request,binding){
    if(stopping||!credentialVault)return;
    const decision=permission.evaluate(request);
    if(decision.status!=='allow'||decision.scope.resource!=='connections/api'||!['request.send','model.probe','directory.refresh'].includes(decision.scope.action))return;
    const readConnection=derive?.(request,{action:'connection.read',target:'connection:'+binding.connectionId,context:null});if(!readConnection)return;
    const read=service.query(readConnection,{kind:'connection',id:binding.connectionId});
    if(read.status!=='ok'||Array.isArray(read.value)||!('endpoint'in read.value))return;
    const connection=read.value;
    if(connection.id!==binding.connectionId||connection.revision!==binding.connectionRevision||connection.provider!==binding.provider||connection.credentialRef?.id!==binding.reference.id||connection.credentialRef.revision!==binding.reference.revision)return;
    if(decision.scope.action==='directory.refresh'){if(decision.scope.target!=='connection:'+connection.id)return;}
    else{
     if(!decision.scope.target.startsWith('model:'))return;
     const modelId=decision.scope.target.slice(6),r=derive?.(request,{action:'model.read',target:'model:'+modelId,context:null});if(!r)return;
     const model=service.query(r,{kind:'model',id:modelId});
     if(model.status!=='ok'||Array.isArray(model.value)||!('connectionId'in model.value)||model.value.connectionId!==connection.id)return;
    }
    const route=new URL(connection.endpoint);
    if(connection.endpointMode==='base')route.pathname=route.pathname.replace(/\/$/,'')+(decision.scope.action==='directory.refresh'?'/models':'/chat/completions');
    if(route.href!==binding.endpoint)return;
    const destination={connectionId:connection.id,endpoint:connection.endpoint,provider:connection.provider};
    credentialUses.set(request,{decision,reference:binding.reference,binding:destination});
    try{const value=credentialVault.resolve(request,binding.reference,destination);return value.status==='ok'?value.secret:undefined;}
    finally{credentialUses.delete(request);}
   }}:undefined;
   const credentialPort=options.api?.credentials??vaultPort;
   const transport=createApiTransport(service,permission,apiLedger,{...(credentialPort?{credentials:credentialPort}:{}),derivePrepareRequest(parent){
    const decision=permission.evaluate(parent);if(decision.status!=='allow')return;
    return derive?.(parent,{action:'request.prepare',target:decision.scope.target,context:decision.scope.context});
   }});
   apiService=service;apiTransport=transport;
   api=Object.freeze({execute:service.execute,query:service.query,prepare:service.prepare,resolve:service.resolve,send:transport.send,refreshDirectory:transport.refreshDirectory,probeGeneration:transport.probeGeneration});
   return {value:api,stop:async()=>{service.stop();await transport.stop();await closeStores(stores);api=undefined;}};
  }catch(error){try{await closeStores(stores);}catch{for(const db of stores)apiOrphans.add(db);}throw error;}
 }}]:[]),
 ...(options.conversations?[{id:'conversations',requires:options.api?['permissions','api']:['permissions'],async start(deps:Readonly<Record<string,unknown>>){
  const permission=deps['permissions'] as Permissions;
  const store=await openDomainStore(probe.root,'conversations.sqlite','conversations',open);
  const stores=new Set([store]);
  try{
  if(inspectConversationStore(store).status!=='ready')throw Error('conversation_storage_unavailable');
  const service=createConversations(store,(request,action,id)=>{
   const decision=permission.evaluate(request);
   return decision.status==='allow'&&decision.scope.resource==='conversations'&&
    decision.scope.action===action&&decision.scope.target==='conversation:'+id;
  });
  const sender=deps['api'] as FoundationApiClient|undefined;
  const client=Object.freeze({service,...(sender?{generation:createConversationGeneration(service,sender,(request,id)=>{
   const decision=permission.evaluate(request);
   if(decision.status!=='allow'||decision.scope.resource!=='conversations'||
      decision.scope.action!=='receipt.read'||decision.scope.target!=='operation:'+id)return;
   const operation=apiLedger?.get(id);
   const result=operation?.observations.find(item=>item.id==='api-result'&&item.phase==='observed')?.value;
   if(permission.recheck(request,decision).status!=='allow'||!result||typeof result!=='object'||Array.isArray(result))return;
   if(typeof result.requestId==='string'&&typeof result.text==='string')return {requestId:result.requestId,text:result.text};
  })}:{})});
  conversations=client;
  return {value:client,stop:async()=>{await closeStores(stores);conversations=undefined;}};
  }catch(error){
   conversations=undefined;
   try{await closeStores(stores);}catch{for(const db of stores)conversationOrphans.add(db);}
   throw error;
  }
 }}]:[]),
 ...(options.ai?[{id:'ai',requires:options.api?['permissions','api']:['permissions'],async start(deps:Readonly<Record<string,unknown>>){
  const permission=deps['permissions'] as Permissions;
  const bindRead=options.ai!.bindRead;
  const scopedRead=(parent:object,scope:{resource:string;action:string;target:string;context:string|null})=>{
   const before=permission.evaluate(parent);
   if(before.status!=='allow'||before.scope.resource!=='AI')return;
   const request=bindRead(parent,scope);
   if(!request)return;
   const read=permission.evaluate(request);
   if(read.status!=='allow'||read.scope.resource!==scope.resource||read.scope.action!==scope.action||
      read.scope.target!==scope.target||read.scope.context!==scope.context)return;
   const identity=['subject','entry','conversation','relationship','relationshipGeneration'] as const;
   if(identity.some(key=>read.scope[key]!==before.scope[key]))return;
   if(permission.recheck(parent,before).status==='allow')return request;
  };
  const store=await openDomainStore(probe.root,'ai-configurations.sqlite','ai-configurations',open);
  const stores=new Set([store]);
  try{
  if(inspectAiConfigurationStore(store).status!=='ready')throw Error('ai_storage_unavailable');
  const apiClient=deps['api'] as FoundationApiClient|undefined;
  const configurations=createAiConfigurations(store,(request,access)=>{
   const decision=permission.evaluate(request);
   if(decision.status!=='allow'||decision.scope.resource!=='AI')return false;
   const target=access.kind+':'+access.id;
   const action=access.kind+'.'+access.action;
   if(decision.scope.action===action&&decision.scope.target===target)return true;
   if(access.action==='read'&&((decision.scope.action==='agent.write'&&access.kind!=='agent')||
    (decision.scope.action===access.kind+'.list'&&decision.scope.target===access.kind+':*'))){
    return scopedRead(request,{resource:'AI',action,target,context:decision.scope.context})!==undefined;
   }
   return false;
  },apiClient?verifyModelWithApi(apiClient,(parent,id)=>scopedRead(parent,{
   resource:'connections/api',action:'model.read',target:'model:'+id,context:null
  })):undefined);
  const client=Object.freeze({...configurations,
   list(request:object,kind:Parameters<typeof configurations.list>[1]){
    if(!['role','position','agent'].includes(kind))return {status:'denied' as const};
    const before=permission.evaluate(request);
    if(before.status!=='allow'||before.scope.resource!=='AI'||before.scope.action!==kind+'.list'||
     before.scope.target!==kind+':*')return {status:'denied' as const};
    const result=configurations.list(request,kind);
    // The public recheck fences every row against the same authorization revision and identity.
    return permission.recheck(request,before).status==='allow'?result:{status:'denied' as const};
   }
  });
  ai=client;
  return {value:client,stop:async()=>{await closeStores(stores);ai=undefined;}};
  }catch(error){
   ai=undefined;
   try{await closeStores(stores);}catch{for(const db of stores)aiOrphans.add(db);}
   throw error;
  }
 }}]:[])
 ],{required:['shared','permissions'],timeoutMs:1000});
 for(const diagnostic of host.diagnostics)emitTechnical(diagnostic.reason==='release_failed'?'release_failed':'module_unavailable');
 let stopPromise:ReturnType<Host['stop']>|undefined;
 const stop=()=>{
 stopping=true;local?.stop();apiService?.stop();
 // Eagerly signal cancellation, but let the owned module's awaited stop report release failure.
 void apiTransport?.stop().catch(()=>{});
 if(stopPromise)return stopPromise;
 const job=(async()=>{
 const result=await host.stop();
 // Keep root occupied when provider shutdown cannot confirm release.
 if(result.status==='incomplete'){emitTechnical('release_failed');return result;}
 try{for(const files of localFileOrphans){await files.close();localFileOrphans.delete(files);}}catch{return incompleteRelease('local-files');}
 try{await closeStores(orphans);}catch{return incompleteRelease('connections-storage');}
 try{await closeStores(apiOrphans);}catch{return incompleteRelease('api-storage');}
 try{await closeStores(conversationOrphans);}catch{return incompleteRelease('conversations-storage');}
 try{await closeStores(aiOrphans);}catch{return incompleteRelease('ai-storage');}
 try{await closeStores(spaceOrphans);}catch{return incompleteRelease('space-storage');}
 try{await closeStores(credentialStores);credentialVault=undefined;credentials=undefined;}catch{return incompleteRelease('credentials-storage');}
 try{await closeStores(technicalStores);}catch{noteDiagnostic('release_failed');return {status:'incomplete' as const,failed:['diagnostics-storage']};}
 technicalLog=undefined;
 try{await release();rootActive=false;return result;}catch{return {status:'incomplete' as const,failed:['root-lock']};}
 })();
 stopPromise=job;void job.then(result=>{if(result.status==='incomplete')stopPromise=undefined;});return job;
 };
 if(host.status==='failed')await stop();
 const current=permissions,currentConnections=connections,currentSpace=space,currentApi=api;
 return Object.freeze({...host,
 get status(){return host.status==='ready'&&diagnosticIssues.length?'degraded' as const:host.status;},
 get diagnostics(){return Object.freeze([...host.diagnostics,...diagnosticIssues].map(d=>Object.freeze({...d})));},
 ...(credentials?{credentials}:{}),...(technicalDiagnostics?{technicalDiagnostics}:{}),...(localDirectories?{localDirectories}:{}),...(localFiles?{localFiles}:{}),...(conversations?{conversations}:{}),...(ai?{ai}:{}),...(currentApi?{api:currentApi}:{}),...(current?{permissions:current}:{}),...(currentConnections?{connections:currentConnections}:{}),...(currentSpace?{space:currentSpace}:{}),...(local&&host.status!=='failed'?{local:local.client}:{}),stop});
}
