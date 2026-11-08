import type { Conversation, ConversationChange, Segment } from './model.js';
import { id, segments } from './validation.js';

export function normalize(change: ConversationChange): ConversationChange {
  if ('generationId' in change && !id(change.generationId)) throw Error('invalid_generation_id');
  if ('messageId' in change && !id(change.messageId)) throw Error('invalid_message_id');
  switch (change.kind) {
    case 'create': return { kind: change.kind };
    case 'select':
      if (!Array.isArray(change.segmentIds) || change.segmentIds.length > 256 ||
          !change.segmentIds.every(id) || new Set(change.segmentIds).size !== change.segmentIds.length) throw Error('invalid_selection');
      return { kind: change.kind, messageId: change.messageId, segmentIds: [...change.segmentIds] };
    case 'append': return { kind: change.kind, messageId: change.messageId, segments: segments(change.segments) };
    case 'resend':
      if (!id(change.replaces)) throw Error('invalid_message_id');
      return { kind: change.kind, messageId: change.messageId, replaces: change.replaces,
        generationId: change.generationId, segments: segments(change.segments) };
    case 'begin':
      if (!id(change.inputMessageId)) throw Error('invalid_message_id');
      return { kind: change.kind, generationId: change.generationId, inputMessageId: change.inputMessageId };
    case 'finish': return { kind: change.kind, generationId: change.generationId,
      messageId: change.messageId, segments: segments(change.segments) };
    case 'dispatch':
      if (!id(change.operationId)) throw Error('invalid_operation_id');
      if (change.requestId === undefined && change.replyId === undefined) {
        return { kind: change.kind, generationId: change.generationId, operationId: change.operationId };
      }
      if (!id(change.requestId) || !id(change.replyId)) throw Error('invalid_dispatch_identity');
      return { kind: change.kind, generationId: change.generationId, operationId: change.operationId,
        requestId: change.requestId, replyId: change.replyId };
    case 'unknown':
    case 'cancel':
    case 'fail': return { kind: change.kind, generationId: change.generationId };
    default: throw Error('invalid_change');
  }
}

export function apply(conversation: Conversation, change: Exclude<ConversationChange, {kind:'create'}>): boolean {
  if (change.kind === 'select') {
    const message = conversation.messages.find(item => item.id === change.messageId);
    if (!message || !change.segmentIds.every(id => message.segments.some(segment => segment.id === id))) return false;
    conversation.selections = (conversation.selections ?? []).filter(item => item.messageId !== message.id);
    if (change.segmentIds.length) conversation.selections.push({ messageId: message.id, segmentIds: change.segmentIds });
    return true;
  }
  if ('messageId' in change && conversation.messages.some(message => message.id === change.messageId)) return false;
  if (change.kind === 'append' || change.kind === 'resend') {
    if (change.kind === 'resend') {
      if (!conversation.messages.some(message => message.id === change.replaces && message.role === 'user') ||
          conversation.generations.some(generation => generation.id === change.generationId || (generation.status === 'pending' || generation.status === 'running'))) return false;
      conversation.generations.push({ id: change.generationId, inputMessageId: change.messageId, status: 'pending' });
    }
    conversation.messages.push({ id: change.messageId, role: 'user', segments: change.segments,
      ...(change.kind === 'resend' ? { replaces: change.replaces } : {}) });
    return true;
  }
  if (change.kind === 'begin') {
    if (!conversation.messages.some(message => message.id === change.inputMessageId && message.role === 'user') ||
        conversation.generations.some(generation => generation.id === change.generationId || (generation.status === 'pending' || generation.status === 'running'))) return false;
    conversation.generations.push({ id: change.generationId, inputMessageId: change.inputMessageId, status: 'pending' });
    return true;
  }
  const generation = conversation.generations.find(item => item.id === change.generationId);
  const recoveredUnknown=change.kind==='finish'&&generation?.status==='unknown'&&
    generation.operationId!==undefined&&generation.requestId!==undefined&&generation.replyId===change.messageId;
  if (!generation || (generation.status !== 'pending' && generation.status !== 'running'&&!recoveredUnknown)) return false;
  if (change.kind === 'dispatch') {
    if (generation.status !== 'pending' || conversation.generations.some(item => item.operationId === change.operationId)) return false;
    generation.status = 'running';
    generation.operationId = change.operationId;
    if (change.requestId && change.replyId) {
      generation.requestId = change.requestId;
      generation.replyId = change.replyId;
    }
    return true;
  }
  if (change.kind === 'finish') {
    if (generation.replyId !== undefined && generation.replyId !== change.messageId) return false;
    conversation.messages.push({ id: change.messageId, role: 'assistant', segments: change.segments });
    generation.status = 'completed';
    generation.outputMessageId = change.messageId;
  } else generation.status = change.kind === 'cancel' ? 'cancelled' : change.kind === 'unknown' ? 'unknown' : 'failed';
  return true;
}

