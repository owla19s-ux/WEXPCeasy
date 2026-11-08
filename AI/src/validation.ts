import { isDeepStrictEqual } from 'node:util';
import type { Configuration, Entry, State } from './model.js';

export const validId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
const validText = (value: unknown, limit: number): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= limit;

export function normalize(value: Configuration): Configuration {
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


/** Persisted state is evidence, not trusted input. Never repair or normalize damaged records in place. */
export function validateState(state: State): void {
  if (!state || state.version !== 1 || !Array.isArray(state.entries) || !Array.isArray(state.receipts) ||
      !isDeepStrictEqual(Object.keys(state).sort(), ['entries', 'receipts', 'version'])) {
    throw Error('unsupported_configuration_store');
  }
  const identities = new Set<string>();
  function entryValid(entry: Entry): void {
    if (!entry || !validId(entry.id) || !Number.isSafeInteger(entry.revision) || entry.revision < 1 ||
        !isDeepStrictEqual(entry, { ...normalize(entry), id: entry.id, revision: entry.revision })) {
      throw Error('invalid_configuration_entry');
    }
  }
  for (const entry of state.entries) {
    entryValid(entry);
    const key = entry.kind + ':' + entry.id;
    if (identities.has(key)) throw Error('duplicate_configuration');
    identities.add(key);
  }
  for (const entry of state.entries) {
    if (entry.kind === 'agent' &&
        (!identities.has('role:' + entry.roleId) || !identities.has('position:' + entry.positionId))) {
      throw Error('invalid_configuration_reference');
    }
  }
  const intents = new Set<string>();
  for (const receipt of state.receipts) {
    if (!receipt || !validId(receipt.intent) || intents.has(receipt.intent) ||
        typeof receipt.command !== 'string' ||
        !isDeepStrictEqual(Object.keys(receipt).sort(), ['command', 'entry', 'intent'])) {
      throw Error('invalid_configuration_receipt');
    }
    entryValid(receipt.entry);
    const entry = receipt.entry;
    const current = state.entries.find(item => item.kind === entry.kind && item.id === entry.id);
    if (!current || current.revision < entry.revision ||
        (current.revision === entry.revision && !isDeepStrictEqual(current, entry)) ||
        !isDeepStrictEqual(JSON.parse(receipt.command), {
          id: entry.id, expectedRevision: entry.revision - 1, value: normalize(entry),
        })) throw Error('invalid_configuration_receipt');
    intents.add(receipt.intent);
  }
  for (const entry of state.entries) {
    if (!state.receipts.some(receipt => isDeepStrictEqual(receipt.entry, entry))) {
      throw Error('missing_configuration_receipt');
    }
  }
}

