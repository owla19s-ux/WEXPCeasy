import {writeFile} from 'node:fs/promises';
import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {ListToolsRequestSchema,CallToolRequestSchema} from '@modelcontextprotocol/sdk/types.js';
const mode=process.argv[2];
const server=new Server({name:'github-mcp-server',version:'future-source-build'},{capabilities:{tools:{}}});
const names=['get_repository','pull_request_read','actions_list'];
let calls=0;
server.setRequestHandler(ListToolsRequestSchema,async request=>{
 const page=request.params?.cursor==='next'?1:0;
 if(mode==='slow-list')await new Promise(r=>setTimeout(r,5000));
 return {tools:(page?names.slice(1):names.slice(0,1)).map(name=>({
  name,description:'official fixture '+name,inputSchema:{type:'object',properties:{nested:{type:'object'}}},
  annotations:{readOnlyHint:true},_meta:{fixture:true}
 })),...(!page||mode==='cursor-loop'?{nextCursor:'next'}:{})};
});
server.setRequestHandler(CallToolRequestSchema,async request=>{
 calls++;
 if(mode==='exit')process.exit(1);
 if(mode==='slow'&&process.argv[3]!=='stdio')await writeFile(process.argv[3],'dispatched');
 if(mode==='slow')await new Promise(r=>setTimeout(r,5000));
 return {content:[{type:'text',text:request.params.name}],structuredContent:{
  arguments:request.params.arguments,calls,pid:process.pid,cwd:process.cwd(),
  allTools:process.argv.includes('--toolsets=all'),
  readOnly:process.argv.includes('--read-only')
 },...(request.params.arguments?.fail?{isError:true}:{})};
});
await server.connect(new StdioServerTransport());
