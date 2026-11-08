import test from 'node:test';
import assert from 'node:assert/strict';

import * as publicApi from '../../dist/conversations/src/index.js';
import { createConversations } from '../../dist/conversations/src/service.js';
import { createConversationGeneration } from '../../dist/conversations/src/generation.js';
import { inspectConversationStore } from '../../dist/conversations/src/storage.js';

test('public Conversations entry preserves its runtime exports after responsibility split', () => {
  assert.deepEqual(Object.keys(publicApi).sort(), [
    'createConversationGeneration',
    'createConversations',
    'inspectConversationStore',
  ]);
  assert.equal(publicApi.createConversations, createConversations);
  assert.equal(publicApi.createConversationGeneration, createConversationGeneration);
  assert.equal(publicApi.inspectConversationStore, inspectConversationStore);
});
