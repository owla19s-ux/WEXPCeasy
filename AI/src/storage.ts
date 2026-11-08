import type { Store } from '../../shared/src/index.js';
import type { State } from './model.js';
import { validateState } from './validation.js';

export function readConfigurationState(store:Store) {
  const snapshot = store.read();
  const state = snapshot.revision === 0 && snapshot.value === null
    ? { version: 1, entries: [], receipts: [] } as State
    : snapshot.value as unknown as State;
  validateState(state);
  return { revision: snapshot.revision, state };
}

/** Trusted host-only readiness check. Returns no configuration, identity, revision, or permission facts. */
export function inspectAiConfigurationStore(store:Store):{status:'ready'|'unavailable'} {
 try{readConfigurationState(store);return {status:'ready'};}catch{return {status:'unavailable'};}
}

