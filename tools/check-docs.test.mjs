import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const script = new URL('./check-docs.mjs', import.meta.url).pathname;

test('reports missing links and exact duplicate Markdown, with strict exit', () => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'wex-doc-audit-'));
  try {
    fs.mkdirSync(path.join(root,'docs'));
    fs.writeFileSync(path.join(root,'docs','a.md'),'# A\n[ok](b.md)\n[bad](missing.md)\n');
    fs.writeFileSync(path.join(root,'docs','b.md'),'# B\n');
    fs.writeFileSync(path.join(root,'docs','c.md'),'# B\n');
    const run=spawnSync(process.execPath,[script,'--root',root,'--json','--strict'],{encoding:'utf8'});
    assert.equal(run.status,1);
    const report=JSON.parse(run.stdout);
    assert.equal(report.markdownFiles,3);
    assert.equal(report.checkedLocalLinks,2);
    assert.equal(report.issueCount,2);
    assert.ok(report.issues.some(x=>x.kind==='broken-local-link'));
    assert.ok(report.issues.some(x=>x.kind==='duplicate-exact'));
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});

test('accepts valid relative links and fragment-only links', () => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'wex-doc-audit-'));
  try {
    fs.writeFileSync(path.join(root,'a.md'),'# A\n[local](b.md#heading)\n[anchor](#heading)\n');
    fs.writeFileSync(path.join(root,'b.md'),'# B\n');
    const run=spawnSync(process.execPath,[script,'--root',root,'--json','--strict'],{encoding:'utf8'});
    assert.equal(run.status,0,run.stdout+run.stderr);
    assert.equal(JSON.parse(run.stdout).issueCount,0);
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});


test('ignores Markdown-looking links inside fenced code', () => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'wex-doc-audit-'));
  try {
    fs.writeFileSync(path.join(root,'a.md'),'# A\\n\\`\\`\\`md\\n[not a link](missing.md)\\n\\`\\`\\`\\n');
    const run=spawnSync(process.execPath,[script,'--root',root,'--json','--strict'],{encoding:'utf8'});
    assert.equal(run.status,0,run.stdout+run.stderr);
    assert.equal(JSON.parse(run.stdout).checkedLocalLinks,0);
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});
