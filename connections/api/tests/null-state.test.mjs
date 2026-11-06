import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';
test('persisted null API configuration is corruption and cannot be reset by another Connection creation',t=>{
 const h=fixture(t),connection=h.connection();assert.equal(connection.status,'committed');
 const snap=h.db.read();assert.equal(h.db.commit({intent:'damage',expectedRevision:snap.revision,value:null}).status,'committed');
 const before=h.db.read();
 assert.equal(h.query('connection',connection.id).status,'unavailable');
 assert.equal(h.connection().status,'unavailable');
 assert.deepEqual(h.db.read(),before);assert.throws(()=>h.reopen());
 assert.deepEqual(h.db.read(),before);
});
