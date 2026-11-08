import type {ApiCommand,ApiConnection,ApiModel,State} from './model.js';
import {endpoint,fail} from './model.js';

type ConfigCommand=Exclude<ApiCommand,{kind:'model.observe'}>;

function expected(value:{revision:number},want:number){
 if(value.revision!==want)fail('revision_conflict');
 if(value.revision===Number.MAX_SAFE_INTEGER)fail('revision_exhausted');
}
function find<T extends {id:string}>(items:T[],id:string):T{
 return items.find(x=>x.id===id)??fail('not_found');
}

/** Pure in-memory configuration change. Service owns authorization, reference leases and durable commits. */
export function applyConfigMutation(next:State,c:ConfigCommand,allocate:()=>string):{id:string;revision:number}{
 switch(c.kind){
  case 'connection.create':{
   const item:ApiConnection={id:allocate(),revision:1,name:c.name,provider:c.provider,protocol:c.protocol,
    endpoint:endpoint(c.endpoint,c.endpointMode),endpointMode:c.endpointMode,credentialRef:c.credentialRef,
    enabled:c.enabled,parameters:c.parameters};
   next.connections.push(item);return item;
  }
  case 'connection.edit':{
   const item=find(next.connections,c.id);expected(item,c.expectedRevision);
   for(const field of ['name','provider','protocol','endpoint','endpointMode','credentialRef','enabled','parameters'] as const)
    if(Object.hasOwn(c,field))Object.assign(item,{[field]:c[field]});
   item.endpoint=endpoint(item.endpoint,item.endpointMode);item.revision++;return item;
  }
  case 'connection.copy':{
   const source=find(next.connections,c.id);
   if(source.revision!==c.expectedRevision)fail('revision_conflict');
   const copy:ApiConnection={...source,id:allocate(),revision:1,name:c.name,credentialRef:null,enabled:false};
   next.connections.push(copy);return copy;
  }
  case 'connection.delete':{
   const item=find(next.connections,c.id);expected(item,c.expectedRevision);
   if(next.models.some(model=>model.connectionId===item.id))fail('resource_referenced');
   next.connections=next.connections.filter(connection=>connection.id!==item.id);
   return {id:item.id,revision:item.revision+1};
  }
  case 'model.delete':{
   const item=find(next.models,c.id);expected(item,c.expectedRevision);
   next.models=next.models.filter(model=>model.id!==item.id);
   return {id:item.id,revision:item.revision+1};
  }
  case 'model.create':{
   find(next.connections,c.connectionId);
   if(next.models.some(m=>m.connectionId===c.connectionId&&m.modelId===c.modelId))fail('duplicate_model_unsupported');
   const item:ApiModel={id:allocate(),revision:1,connectionId:c.connectionId,name:c.name,
    modelId:c.modelId,parameters:c.parameters,observation:null};
   next.models.push(item);return item;
  }
  case 'model.edit':{
   const item=find(next.models,c.id);expected(item,c.expectedRevision);
   if(c.name!==undefined)item.name=c.name;
   if(c.parameters!==undefined)item.parameters=c.parameters;
   item.revision++;return item;
  }
 }
}
