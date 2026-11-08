import type { ApiSendResult, Preparation } from '../../connections/api/src/index.js';
import type { ConversationChange } from './model.js';
import { id } from './validation.js';
import { createConversations } from './service.js';

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
      systemPrompt?: string;
    }) {
      const { conversationId, generationId, operationId, replyId, intent, expectedRevision, onText, systemPrompt } = input;
      const requests = { ...input.requests };
      if (systemPrompt !== undefined && (typeof systemPrompt !== 'string' || systemPrompt.length === 0 || systemPrompt.length > 32000)) return { status: 'invalid' } as const;
      if (!id(replyId) || !id(intent) || intent.length > 110) return { status: 'invalid' } as const;
      let copiedPreparation: Omit<Preparation, 'messages'>;
      try { copiedPreparation = structuredClone(input.preparation); }
      catch { return { status: 'invalid' } as const; }
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
      const messages: Preparation['messages'] = [...conversation.messages.slice(0, replacedIndex), message].map(item => ({
        role: item.role, content: item.segments.map(segment => segment.text).join('\n'),
      }));
      if (systemPrompt !== undefined) messages.unshift({ role: 'system', content: systemPrompt });
      const preparation: Preparation = { ...copiedPreparation, messages };
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
        if (active.get(key) === controller) active.delete(key);
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
