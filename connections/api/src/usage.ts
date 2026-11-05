import {object} from './model.js';

export type ChatUsage = {
 inputTokens:number;
 outputTokens:number;
 totalTokens:number;
 cachedInputTokens?:number;
 reasoningOutputTokens?:number;
};

function count(value:unknown):number {
 if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0)throw Error('invalid_provider_usage');
 return value;
}

function detail(value:unknown,key:string):number|undefined {
 if(value===undefined||value===null)return;
 if(!object(value))throw Error('invalid_provider_usage');
 return value[key]===undefined?undefined:count(value[key]);
}

export function decodeUsage(value:unknown):ChatUsage {
 if(!object(value))throw Error('invalid_provider_usage');
 const inputTokens=count(value.prompt_tokens);
 const outputTokens=count(value.completion_tokens);
 const totalTokens=count(value.total_tokens);
 const nestedCache=detail(value.prompt_tokens_details,'cached_tokens');
 const vendorCache=value.prompt_cache_hit_tokens===undefined?undefined:count(value.prompt_cache_hit_tokens);
 if(nestedCache!==undefined&&vendorCache!==undefined&&nestedCache!==vendorCache)throw Error('conflicting_provider_usage');
 const cachedInputTokens=nestedCache??vendorCache;
 const reasoningOutputTokens=detail(value.completion_tokens_details,'reasoning_tokens');
 if((cachedInputTokens??0)>inputTokens||(reasoningOutputTokens??0)>outputTokens)throw Error('invalid_provider_usage');
 return {inputTokens,outputTokens,totalTokens,
  ...(cachedInputTokens===undefined?{}:{cachedInputTokens}),
  ...(reasoningOutputTokens===undefined?{}:{reasoningOutputTokens})};
}
