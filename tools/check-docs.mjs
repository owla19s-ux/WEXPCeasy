#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve(process.argv.includes('--root') ? process.argv[process.argv.indexOf('--root') + 1] : '.');
const strict = process.argv.includes('--strict');
const json = process.argv.includes('--json');
const skip = new Set(['.git','node_modules','dist','build','.build','.next','coverage']);
const files = [];
function walk(dir) {
  for (const ent of fs.readdirSync(dir,{withFileTypes:true})) {
    if (skip.has(ent.name)) continue;
    const p=path.join(dir,ent.name);
    if(ent.isDirectory()) walk(p);
    else if(ent.isFile() && /\.md$/i.test(ent.name)) files.push(p);
  }
}
walk(root);
const issues=[]; const hashes=new Map(); let links=0;let redirects=0;
const externalRoots=['references/','dsh/upstream/'];
const scopeOf=(file)=>externalRoots.some(prefix=>file.startsWith(prefix))?'external-snapshot':'wex-owned';
for (const file of files) {
  const rel=path.relative(root,file).replaceAll(path.sep,'/');
  const body=fs.readFileSync(file,'utf8');
  const hash=crypto.createHash('sha256').update(body.replace(/\r\n/g,'\n').trim()).digest('hex');
  if (hashes.has(hash)) issues.push({kind:'duplicate-exact',file:rel,other:hashes.get(hash),scope:scopeOf(rel)});
  else hashes.set(hash,rel);
  if(body.startsWith('# 文档位置已调整')) redirects++;
  const prose=body.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^(?:`{3,}|~{3,})[^\n]*$/gm,'');
  const re=/!?\[[^\]\n]*\]\((<[^>]+>|[^\s)]+)(?:\s+"[^"]*")?\)/g;
  for(const match of prose.matchAll(re)) {
    let target=match[1].replace(/^<|>$/g,'');
    if(!target || target.startsWith('#') || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(target)) continue;
    target=target.split('#')[0].split('?')[0];
    try {target=decodeURIComponent(target);}catch{issues.push({kind:'invalid-encoding',file:rel,link:target,scope:scopeOf(rel)});continue;}
    links++;
    if(path.isAbsolute(target)) {issues.push({kind:'absolute-local-link',file:rel,link:target,scope:scopeOf(rel)});continue;}
    const resolved=path.resolve(path.dirname(file),target);
    if(!resolved.startsWith(root+path.sep) && resolved!==root) {issues.push({kind:'outside-repository',file:rel,link:target,scope:scopeOf(rel)});continue;}
    if(!fs.existsSync(resolved)) issues.push({kind:'broken-local-link',file:rel,link:target,scope:scopeOf(rel)});
  }
}
const ownedIssues=issues.filter(issue=>issue.scope==='wex-owned');
const externalIssues=issues.filter(issue=>issue.scope==='external-snapshot');
const report={root,markdownFiles:files.length,checkedLocalLinks:links,legacyRedirectPages:redirects,issueCount:issues.length,ownedIssueCount:ownedIssues.length,externalSnapshotIssueCount:externalIssues.length,issues};
if(json) console.log(JSON.stringify(report,null,2));
else {
 console.log(`Markdown: ${files.length}; local links: ${links}; redirect pages: ${redirects}; issues: ${issues.length} (WEX: ${ownedIssues.length}, external snapshots: ${externalIssues.length})`);
 for(const issue of issues) console.log(`${issue.kind}: ${issue.file} -> ${issue.link??issue.other}`);
}
if(strict && ownedIssues.length) process.exitCode=1;
