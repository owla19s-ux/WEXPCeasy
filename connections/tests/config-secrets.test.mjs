import test from 'node:test';
import assert from 'node:assert/strict';
import {openSqliteStore} from '../../dist/shared/src/index.js';
import {createConnectionConfigs} from '../../dist/connections/src/index.js';
const config={id:'github',adapter:'github',endpoint:'https://api.github.com',credentialRef:'credential-1',enabled:true};

test('connection configurations reject extra secret fields before persistence',()=>{
 const store=openSqliteStore(':memory:','config');
 try{
  const configs=createConnectionConfigs(store),before=store.read();
  for(const value of [{...config,apiKey:'must-not-store'},{...config,headers:{Authorization:'must-not-store'}},{...config,credentialRef:''}]){
   assert.deepEqual(configs.put(value,0,'invalid'),{status:'conflict',reason:'invalid_request'});
   assert.deepEqual(store.read(),before);
  }
  assert.equal(configs.put(config,0,'valid').status,'ok');
 }finally{store.close();}
});
test('damaged persisted configuration does not disclose extra secret fields or accept further writes',()=>{
 const store=openSqliteStore(':memory:','config');
 try{
  store.commit({intent:'damaged',expectedRevision:0,value:{format:1,items:[{...config,apiKey:'must-not-project'}]}});
  const configs=createConnectionConfigs(store),before=store.read();
  assert.throws(()=>configs.read());
  assert.throws(()=>configs.get('github'));
  assert.deepEqual(configs.put(config,1,'replace'),{status:'unavailable',reason:'store_failed'});
  assert.deepEqual(store.read(),before);
 }finally{store.close();}
});
