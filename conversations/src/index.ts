import {isDeepStrictEqual} from 'node:util';
import type { ApiSendResult, Preparation } from '../../connections/api/src/index.js';
import type { Json, Store } from '../../shared/src/index.js';

export type Segment = { id: string; text: string };
export type Message = { id: string; role: 'user' | 'assistant'; segments: Segment[]; replaces?: string };
export type Generation = {
  id: string; inputMessageId: string; outputMessageId?: string;
  status: 'pending' | 'running' | 'completed' | 'cancelled' | 'failed' | 'unknown';
  operationId?: string;
  requestId?: string;
  replyId?: string;
};
export type Conversation = {
  id: string; revision: number; messages: Message[]; generations: Generation[];
  selections?: { messageId: string; segmentIds: string[] }[];
};
export type ConversationChange =
  | { kind: 'create' }
  | { kind: 'select'; messageId: string; segmentIds: string[] }
  | { kind: 'append'; messageId: string; segments: Segment[] }
  | { kind: 'resend'; messageId: string; replaces: string; segments: Segment[]; generationId: string }
  | { kind: 'begin'; generationId: string; inputMessageId: string }
  | { kind: 'finish'; generationId: string; messageId: string; segments: Segment[] }
  | { kind: 'dispatch'; generationId: string; operationId: string; requestId?: string; replyId?: string }
  | { kind: 'cancel' | 'fail' | 'unknown'; generationId: string };
type State = { format: 1; conversations: Conversation[]; receipts: Record<string, { fingerprint: string; revision: number }> };

const id = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-zA-Z0-9_-]{1,120}$/.test(value);

function segments(input: Segment[]): Segment[] {
  if (!Array.isArray(input) || input.length === 0 || input.length > 256) throw Error('invalid_segments');
  const seen = new Set<string>();
  return input.map(segment => {
    if (!id(segment.id) || seen.has(segment.id) || typeof segment.text !== 'string' ||
        segment.text.length === 0 || segment.text.length > 32000) throw Error('invalid_segment');
    seen.add(segment.id);
    return { id: segment.id, text: segment.text };
  });
}

function normalize(change: ConversationChange): ConversationChange {
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

function apply(conversation: Conversation, change: Exclude<ConversationChange, {kind:'create'}>): boolean {
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
    conversation.messages.push({ id: change.messageId, role: 'assistant', segments: change.segments });
    generation.status = 'completed';
    generation.outputMessageId = change.messageId;
  } else generation.status = change.kind === 'cancel' ? 'cancelled' : change.kind === 'unknown' ? 'unknown' : 'failed';
  return true;
}

const exact=(value:unknown,keys:string[])=>!!value&&typeof value==='object'&&!Array.isArray(value)&&
 Object.getPrototypeOf(value)===Object.prototype&&isDeepStrictEqual(Object.keys(value).sort(),[...keys].sort());

function validateConversation(conversation: Conversation): void {
  if (!exact(conversation,['id','revision','messages','generations',...(Object.hasOwn(conversation,'selections')?['selections']:[])]) ||
      !id(conversation.id) || !Number.isSafeInteger(conversation.revision) || conversation.revision < 1 ||
      !Array.isArray(conversation.messages) || !Array.isArray(conversation.generations)) throw Error('invalid_conversation');
  const messages = new Map<string, Message>();
  for (const message of conversation.messages) {
    if (!exact(message,['id','role','segments',...(Object.hasOwn(message,'replaces')?['replaces']:[])]) ||
        !isDeepStrictEqual(message.segments,segments(message.segments)) || !id(message.id) || messages.has(message.id) || !['user', 'assistant'].includes(message.role)) throw Error('invalid_message');
    segments(message.segments);
    if (message.replaces !== undefined && (!id(message.replaces) || message.role !== 'user' || messages.get(message.replaces)?.role !== 'user')) throw Error('invalid_replacement');
    messages.set(message.id, message);
  }
  const generations = new Set<string>();
  const operations = new Set<string>();
  for (const generation of conversation.generations) {
    if (!exact(generation,['id','inputMessageId','status',...['operationId','requestId','replyId','outputMessageId'].filter(key=>Object.hasOwn(generation,key))]) ||
        !id(generation.id) || generations.has(generation.id) ||
        messages.get(generation.inputMessageId)?.role !== 'user' ||
        !['pending', 'running', 'completed', 'cancelled', 'failed', 'unknown'].includes(generation.status)) throw Error('invalid_generation');
    if ((generation.requestId===undefined)!==(generation.replyId===undefined) ||
        (generation.requestId!==undefined&&(!id(generation.requestId)||!id(generation.replyId))) ||
        (generation.status==='completed'&&!generation.outputMessageId)) throw Error('invalid_generation_identity');
    generations.add(generation.id);
    if (generation.operationId !== undefined) {
      if (!id(generation.operationId) || operations.has(generation.operationId)) throw Error('invalid_operation');
      operations.add(generation.operationId);
    }
    if (generation.status === 'running' && !generation.operationId) throw Error('missing_operation');
    if (generation.outputMessageId !== undefined && messages.get(generation.outputMessageId)?.role !== 'assistant') throw Error('invalid_output');
  }
  if(conversation.selections!==undefined&&!Array.isArray(conversation.selections))throw Error('invalid_selection');
  const selectedMessages=new Set<string>();
  for (const selection of conversation.selections ?? []) {
    const message = messages.get(selection.messageId);
    if (!exact(selection,['messageId','segmentIds']) || !message || selectedMessages.has(selection.messageId) ||
        !Array.isArray(selection.segmentIds) || selection.segmentIds.length===0 || selection.segmentIds.length>256 ||
        new Set(selection.segmentIds).size !== selection.segmentIds.length ||
        !selection.segmentIds.every(id => message.segments.some(segment => segment.id === id))) throw Error('invalid_selection');
    selectedMessages.add(selection.messageId);
  }
}

function readConversationState(store:Store) {
  const snapshot = store.read();
  const state: State = snapshot.revision === 0 && snapshot.value === null
    ? { format: 1, conversations: [], receipts: {} }
    : snapshot.value as unknown as State;
  if (!exact(state,['format','conversations','receipts']) || state?.format !== 1 || !Array.isArray(state.conversations) ||
      !state.receipts || Object.getPrototypeOf(state.receipts) !== Object.prototype) throw Error('invalid_store');
  const identities = new Set<string>();
  for (const conversation of state.conversations) {
    validateConversation(conversation);
    if (identities.has(conversation.id)) throw Error('duplicate_conversation');
    identities.add(conversation.id);
  }
  const latest=new Map<string,number>();
  for(const [key,receipt] of Object.entries(state.receipts)){
    const parts=key.split(':');
    if(parts.length!==2||!parts.every(id)||!exact(receipt,['fingerprint','revision'])||
       typeof receipt.fingerprint!=='string'||!Number.isSafeInteger(receipt.revision)||receipt.revision<1)throw Error('invalid_receipt');
    const conversation=state.conversations.find(item=>item.id===parts[0]);
    const command=JSON.parse(receipt.fingerprint) as {expectedRevision:number;change:ConversationChange};
    if(!conversation||receipt.revision>conversation.revision||!exact(command,['expectedRevision','change'])||
       !Number.isSafeInteger(command.expectedRevision)||command.expectedRevision<0||
       command.expectedRevision>=Number.MAX_SAFE_INTEGER||receipt.revision!==command.expectedRevision+1||
       !isDeepStrictEqual(normalize(command.change),command.change))throw Error('invalid_receipt');
    latest.set(conversation.id,Math.max(latest.get(conversation.id)??0,receipt.revision));
  }
  for(const conversation of state.conversations)if(latest.get(conversation.id)!==conversation.revision)throw Error('missing_current_receipt');
  return { state, revision: snapshot.revision };
}
/** Trusted host-only storage readiness inspection; does not return history or permission facts. */
export function inspectConversationStore(store:Store):{status:'ready'|'unavailable'}{
 try{readConversationState(store);return {status:'ready'};}catch{return {status:'unavailable'};}
}

export function createConversations(store: Store, authorize: (
  request: object, action: 'read' | ConversationChange['kind'], conversationId: string,
) => boolean) {
  function allowed(request: object, action: 'read' | ConversationChange['kind'], conversationId: string) {
    try { return authorize(request, action, conversationId) === true; }
    catch { return false; }
  }



  return Object.freeze({
    read(request: object, conversationId: string) {
      if (!id(conversationId) || !allowed(request, 'read', conversationId)) return { status: 'denied' } as const;
      try {
        const conversation = readConversationState(store).state.conversations.find(item => item.id === conversationId);
        if (!allowed(request, 'read', conversationId)) return { status: 'denied' } as const;
        return conversation ? { status: 'ok', conversation } as const : { status: 'not_found' } as const;
      } catch { return { status: 'unavailable' } as const; }
    },

    change(request: object, input: { conversationId: string; intent: string; expectedRevision: number; change: ConversationChange }) {
      const { conversationId, intent, expectedRevision } = input;
      if (!id(conversationId) || !id(intent) || !Number.isSafeInteger(expectedRevision) ||
          expectedRevision < 0 || expectedRevision >= Number.MAX_SAFE_INTEGER) return { status: 'invalid' } as const;
      let change: ConversationChange;
      try { change = normalize(input.change); } catch { return { status: 'invalid' } as const; }
      if (!allowed(request, change.kind, conversationId)) return { status: 'denied' } as const;
      try {
        const { state, revision } = readConversationState(store);
        if (!allowed(request, change.kind, conversationId)) return { status: 'denied' } as const;
        const key = conversationId + ':' + intent;
        const fingerprint = JSON.stringify({ expectedRevision, change });
        const receipt = state.receipts[key];
        if (receipt) return receipt.fingerprint === fingerprint
          ? (change.kind === 'dispatch' ? { status: 'already_dispatched' } as const
            : { status: 'committed', revision: receipt.revision } as const) : { status: 'intent_conflict' } as const;
        const conversation = state.conversations.find(item => item.id === conversationId);
        if ((conversation?.revision ?? 0) !== expectedRevision) return { status: 'revision_conflict' } as const;
        const next = expectedRevision + 1;
        if (change.kind === 'create') {
          if (conversation) return { status: 'invalid_transition' } as const;
          state.conversations.push({ id: conversationId, revision: next, messages: [], generations: [] });
        } else {
          if (!conversation || !apply(conversation, change)) return { status: 'invalid_transition' } as const;
          conversation.revision = next;
        }
        state.receipts[key] = { fingerprint, revision: next };
        const result = store.commit({ intent: key, expectedRevision: revision, value: state as unknown as Json });
        if (result.status === 'committed') return { status: 'committed', revision: next } as const;
        if (result.status === 'unknown') return result;
        return { status: result.reason } as const;
      } catch { return { status: 'unavailable' } as const; }
    },
  });
}

type ConversationService = ReturnType<typeof createConversations>;
type ApiSender = {
  send(request: object, operationId: string, input: Preparation, signal: AbortSignal,
    onText?: (delta: string) => void): Promise<ApiSendResult>;
};

/** Coordinates one logical generation with one explicit API operation. */
export function createConversationGeneration(
  service: ConversationService, api: ApiSender,
  readReceipt?: (request: object, operationId: string) => { requestId: string; text: string } | undefined,
) {
  const active = new Map<string, AbortController>();
  return Object.freeze({
    async send(input: {
      conversationId: string; generationId: string; operationId: string;
      replyId: string; intent: string; expectedRevision: number;
      requests: { read: object; dispatch: object; api: object; finish: object; fail: object; unknown: object };
      preparation: Omit<Preparation, 'messages'>;
      onText?: (delta: string) => void;
    }) {
      const { conversationId, generationId, operationId, replyId, intent, expectedRevision, onText } = input;
      const requests = { ...input.requests };
      if (!id(replyId) || !id(intent) || intent.length > 110) return { status: 'invalid' } as const;
      const observed = service.read(requests.read, conversationId);
      if (observed.status !== 'ok') return observed;
      const { conversation } = observed;
      const generation = conversation.generations.find(item => item.id === generationId);
      const messageIndex = conversation.messages.findIndex(message => message.id === generation?.inputMessageId);
      const message = conversation.messages[messageIndex];
      if (!generation || !message || generation.status !== 'pending' ||
          conversation.messages.some(item => item.id === replyId)) return { status: 'invalid_transition' } as const;
      const replacedIndex = message.replaces
        ? conversation.messages.findIndex(item => item.id === message.replaces) : messageIndex;
      const messages = [...conversation.messages.slice(0, replacedIndex), message].map(item => ({
        role: item.role, content: item.segments.map(segment => segment.text).join('\n'),
      }));
      const preparation: Preparation = { ...structuredClone(input.preparation), messages };
      const claimed = service.change(requests.dispatch, { conversationId, intent, expectedRevision,
        change: { kind: 'dispatch', generationId, operationId, requestId: preparation.requestId, replyId } });
      if (claimed.status !== 'committed') return claimed;
      const controller = new AbortController();
      const key = conversationId + ':' + generationId;
      active.set(key, controller);
      try {
        let result: ApiSendResult;
        try {
          result = await api.send(requests.api, operationId, preparation, controller.signal, delta => {
            if (controller.signal.aborted || active.get(key) !== controller) return;
            const visible = service.read(requests.read, conversationId);
            if (visible.status !== 'ok') return;
            const current = visible.conversation.generations.find(item => item.id === generationId);
            if (current?.status !== 'running' || current.operationId !== operationId) return;
            onText?.(delta);
          });
        } catch {
          result = { status: 'unknown', operationId, reason: 'api_result_unconfirmed' };
        }
        const kind = result.status === 'ok' && result.operationId === operationId &&
          result.result.text.length > 0 && result.result.text.length <= 32000
          ? 'finish' : result.status === 'blocked' && result.operationId === operationId ? 'fail' : 'unknown';
        const change: ConversationChange = kind === 'finish' && result.status === 'ok'
          ? { kind, generationId, messageId: replyId, segments: [{ id: 'text', text: result.result.text }] }
          : { kind: kind === 'finish' ? 'unknown' : kind, generationId };
        const latest = service.read(requests.read, conversationId);
        if (latest.status !== 'ok') return { status: 'unavailable', operationId } as const;
        return service.change(requests[kind], { conversationId, intent: intent + '-result',
          expectedRevision: latest.conversation.revision, change });
      } finally {
        active.delete(key);
      }
    },

    recover(requests: { read: object; receipt: object; finish: object }, conversationId: string,
      generationId: string, intent: string) {
      const observed = service.read(requests.read, conversationId);
      if (observed.status !== 'ok') return observed;
      const generation = observed.conversation.generations.find(item => item.id === generationId);
      if (!generation || !['running','unknown'].includes(generation.status) || active.has(conversationId + ':' + generationId) ||
          !generation.operationId || !generation.requestId || !generation.replyId) {
        return { status: 'invalid_transition' } as const;
      }
      let receipt;
      try { receipt = readReceipt?.(requests.receipt, generation.operationId); }
      catch { return { status: 'unavailable' } as const; }
      if (!receipt || receipt.requestId !== generation.requestId) return { status: 'unavailable' } as const;
      return service.change(requests.finish, { conversationId, intent,
        expectedRevision: observed.conversation.revision, change: { kind: 'finish', generationId,
          messageId: generation.replyId, segments: [{ id: 'text', text: receipt.text }] } });
    },

    cancel(request: object, conversationId: string, generationId: string, intent: string, expectedRevision: number) {
      const result = service.change(request, { conversationId, intent, expectedRevision,
        change: { kind: 'cancel', generationId } });
      if (result.status === 'committed') active.get(conversationId + ':' + generationId)?.abort();
      return result;
    },
  });
}
