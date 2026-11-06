import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAiConfigurations, verifyModelWithApi } from '../../dist/AI/src/index.js';
import { openSqliteStore } from '../../dist/shared/src/index.js';

test('AI objects persist independently with revision and intent checks', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wex-ai-'));
  const path = join(dir, 'config.sqlite');
  let store = openSqliteStore(path, 'ai');
  const authorized = {};
  const authorize = request => request === authorized;
  let modelAvailable = true;
  const verifyModel = (request, model) => request === authorized && modelAvailable &&
    model.connectionId === 'connection' && model.modelId === 'model';
  try {
    let ai = createAiConfigurations(store, authorize, verifyModel);
    const save = (id, intent, value, expectedRevision = 0) =>
      ai.save(authorized, { id, intent, value, expectedRevision });
    const role = { kind: 'role', name: 'Reviewer', prompt: 'Review the change' };
    const agent = { kind: 'agent', name: 'Worker', roleId: 'role', positionId: 'position',
      model: { connectionId: 'connection', modelId: 'model', key: 'ignored' } };
    assert.equal(save('agent', 'early', agent).status, 'reference_unavailable');
    assert.equal(save('role', 'role-create', role).status, 'committed');
    assert.equal(save('position', 'position-create',
      { kind: 'position', name: 'Review', responsibility: 'Check changes' }).status, 'committed');
    modelAvailable = false;
    assert.equal(save('agent', 'agent-create', agent).status, 'reference_unavailable');
    modelAvailable = true;
    assert.equal(save('agent', 'agent-create', agent).status, 'committed');
    assert.equal(save('role', 'role-edit', { ...role, name: 'Updated' }, 1).revision, 2);
    assert.equal(save('role', 'stale', role, 1).status, 'revision_conflict');
    store.close();
    store = openSqliteStore(path, 'ai');
    ai = createAiConfigurations(store, authorize, verifyModel);
    assert.equal(ai.read({}, 'agent', 'agent').status, 'denied');
    assert.deepEqual(ai.read(authorized, 'agent', 'agent').entry.model,
      { connectionId: 'connection', modelId: 'model' });
    assert.deepEqual(save('role', 'role-create', role), { status: 'committed', revision: 1 });
    assert.equal(save('role', 'role-create', { ...role, name: 'Other' }).status, 'intent_conflict');
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('API model verification checks caller scope and the owning connection', () => {
  const request = {};
  const scoped = {};
  const verify = verifyModelWithApi({
    query(binding, query) {
      assert.equal(binding, scoped);
      assert.deepEqual(query, { kind: 'model', id: 'model' });
      return { status: 'ok', value: { id: 'model', connectionId: 'connection' } };
    },
  }, (caller, id) => caller === request && id === 'model' ? scoped : undefined);
  assert.equal(verify(request, { connectionId: 'connection', modelId: 'model' }), true);
  assert.equal(verify(request, { connectionId: 'other', modelId: 'model' }), false);
  assert.equal(verify({}, { connectionId: 'connection', modelId: 'model' }), false);
});
