import type { Json, Store } from '../../shared/src/index.js';
import type { ConfigAccess, Configuration, Entry, VerifyModel } from './model.js';
import { validId, normalize } from './validation.js';
import { readConfigurationState } from './storage.js';

export function createAiConfigurations(
  store: Store,
  authorize: (request: object, access: ConfigAccess) => boolean,
  verifyModel?: VerifyModel,
) {
  function allowed(request: object, access: ConfigAccess): boolean {
    try { return authorize(request, access) === true; }
    catch { return false; }
  }



  return Object.freeze({
    /** Enumeration grants reveal no row by themselves. Trusted hosts must retain and recheck the
     * original permission decision across this synchronous batch, including derived row requests. */
    list(request: object, kind: Configuration['kind']) {
      const scope:ConfigAccess={action:'list',kind,id:'*'};
      if (!['role','position','agent'].includes(kind) || !allowed(request,scope)) return {status:'denied'} as const;
      try {
        const candidates=readConfigurationState(store).state.entries.filter(entry=>
          entry.kind===kind && allowed(request,{action:'read',kind,id:entry.id}));
        if (!allowed(request,scope)) return {status:'denied'} as const;
        const entries=candidates.filter(entry=>allowed(request,{action:'read',kind,id:entry.id}))
          .map(entry=>({...normalize(entry),id:entry.id,revision:entry.revision}));
        if (!allowed(request,scope)) return {status:'denied'} as const;
        return {status:'ok',entries} as const;
      } catch { return {status:'unavailable'} as const; }
    },

    read(request: object, kind: Configuration['kind'], id: string) {
      if (!validId(id) || !allowed(request, { action: 'read', kind, id })) return { status: 'denied' } as const;
      try {
        const entry = readConfigurationState(store).state.entries.find(item => item.kind === kind && item.id === id);
        if (!allowed(request, { action: 'read', kind, id })) return { status: 'denied' } as const;
        return entry
          ? { status: 'ok', entry: { ...normalize(entry), id, revision: entry.revision } } as const
          : { status: 'not_found' } as const;
      } catch { return { status: 'unavailable' } as const; }
    },

    save(request: object, input: { id: string; intent: string; expectedRevision: number; value: Configuration }) {
      const { id, intent, expectedRevision } = input;
      let value: Configuration;
      try { value = normalize(input.value); }
      catch { return { status: 'invalid' } as const; }
      if (!validId(id) || !validId(intent) || !Number.isSafeInteger(expectedRevision) ||
          expectedRevision < 0 || expectedRevision === Number.MAX_SAFE_INTEGER) return { status: 'invalid' } as const;
      if (!allowed(request, { action: 'write', kind: value.kind, id })) return { status: 'denied' } as const;
      try {
        const { state, revision } = readConfigurationState(store);
        if (value.kind === 'agent') {
          const refs = [{ kind: 'role', id: value.roleId }, { kind: 'position', id: value.positionId }] as const;
          if (refs.some(ref => !allowed(request, { action: 'read', ...ref }) ||
              !state.entries.some(entry => entry.kind === ref.kind && entry.id === ref.id))) {
            return { status: 'reference_unavailable' } as const;
          }
        }
        if (!allowed(request, { action: 'write', kind: value.kind, id })) return { status: 'denied' } as const;
        const command = JSON.stringify({ id, expectedRevision, value });
        const receipt = state.receipts.find(item => item.intent === intent);
        if (receipt) return receipt.command === command
          ? { status: 'committed', revision: receipt.entry.revision } as const
          : { status: 'intent_conflict' } as const;
        if (value.kind === 'agent') {
          let verified = false;
          try { verified = verifyModel?.(request, Object.freeze({ ...value.model })) === true; }
          catch { /* The owner can be unavailable. */ }
          if (!verified) return { status: 'reference_unavailable' } as const;
          if (!allowed(request, { action: 'read', kind: 'role', id: value.roleId }) ||
              !allowed(request, { action: 'read', kind: 'position', id: value.positionId })) {
            return { status: 'reference_unavailable' } as const;
          }
        }
        if (!allowed(request, { action: 'write', kind: value.kind, id })) return { status: 'denied' } as const;
        const index = state.entries.findIndex(entry => entry.kind === value.kind && entry.id === id);
        if ((state.entries[index]?.revision ?? 0) !== expectedRevision) return { status: 'revision_conflict' } as const;
        const entry: Entry = { ...value, id, revision: expectedRevision + 1 };
        if (index < 0) state.entries.push(entry);
        else state.entries[index] = entry;
        state.receipts.push({ intent, command, entry });
        const result = store.commit({ intent, expectedRevision: revision, value: state as unknown as Json });
        if (result.status === 'committed') return { status: 'committed', revision: entry.revision } as const;
        if (result.status === 'unknown') return result;
        return { status: result.reason } as const;
      } catch { return { status: 'unavailable' } as const; }
    },
  });
}

