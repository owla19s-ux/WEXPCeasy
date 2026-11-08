import { isDeepStrictEqual } from 'node:util';
import type { Json, Store } from '../../shared/src/index.js';
import type { Conversation, ConversationChange, Message, Segment, State } from './model.js';
import { id, segments } from './validation.js';
import { normalize } from './changes.js';

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
        (generation.status==='completed'&&(!generation.outputMessageId||
          (generation.replyId!==undefined&&generation.outputMessageId!==generation.replyId)))) throw Error('invalid_generation_identity');
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

export function readConversationState(store:Store) {
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

