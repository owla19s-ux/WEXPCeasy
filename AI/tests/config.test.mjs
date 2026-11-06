import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAiConfigurations } from '../../dist/AI/src/index.js';
import { openSqliteStore } from '../../dist/shared/src/index.js';

test('AI objects persist independently with revision and intent checks', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wex-ai-'));
  const path = join(dir, 'config.sqlite');
  let store = openSqliteStore(path, 'ai');
  const authorized = {};
  const authorize = request => request === authorized;
  try {
    let ai = createAiConfigurations(store, authorize);
    const save = (id, intent, value, expectedRevision = 0) =>
      ai.save(authorized, { id, intent, value, expectedRevision });
    const role = { kind: 'role', name: 'Reviewer', prompt: 'Review the change' };
    const agent = { kind: 'agent', name: 'Worker', roleId: 'role', positionId: 'position',
      model: { connectionId: 'connection', modelId: 'model', key: 'ignored' } };
    assert.equal(save('agent', 'early', agent).status, 'reference_unavailable');
    assert.equal(save('role', 'role-create', role).status, 'committed');
    assert.equal(save('position', 'position-create',
      { kind: 'position', name: 'Review', responsibility: 'Check changes' }).status, 'committed');
    assert.equal(save('agent', 'agent-create', agent).status, 'committed');
    assert.equal(save('role', 'role-edit', { ...role, name: 'Updated' }, 1).revision, 2);
    assert.equal(save('role', 'stale', role, 1).status, 'revision_conflict');
    store.close();
    store = openSqliteStore(path, 'ai');
    ai = createAiConfigurations(store, authorize);
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
