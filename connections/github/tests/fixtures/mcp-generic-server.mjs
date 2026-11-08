import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {ListToolsRequestSchema,CallToolRequestSchema} from '@modelcontextprotocol/sdk/types.js';
const mode=process.argv[2];
if(!process.argv.includes('--toolsets=all')||process.argv.includes('--read-only'))process.exit(2);
const server=new Server({name:'github-mcp-server',version:'9.9.9'},{capabilities:{tools:{}}});
const tool=name=>({name,description:'fixture',annotations:{readOnlyHint:true},inputSchema:{type:'object',properties:{method:{type:'string'}},additionalProperties:true}});
server.setRequestHandler(ListToolsRequestSchema,async request=>{
 const next=request.params?.cursor;
 if(mode==='cycle')return {tools:[tool(next?'pull_request_read':'get_file_contents')],nextCursor:'same'};
 if(next&&mode==='idle-exit')setTimeout(()=>process.exit(1),500);
 if(next)return {tools:[tool(mode==='duplicate'?'get_file_contents':'pull_request_read'),tool('actions_list')]};
 return {tools:[tool('get_file_contents')],nextCursor:'next'};
});
server.setRequestHandler(CallToolRequestSchema,async request=>{
 if(mode==='exit')process.exit(1);
 if(mode==='slow')await new Promise(r=>setTimeout(r,500));
 const args=request.params.arguments;
 if(args?.fail)return {isError:true,content:[{type:'text',text:'business failure'}],structuredContent:{reason:'fixture_failure'}};
 return {content:[{type:'text',text:'fixture result'}],structuredContent:{name:request.params.name,arguments:args,pid:process.pid}};
});
await server.connect(new StdioServerTransport());
