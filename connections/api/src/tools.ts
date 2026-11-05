import {parseUniqueJson} from './json.js';
import type {Json} from '../../../shared/src/index.js';
import {capture,canonical,closed,object,freeze} from './model.js';
import type {ToolSchema,ToolDefinition,ToolProposal} from './model.js';
const name=(v:unknown):v is string=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,64}$/.test(v);
/** Explicit closed JSON Schema subset; unknown keywords never silently weaken validation. */
export function captureTools(value:unknown):readonly ToolDefinition[]{
 if(value===undefined)return [];
 const definitions=capture(value);if(!Array.isArray(definitions)||definitions.length>64)throw Error('invalid_tool_declarations');let nodes=0;
 const schema=(s:unknown,depth:number):boolean=>{
  if(++nodes>1024||depth>16||!object(s)||typeof s.type!=='string'||(s.description!==undefined&&typeof s.description!=='string'))return false;
  if(s.type==='object')return closed(s,['type','properties','additionalProperties'],['required','description'])&&s.additionalProperties===false&&object(s.properties)&&Object.values(s.properties).every(x=>schema(x,depth+1))&&(s.required===undefined||Array.isArray(s.required)&&s.required.every(k=>typeof k==='string'&&Object.hasOwn(s.properties as object,k))&&new Set(s.required).size===s.required.length);
  if(s.type==='array')return closed(s,['type','items'],['description'])&&schema(s.items,depth+1);
  if(!['string','number','integer','boolean','null'].includes(s.type)||!closed(s,['type'],['enum','description']))return false;
  return s.enum===undefined||Array.isArray(s.enum)&&s.enum.length>0&&s.enum.length<=256&&s.enum.every(v=>v===null?s.type==='null':s.type==='integer'?typeof v==='number'&&Number.isSafeInteger(v):typeof v===s.type)&&new Set(s.enum.map(v=>canonical(v))).size===s.enum.length;
 };
 const names=new Set<string>();for(const d of definitions){if(!closed(d,['name','parameters'],['description'])||!name(d.name)||names.has(d.name)||(d.description!==undefined&&typeof d.description!=='string')||!schema(d.parameters,0)||(d.parameters as {type:string}).type!=='object')throw Error('invalid_tool_declarations');names.add(d.name);}
 return freeze(definitions as unknown as ToolDefinition[]);
}
function matches(value:Json,s:ToolSchema):boolean{
 if(s.type==='object')return object(value)&&Object.keys(value).every(k=>Object.hasOwn(s.properties,k)&&matches(value[k]!,s.properties[k]!))&&(s.required??[]).every(k=>Object.hasOwn(value,k));
 if(s.type==='array')return Array.isArray(value)&&value.every(v=>matches(v,s.items));
 const typed=s.type==='null'?value===null:s.type==='integer'?typeof value==='number'&&Number.isSafeInteger(value):typeof value===s.type;
 return typed&&(!s.enum||s.enum.some(v=>canonical(v)===canonical(value)));
}
function argumentsObject(raw:string):Record<string,Json>{
 let parsed:unknown;try{parsed=parseUniqueJson(raw);}catch(error){
  throw Error(error instanceof Error&&error.message==='duplicate_json_key'?'duplicate_tool_argument':'invalid_tool_arguments');
 }
 try{parsed=capture(parsed);}catch{throw Error('invalid_tool_arguments');}
 if(!object(parsed))throw Error('invalid_tool_arguments');return parsed as Record<string,Json>;
}
export function captureResponseFormat(value:unknown):ToolSchema|null|undefined {
 if(value===undefined)return;
 if(closed(value,['type'])&&value.type==='text')return;
 if(closed(value,['type'])&&value.type==='json_object')return null;
 if(!closed(value,['type','json_schema'])||value.type!=='json_schema'
  ||!closed(value.json_schema,['name','schema','strict'],['description'])||value.json_schema.strict!==true)
  throw Error('invalid_response_format');
 const schema=value.json_schema;
 const declaration={name:schema.name,parameters:schema.schema,
  ...(schema.description===undefined?{}:{description:schema.description})};
 return captureTools([declaration])[0]!.parameters;
}

export function validateStructuredOutput(raw:string,schema:ToolSchema|null):void {
 const value=argumentsObject(raw);
 if(schema!==null&&!matches(value,schema))throw Error('structured_output_schema_mismatch');
}

/** Accumulates wire fragments only; proposals become visible after validated terminal completion. */
export function createToolAccumulator(definitions:readonly ToolDefinition[]){
 const rows:{id:string;name:string;raw:string}[]=[],ids=new Set<string>();let argumentBytes=0;
 return {
  push(value:unknown){
   if(!definitions.length||!Array.isArray(value)||!value.length)throw Error('unexpected_tool_calls');
   const indexes=new Set<number>();for(const v of value){
    if(!closed(v,['index','function'],['id','type'])||!Number.isSafeInteger(v.index)||Number(v.index)<0||Number(v.index)>rows.length||Number(v.index)>=32||indexes.has(Number(v.index))||!object(v.function)||!closed(v.function,[],['name','arguments']))throw Error('invalid_tool_fragment');
    const index=Number(v.index);indexes.add(index);let row=rows[index];
    if(!row){if(typeof v.id!=='string'||!v.id||v.id.length>256||ids.has(v.id)||v.type!=='function')throw Error('invalid_tool_identity');row={id:v.id,name:'',raw:''};rows.push(row);ids.add(v.id);}
    else if(v.id!==undefined||v.type!==undefined)throw Error('duplicate_tool_identity');
    const f=v.function;if(f.name!==undefined){if(typeof f.name!=='string')throw Error('invalid_tool_name');row.name+=f.name;if(row.name.length>64)throw Error('invalid_tool_name');}
    if(f.arguments!==undefined){if(typeof f.arguments!=='string')throw Error('invalid_tool_arguments');argumentBytes+=Buffer.byteLength(f.arguments,'utf8');if(argumentBytes>256*1024)throw Error('tool_argument_limit');row.raw+=f.arguments;}
   }
  },
  finish(reason:unknown):ToolProposal[]{
   if(!rows.length){if(reason!=='stop')throw Error('unsuccessful_response_finish');return [];}
   if(reason!=='tool_calls')throw Error('tool_finish_mismatch');
   return rows.map(row=>{const definition=definitions.find(d=>d.name===row.name);if(!definition)throw Error('undeclared_tool');const args=argumentsObject(row.raw);if(!matches(args,definition.parameters))throw Error('tool_schema_mismatch');return {id:row.id,name:row.name,arguments:args};});
  }
 };
}
