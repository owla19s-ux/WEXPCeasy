import type { VerifyModel } from './model.js';

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
