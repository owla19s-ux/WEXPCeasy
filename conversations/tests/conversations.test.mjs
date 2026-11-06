import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openSqliteStore } from '../../dist/shared/src/index.js';
import { createConversations, createConversationGeneration } from '../../dist/conversations/src/index.js';

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
    assert.equal(change('bad-selection', 6, { kind: 'select', messageId: 'reply', segmentIds: ['missing'] }).status, 'invalid_transition');
    assert.equal(change('select', 6, { kind: 'select', messageId: 'reply', segmentIds: ['p'] }).status, 'committed');
    assert.deepEqual(service.read(request, 'chat').conversation.selections, [{ messageId: 'reply', segmentIds: ['p'] }]);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('dispatch claims once and forwards cancellation without saving a late reply', async () => {
  const store = openSqliteStore(':memory:', 'conversations');
  try {
    const request = {};
    const service = createConversations(store, candidate => candidate === request);
    const change = (intent, expectedRevision, command) =>
      service.change(request, { conversationId: 'chat', intent, expectedRevision, change: command });
    change('create', 0, { kind: 'create' });
    change('append', 1, { kind: 'append', messageId: 'input', segments: [{ id: 'p', text: 'hello' }] });
    change('begin', 2, { kind: 'begin', generationId: 'gen', inputMessageId: 'input' });
    let calls = 0;
    const deltas = [];
    const generation = createConversationGeneration(service, {
      async send(_request, operationId, preparation, signal, onText) {
        calls++;
        assert.deepEqual(preparation.messages, [{ role: 'user', content: 'hello' }]);
        onText('partial');
        await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true }));
        onText('late');
        return { status: 'ok', operationId, result: { text: 'late', usage: null } };
      },
    });
    const input = { conversationId: 'chat', generationId: 'gen', operationId: 'op',
      replyId: 'reply', intent: 'send', expectedRevision: 3, preparation: {},
      requests: { read: request, dispatch: request, api: request, finish: request, fail: request, unknown: request },
      onText: text => deltas.push(text) };
    const pending = generation.send(input);
    assert.equal((await generation.send(input)).status, 'invalid_transition');
    assert.equal(generation.cancel(request, 'chat', 'gen', 'cancel', 4).status, 'committed');
    assert.equal((await pending).status, 'invalid_transition');
    assert.equal(calls, 1);
    assert.deepEqual(deltas, ['partial']);
    const { conversation } = service.read(request, 'chat');
    assert.equal(conversation.messages.length, 1);
    assert.equal(conversation.generations[0].status, 'cancelled');
    assert.equal(conversation.generations[0].operationId, 'op');
  } finally { store.close(); }
});
