/** Ephemeral trusted-host context. Not serialized, persisted, or accepted from model/Renderer payloads.
 * check revalidates the original request and, for configured dispatch, the captured connection.
 * It expires when this invocation returns or throws. It is never a reusable authorization grant.
 */
export interface AdapterAccess {readonly request:object;check():boolean}
