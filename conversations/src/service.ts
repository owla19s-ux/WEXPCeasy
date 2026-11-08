import type { Json, Store } from '../../shared/src/index.js';
import type { ConversationChange } from './model.js';
import { id } from './validation.js';
import { normalize, apply } from './changes.js';
import { readConversationState } from './storage.js';

export function createConversations(store: Store, authorize: (
  request: object, action: 'read' | 'list' | ConversationChange['kind'], conversationId: string,
) => boolean) {
  function allowed(request: object, action: 'read' | 'list' | ConversationChange['kind'], conversationId: string) {
    try { return authorize(request, action, conversationId) === true; }
    catch { return false; }
  }



  return Object.freeze({
    /** The host binds each candidate read; listing does not grant access to its rows. */
    list(request:object,bindRead:(id:string)=>object|undefined){
      if(!allowed(request,'list','*'))return {status:'denied'} as const;
      try{
        const rows=readConversationState(store).state.conversations;
        const visible=rows.flatMap(conversation=>{
          const row=bindRead(conversation.id);if(!row||!allowed(row,'read',conversation.id))return [];
          return [{row,conversation}];
        });
        if(!allowed(request,'list','*'))return {status:'denied'} as const;
        const conversations=visible.filter(v=>allowed(v.row,'read',v.conversation.id)).map(v=>structuredClone(v.conversation));
        return allowed(request,'list','*')?{status:'ok',conversations} as const:{status:'denied'} as const;
      }catch{return {status:'unavailable'} as const;}
    },
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

