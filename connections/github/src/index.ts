export type {GitHubOfficialClient,GitHubClientFactory,GitHubOfficialClientOptions} from './official-client.js';
export {createGitHubOfficialClientFactory} from './official-client.js';
export {githubFileTarget} from './file-target.js';
export type {GitHubFile} from './file-target.js';
export {createGitHubFileReader,createGitHubFileAdapter,createGitHubConfiguredFileReader} from './file-adapters.js';
export type {GitHubMcpRuntime,GitHubMcpOptions} from './mcp-options.js';
export {createGitHubMcpFileReader} from './mcp-file-reader.js';
export {githubCredentialRef,githubCredentialTarget} from './credentials.js';

/** General official GitHub MCP client adapter; separate from legacy file-only compatibility. */
export {createGitHubMcpAdapter} from './mcp.js';
export type {GitHubMcpAdapter,GitHubMcpAdapterOptions,GitHubMcpToolResult} from './mcp.js';

export {createGitHubMcpCapabilityAdapter} from './mcp-connections.js';
