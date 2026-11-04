#!/usr/bin/env python3
"""Read-only repository documentation audit; writes only the selected JSON report."""
import argparse,collections,hashlib,json,os,re,subprocess,unicodedata
from pathlib import Path
from urllib.parse import unquote,urlsplit
ROOT=Path(__file__).resolve().parents[3]
EXT={'.md','.mdx','.txt','.rst','.adoc','.org'}
def prose(t):
 return re.sub(r'^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^(?:`{3,}|~{3,})[^\n]*$','',t,flags=re.M)
def slug(t):
 t=re.sub(r'<[^>]*>','',t);t=re.sub(r'!?\[([^]]*)\]\([^)]*\)',r'\1',t)
 t=t.lower().strip().replace('`','')
 return ''.join(c for c in t if c in '-_' or not unicodedata.category(c).startswith(('P','S'))).replace(' ','-')
def anchors(t):
 counts=collections.Counter();out=set()
 for m in re.finditer(r'^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$',prose(t),re.M):
  s=slug(m[1]);n=counts[s];counts[s]+=1;out.add(s+(f'-{n}' if n else ''))
 for m in re.finditer(r'<(?:a|h[1-6])\b[^>]*\b(?:id|name)=["\']([^"\']+)',t,re.I):out.add(m[1])
 return out
# Inline destinations with balanced parentheses, reference-style links and HTML targets.
def links(t):
 t=prose(t);defs={}
 for m in re.finditer(r'^\s{0,3}\[([^]]+)\]:\s*<?([^\s>]+)>?',t,re.M):defs[m[1].casefold()]=m[2]
 for m in re.finditer(r'!?\[[^\]\n]*\]\(\s*(<[^>]+>|(?:[^\s()]|\([^()]*\))+)',t):yield m[1].strip('<>')
 for m in re.finditer(r'!?\[([^]\n]+)\]\[([^]\n]*)\]',t):
  key=(m[2] or m[1]).casefold()
  if key in defs:yield defs[key]
 for m in re.finditer(r'<(?:a|img)\b[^>]*\b(?:href|src)=["\']([^"\']+)',t,re.I):yield m[1]
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--output');args=ap.parse_args()
 paths=subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z'],cwd=ROOT).decode().split('\0')[:-1]
 docs=sorted(set(p for p in paths if Path(p).suffix.lower() in EXT and (ROOT/p).is_file()))
 texts={p:(ROOT/p).read_text() for p in docs};heads={p:anchors(t) for p,t in texts.items() if Path(p).suffix in {'.md','.mdx'}}
 issues=[];remote=set();checked=0
 for p,t in texts.items():
  if p not in heads:continue
  for u in links(t):
   if re.match(r'^(?:[a-zA-Z][\w+.-]*:|//)',u):remote.add(u);continue
   checked+=1
   try:
    if re.search(r'%(?![0-9a-fA-F]{2})',u):raise ValueError('invalid percent encoding')
    z=urlsplit(u);target=unquote(z.path,errors='strict');anchor=unquote(z.fragment,errors='strict')
    dest=os.path.normpath(os.path.join(os.path.dirname(p),target)) if target else p
    kind=None
    if dest.startswith('../') or target.startswith('/'):kind='outside-repository'
    elif not (ROOT/dest).exists():kind='missing-path'
    elif anchor and dest in heads and anchor not in heads[dest]:kind='missing-anchor'
    if kind:issues.append({'file':p,'link':u,'target':dest,'kind':kind,'scope':'external' if p.startswith(('references/','dsh/upstream/')) else 'owned'})
   except (ValueError,UnicodeError):issues.append({'file':p,'link':u,'kind':'invalid-encoding','scope':'owned'})
 report={'method':'Git complete file list; MD/MDX inline/reference/HTML local links, exact-case filesystem, percent decoding, GFM-style ATX heading slugs with duplicate suffixes and HTML IDs; external URLs inventoried, not fetched','limitations':['No remote HTTP availability claim','No generated/dynamic HTML anchors or setext heading renderer validation','No full 216-item semantic acceptance or Windows runtime claim'],'documents':len(docs),'extensions':dict(collections.Counter(Path(p).suffix for p in docs)),'localLinks':checked,'remoteUrlsNotFetched':sorted(remote),'issues':issues,'ownedIssues':sum(x['scope']=='owned' for x in issues),'externalIssues':sum(x['scope']=='external' for x in issues)}
 if args.output:Path(args.output).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({k:v for k,v in report.items() if k not in {'remoteUrlsNotFetched','issues'}},ensure_ascii=False,indent=2))
 for x in issues:
  if x['scope']=='owned':print(x)
 return bool(report['ownedIssues'])
if __name__=='__main__':raise SystemExit(main())
