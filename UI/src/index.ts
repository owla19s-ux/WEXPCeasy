/** Serializable technical bridge only; business requests require separate reviewed contracts. */
export interface DesktopStatus {phase:'starting'|'ready'|'degraded'|'failed'|'stopping'|'release-pending';diagnostics:readonly {module:string;reason:string}[]}
export type HostReply<T>={ok:true;value:T}|{ok:false;error:string};
export interface DesktopBridge {readStatus():Promise<HostReply<DesktopStatus>>;requestQuit():Promise<HostReply<{accepted:true}>>}
