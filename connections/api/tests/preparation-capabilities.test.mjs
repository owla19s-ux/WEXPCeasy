import test from 'node:test';
import assert from 'node:assert/strict';
import {requireTextGenerationCapabilities} from '../../../dist/connections/api/src/preparation-capabilities.js';

const verified={text:'supported',stream:'supported',tools:'unknown',image:'unknown',reasoning:'unknown'};

test('legacy text evidence continues to authorize existing text preparation',()=>{
 assert.doesNotThrow(()=>requireTextGenerationCapabilities({capabilities:verified},false));
 assert.doesNotThrow(()=>requireTextGenerationCapabilities({capabilities:verified},true));
});

test('directional text evidence must not deny known unsupported input or output silently',()=>{
 for(const direction of ['input','output']){
  for(const state of ['unsupported','unknown','unverified']){
   const text={input:'supported',output:'supported',[direction]:state};
   assert.throws(()=>requireTextGenerationCapabilities({capabilities:verified,modalities:{text}},false),/capability_unsupported_or_unknown/);
  }
 }
});

test('verified directional text does not imply stream support',()=>{
 const modalities={text:{input:'supported',output:'supported'}};
 assert.doesNotThrow(()=>requireTextGenerationCapabilities({capabilities:verified,modalities},true));
 assert.throws(()=>requireTextGenerationCapabilities({capabilities:{...verified,stream:'unverified'},modalities},true),/capability_unsupported_or_unknown/);
 assert.doesNotThrow(()=>requireTextGenerationCapabilities({capabilities:{...verified,stream:'unknown'},modalities},false));
});

test('unrelated directional claims never infer text generation capability',()=>{
 const modalities={image:{input:'supported',output:'supported'},audio:{input:'supported'}};
 assert.doesNotThrow(()=>requireTextGenerationCapabilities({capabilities:verified,modalities},false));
 assert.throws(()=>requireTextGenerationCapabilities({capabilities:{...verified,text:'unknown'},modalities},false),/capability_unsupported_or_unknown/);
});
