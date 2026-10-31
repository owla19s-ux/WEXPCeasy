#!/usr/bin/env python3
"""Isolated SQLite mechanism probes for PRD-C07/C11/C12. Not WEX product code."""
import json, os, sqlite3, tempfile, multiprocessing as mp


def init(path, sql):
    c=sqlite3.connect(path); c.executescript(sql); c.commit(); c.close()


def c12_same(path, barrier, q, role):
    c=sqlite3.connect(path, timeout=10); barrier.wait()
    try:
        c.execute("BEGIN IMMEDIATE")
        exists=c.execute("SELECT state FROM objects WHERE id='x'").fetchone()
        refs=c.execute("SELECT COUNT(*) FROM refs WHERE target='x'").fetchone()[0]
        if role=="delete":
            if not exists or refs: c.rollback(); q.put((role,"blocked"))
            else: c.execute("DELETE FROM objects WHERE id='x'"); c.commit(); q.put((role,"deleted"))
        elif not exists or exists[0]!="active":
            c.rollback(); q.put((role,"rejected"))
        else:
            c.execute("INSERT INTO refs VALUES('s','x')"); c.commit(); q.put((role,"referenced"))
    except Exception as e:
        try:c.rollback()
        except Exception:pass
        q.put((role,"error:"+repr(e)))
    finally:c.close()


def c12_delete_separate(obj, refs, checked, inserted, q):
    c=sqlite3.connect(refs); n=c.execute("SELECT COUNT(*) FROM refs WHERE target='x'").fetchone()[0]; c.close()
    q.put(("delete-check",n)); checked.set(); inserted.wait(10)
    c=sqlite3.connect(obj); c.execute("DELETE FROM objects WHERE id='x'"); c.commit(); c.close()
    q.put(("delete","deleted-after-stale-check"))


def c12_add_separate(refs, checked, inserted, q):
    checked.wait(10); c=sqlite3.connect(refs); c.execute("INSERT INTO refs VALUES('s','x')"); c.commit(); c.close()
    inserted.set(); q.put(("reference","inserted"))


def c11_consume(path, intent, barrier, q):
    c=sqlite3.connect(path, timeout=10); barrier.wait()
    try:
        c.execute("BEGIN IMMEDIATE")
        prior=c.execute("SELECT outcome FROM uses WHERE intent=?",(intent,)).fetchone()
        if prior: c.commit(); q.put((intent,"replayed:"+prior[0])); return
        cur=c.execute("UPDATE permits SET remaining=remaining-1 WHERE id='p' AND remaining>0")
        if cur.rowcount==1:
            c.execute("INSERT INTO uses VALUES(?,?)",(intent,"consumed")); c.commit(); q.put((intent,"consumed"))
        else: c.rollback(); q.put((intent,"denied_exhausted"))
    except Exception as e:
        try:c.rollback()
        except Exception:pass
        q.put((intent,"error:"+repr(e)))
    finally:c.close()


def main():
    ctx=mp.get_context("fork"); result={}
    with tempfile.TemporaryDirectory(prefix="wex-product-c-") as d:
        # C12 positive: object and reference guard share one transactional authority.
        p=os.path.join(d,"same.sqlite")
        init(p,"CREATE TABLE objects(id TEXT PRIMARY KEY,state TEXT); CREATE TABLE refs(source TEXT,target TEXT); INSERT INTO objects VALUES('x','active');")
        b=ctx.Barrier(2); q=ctx.Queue()
        ps=[ctx.Process(target=c12_same,args=(p,b,q,"delete")),ctx.Process(target=c12_same,args=(p,b,q,"ref"))]
        [x.start() for x in ps]; [x.join(15) for x in ps]
        outcomes=[q.get(timeout=2) for _ in ps]
        c=sqlite3.connect(p); obj=c.execute("SELECT COUNT(*) FROM objects WHERE id='x'").fetchone()[0]; ref=c.execute("SELECT COUNT(*) FROM refs WHERE target='x'").fetchone()[0]; c.close()
        result["C12_same_transaction"]={"outcomes":sorted(outcomes),"objects":obj,"refs":ref,"dangling":bool(ref and not obj),"pass":not(ref and not obj) and (obj,ref) in [(0,0),(1,1)]}

        # C12 negative control: separate stores with check-then-act can leave a dangling ref.
        op=os.path.join(d,"objects.sqlite"); rp=os.path.join(d,"refs.sqlite")
        init(op,"CREATE TABLE objects(id TEXT PRIMARY KEY); INSERT INTO objects VALUES('x');")
        init(rp,"CREATE TABLE refs(source TEXT,target TEXT);")
        checked=ctx.Event(); inserted=ctx.Event(); q=ctx.Queue()
        ps=[ctx.Process(target=c12_delete_separate,args=(op,rp,checked,inserted,q)),ctx.Process(target=c12_add_separate,args=(rp,checked,inserted,q))]
        [x.start() for x in ps]; [x.join(15) for x in ps]
        events=[q.get(timeout=2) for _ in range(3)]
        c=sqlite3.connect(op); obj=c.execute("SELECT COUNT(*) FROM objects").fetchone()[0]; c.close()
        c=sqlite3.connect(rp); ref=c.execute("SELECT COUNT(*) FROM refs").fetchone()[0]; c.close()
        result["C12_separate_store_negative"]={"events":events,"objects":obj,"refs":ref,"dangling":bool(ref and not obj),"pass_negative_control":bool(ref and not obj)}

        # C11 positive: one remaining use, eight distinct concurrent intents, same-intent replay.
        p=os.path.join(d,"permit.sqlite")
        init(p,"CREATE TABLE permits(id TEXT PRIMARY KEY,remaining INTEGER); CREATE TABLE uses(intent TEXT PRIMARY KEY,outcome TEXT); INSERT INTO permits VALUES('p',1);")
        intents=[f"i{i}" for i in range(8)]; b=ctx.Barrier(len(intents)); q=ctx.Queue()
        ps=[ctx.Process(target=c11_consume,args=(p,x,b,q)) for x in intents]
        [x.start() for x in ps]; [x.join(20) for x in ps]
        outcomes=[q.get(timeout=2) for _ in ps]; winner=next(k for k,v in outcomes if v=="consumed")
        c11_consume(p,winner,ctx.Barrier(1),q); replay=q.get(timeout=2)
        c=sqlite3.connect(p); remaining=c.execute("SELECT remaining FROM permits WHERE id='p'").fetchone()[0]; uses=c.execute("SELECT COUNT(*) FROM uses").fetchone()[0]; c.close()
        result["C11_atomic_consume"]={"outcomes":sorted(outcomes),"winner":winner,"replay":replay,"remaining":remaining,"use_records":uses,"pass":sum(v=="consumed" for _,v in outcomes)==1 and remaining==0 and uses==1 and replay==(winner,"replayed:consumed")}

        # C07 negative control: sequential independent backups can mix generations.
        a=os.path.join(d,"a.sqlite"); bdb=os.path.join(d,"b.sqlite")
        init(a,"CREATE TABLE state(rev INTEGER); INSERT INTO state VALUES(1);")
        init(bdb,"CREATE TABLE state(rev INTEGER); INSERT INTO state VALUES(1);")
        ba=os.path.join(d,"a-backup.sqlite"); bb=os.path.join(d,"b-backup.sqlite")
        src=sqlite3.connect(a); dst=sqlite3.connect(ba); src.backup(dst); dst.close(); src.close()
        for path in (a,bdb):
            c=sqlite3.connect(path); c.execute("UPDATE state SET rev=2"); c.commit(); c.close()
        src=sqlite3.connect(bdb); dst=sqlite3.connect(bb); src.backup(dst); dst.close(); src.close()
        revs=[]
        for path in (ba,bb):
            c=sqlite3.connect(path); revs.append(c.execute("SELECT rev FROM state").fetchone()[0]); c.close()
        result["C07_sequential_backup_negative"]={"backup_revisions":revs,"mixed_generation":revs==[1,2],"pass_negative_control":revs==[1,2]}
    print(json.dumps(result,ensure_ascii=False,indent=2))
    if not all(x.get("pass",x.get("pass_negative_control",False)) for x in result.values()): raise SystemExit(1)


if __name__=="__main__": main()
