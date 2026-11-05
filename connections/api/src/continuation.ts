import type {Scope} from '../../../permissions/src/index.js';
import type {ApiConnection,ApiModel,ChatWireMessage,ToolProposal} from './model.js';
import {canonical,capture,closed,fail,object,text} from './model.js';

/** Supplied by the trusted conversation owner after checking the source generation and tool receipts. */
export interface ToolRound {
 scope:Scope;
 sourceRequestId:string;
 connectionId:string;
 connectionRevision:number;
 modelId:string;
 modelRevision:number;
 assistantText:string;
 reasoning?:string;
 calls:readonly ToolProposal[];
 results:readonly {id:string;content:string}[];
}

export type ToolRoundReader=(request:object,reference:string)=>ToolRound|readonly ToolRound[]|undefined;

function encodeRound(
 raw:unknown,scope:Scope,requestId:string,connection:ApiConnection,model:ApiModel
):{sourceRequestId:string;messages:ChatWireMessage[]} {
 const round=capture(raw);
 if(!closed(round,['scope','sourceRequestId','connectionId','connectionRevision','modelId','modelRevision','assistantText','calls','results'],['reasoning'])
  ||!scope.conversation||canonical(round.scope)!==canonical(scope)||!text(round.sourceRequestId)||round.sourceRequestId===requestId
  ||round.connectionId!==connection.id||round.connectionRevision!==connection.revision
  ||round.modelId!==model.id||round.modelRevision!==model.revision)
  return fail('tool_continuation_binding_mismatch');
 if(typeof round.assistantText!=='string'||!Array.isArray(round.calls)||!Array.isArray(round.results)
  ||round.calls.length<1||round.calls.length>32||round.results.length!==round.calls.length)
  return fail('invalid_tool_continuation');
 if(round.reasoning!==undefined&&(typeof round.reasoning!=='string'||connection.provider!=='deepseek'||model.observation?.capabilities.reasoning!=='supported'))
  return fail('invalid_reasoning_continuation');

 const results=new Map<string,string>();
 for(const result of round.results){
  if(!closed(result,['id','content'])||!text(result.id)||typeof result.content!=='string'||results.has(result.id))
   return fail('invalid_tool_continuation');
  results.set(result.id,result.content);
 }
 const calls:Extract<ChatWireMessage,{role:'assistant';tool_calls:unknown}>['tool_calls']=[];
 const outputs:ChatWireMessage[]=[];
 for(const call of round.calls){
  if(!closed(call,['id','name','arguments'])||!text(call.id)||call.id.length>256
   ||typeof call.name!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(call.name)||!object(call.arguments)||!results.has(call.id))
   return fail('invalid_tool_continuation');
  calls.push({id:call.id,type:'function',function:{name:call.name,arguments:canonical(call.arguments)}});
  outputs.push({role:'tool',tool_call_id:call.id,content:results.get(call.id)!});
  results.delete(call.id);
 }
 return {sourceRequestId:round.sourceRequestId,messages:[
  {role:'assistant',content:round.assistantText,tool_calls:calls,...(round.reasoning===undefined?{}:{reasoning_content:round.reasoning as string})},
  ...outputs
 ]};
}


/** The owner supplies consecutive rounds in chronological order for the current generation. */
export function encodeToolRound(
 raw:unknown,scope:Scope,requestId:string,connection:ApiConnection,model:ApiModel
):{sourceRequestId:string;messages:ChatWireMessage[]} {
 const rounds=Array.isArray(raw)?raw:[raw];
 if(!rounds.length||rounds.length>16)return fail('invalid_tool_continuation');
 const sources=new Set<string>();
 const messages:ChatWireMessage[]=[];
 let sourceRequestId='';
 for(const round of rounds){
  const encoded=encodeRound(round,scope,requestId,connection,model);
  sourceRequestId=encoded.sourceRequestId;
  if(sources.has(sourceRequestId))return fail('duplicate_tool_continuation_source');
  sources.add(sourceRequestId);
  messages.push(...encoded.messages);
 }
 return {sourceRequestId,messages};
}
