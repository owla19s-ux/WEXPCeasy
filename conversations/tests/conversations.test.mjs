import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openSqliteStore } from '../../dist/shared/src/index.js';
import { createConversations } from '../../dist/conversations/src/index.js';

test('conversation recovers original messages, cancellation and immutable resend history', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wex-conversations-'));
  const path = join(dir, 'conversations.sqlite');
  const request = {};
  let store = openSqliteStore(path, 'conversations');
  let service = createConversations(store, candidate => candidate === request);
  const change = (intent, expectedRevision, command) =>
    service.change(request, { conversationId: 'chat', intent, expectedRevision, change: command });
  try {
    assert.equal(change('create', 0, { kind: 'create' }).status, 'committed');
    const original = { kind: 'append', messageId: 'first', segments: [{ id: 'p', text: 'original' }] };
    assert.equal(change('append', 1, original).status, 'committed');
    assert.equal(change('begin', 2, { kind: 'begin', generationId: 'old', inputMessageId: 'first' }).status, 'committed');
    assert.equal(change('cancel', 3, { kind: 'cancel', generationId: 'old' }).status, 'committed');
    const resend = { kind: 'resend', generationId: 'new', replaces: 'first', messageId: 'second',
      segments: [{ id: 'p', text: 'revised' }] };
    assert.equal(change('stale', 3, resend).status, 'revision_conflict');
    assert.equal(change('resend', 4, resend).status, 'committed');
    store.close();
    store = openSqliteStore(path, 'conversations');
    service = createConversations(store, candidate => candidate === request);
    assert.equal(service.read({}, 'chat').status, 'denied');
    assert.deepEqual(change('resend', 4, resend), { status: 'committed', revision: 5 });
    const finish = { kind: 'finish', generationId: 'old', messageId: 'reply',
      segments: [{ id: 'p', text: 'answer' }] };
    assert.equal(change('late', 5, finish).status, 'invalid_transition');
    assert.equal(change('finish', 5, { ...finish, generationId: 'new' }).status, 'committed');
    const { conversation } = service.read(request, 'chat');
    assert.deepEqual(conversation.messages.map(item => item.segments[0].text), ['original','revised','answer']);
    assert.equal(conversation.messages[1].replaces, 'first');
    assert.equal(conversation.generations[1].outputMessageId, 'reply');
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
