import type {AdapterAccess,ConnectionConfig} from '../../src/index.js';
/** Trusted installation facts, never a Renderer/model command interface. */
export interface GitHubMcpRuntime {
 command:string;expectedSha256:string;prefixArgs?:readonly string[];
}
export interface GitHubMcpOptions {
 runtime:Readonly<GitHubMcpRuntime>;
 resolveCredential(connection:Readonly<ConnectionConfig>,access:AdapterAccess):Promise<string|undefined>;
 timeoutMs?:number;
}
