import type { Json, Store } from '../../shared/src/index.js';

export type ModelReference = { connectionId: string; modelId: string };
export type VerifyModel = (request: object, reference: Readonly<ModelReference>) => boolean;
export type Configuration =
  | { kind: 'role'; name: string; prompt: string }
  | { kind: 'position'; name: string; responsibility: string }
  | { kind: 'agent'; name: string; roleId: string; positionId: string; model: ModelReference };
export type Entry = Configuration & { id: string; revision: number };
type Receipt = { intent: string; command: string; entry: Entry };
type State = { version: 1; entries: Entry[]; receipts: Receipt[] };
export type ConfigAccess = {
  action: 'read' | 'write'; kind: Configuration['kind']; id: string;
};
const validId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
const validText = (value: unknown, limit: number): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= limit;

function normalize(value: Configuration): Configuration {
  if (!validText(value.name, 256)) throw Error('invalid_name');
  switch (value.kind) {
    case 'role':
      if (!validText(value.prompt, 32000)) throw Error('invalid_prompt');
      return { kind: value.kind, name: value.name, prompt: value.prompt };
    case 'position':
      if (!validText(value.responsibility, 8000)) throw Error('invalid_responsibility');
      return { kind: value.kind, name: value.name, responsibility: value.responsibility };
    case 'agent': {
      const { roleId, positionId, model } = value;
      if (!validId(roleId) || !validId(positionId) ||
          !validId(model?.connectionId) || !validId(model?.modelId)) throw Error('invalid_reference');
      return { kind: value.kind, name: value.name, roleId, positionId,
        model: { connectionId: model.connectionId, modelId: model.modelId } };
    }
    default: throw Error('invalid_kind');
  }
}

export function createAiConfigurations(
  store: Store,
  authorize: (request: object, access: ConfigAccess) => boolean,
  verifyModel?: VerifyModel,
) {
  function allowed(request: object, access: ConfigAccess): boolean {
    try { return authorize(request, access) === true; }
    catch { return false; }
  }

  function readState() {
    const snapshot = store.read();
    const state = snapshot.revision === 0 && snapshot.value === null
      ? { version: 1, entries: [], receipts: [] } as State
      : snapshot.value as unknown as State;
    if (state?.version !== 1 || !Array.isArray(state.entries) || !Array.isArray(state.receipts)) {
      throw Error('unsupported_configuration_store');
    }
    return { revision: snapshot.revision, state };
  }

  return Object.freeze({
    read(request: object, kind: Configuration['kind'], id: string) {
      if (!validId(id) || !allowed(request, { action: 'read', kind, id })) return { status: 'denied' } as const;
      try {
        const entry = readState().state.entries.find(item => item.kind === kind && item.id === id);
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
        const { state, revision } = readState();
        if (value.kind === 'agent') {
          const refs = [{ kind: 'role', id: value.roleId }, { kind: 'position', id: value.positionId }] as const;
          if (refs.some(ref => !allowed(request, { action: 'read', ...ref }) ||
              !state.entries.some(entry => entry.kind === ref.kind && entry.id === ref.id))) {
            return { status: 'reference_unavailable' } as const;
          }
        }
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

/** The host binds each lookup to the caller's API model.read scope. */
export function verifyModelWithApi(
  api: { query(request: object, query: { kind: 'model'; id: string }): unknown },
  bindModelRead: (request: object, modelId: string) => object | undefined,
): VerifyModel {
  return (request, reference) => {
    const scoped = bindModelRead(request, reference.modelId);
    if (!scoped) return false;
    const result = api.query(scoped, { kind: 'model', id: reference.modelId });
    if (typeof result !== 'object' || result === null || !('status' in result) ||
        result.status !== 'ok' || !('value' in result)) return false;
    const value = result.value;
    return typeof value === 'object' && value !== null &&
      'id' in value && value.id === reference.modelId &&
      'connectionId' in value && value.connectionId === reference.connectionId;
  };
}
