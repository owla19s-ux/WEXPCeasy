import {DatabaseSync} from 'node:sqlite';
export type Json = null | boolean | number | string | Json[] | {[key: string]: Json};
export interface Snapshot {readonly revision: number; readonly value: Json}
export interface Commit {readonly intent: string; readonly expectedRevision: number; readonly value: Json}
export type CommitResult = {readonly status:'committed'; readonly intent:string; readonly revision:number}
 | {readonly status:'not_committed'; readonly reason:'revision_conflict'|'intent_conflict'|'invalid_request'|'storage_unavailable'}
 | {readonly status:'unknown'; readonly intent:string};
export interface Store {read():Snapshot; commit(input:Commit):CommitResult; query(intent:string):Extract<CommitResult,{status:'committed'}>|undefined}
export interface ManagedStore extends Store {close():void}
export interface SqlitePort {exec(sql:string):void; prepare(sql:string):{get(...args:(string|number)[]):unknown;run(...args:(string|number)[]):unknown};close():void}

function canonical(value: Json): string {
 if(value===null || typeof value==='string'||typeof value==='boolean') return JSON.stringify(value);
 if(typeof value==='number') {if(!Number.isFinite(value))throw Error('invalid JSON');return JSON.stringify(value);}
 if(Array.isArray(value))return '['+Array.from(value,canonical).join(',')+']';
 if(typeof value!=='object'||Object.getPrototypeOf(value)!==Object.prototype)throw Error('invalid JSON');
 return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k]!)).join(',')+'}';
}
/** One namespace aggregate + its intent records in one SQLite transaction. No external atomicity. */
export function createSqliteStore(db:SqlitePort,namespace:string):ManagedStore {
 if(!/^[a-z][a-z0-9-]{0,63}$/.test(namespace))throw Error('invalid namespace');
 db.exec('PRAGMA busy_timeout=1000; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS snapshots(ns TEXT PRIMARY KEY, revision INTEGER NOT NULL, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS intents(ns TEXT NOT NULL,id TEXT NOT NULL,request TEXT NOT NULL,revision INTEGER NOT NULL,PRIMARY KEY(ns,id));');
 const query=(intent:string)=>{
 const row=db.prepare('SELECT revision FROM intents WHERE ns=? AND id=?').get(namespace,intent) as {revision:number}|undefined;
 return row?{status:'committed' as const,intent,revision:row.revision}:undefined;
 };
 const read=():Snapshot=>{
 const row=db.prepare('SELECT revision,body FROM snapshots WHERE ns=?').get(namespace) as {revision:number;body:string}|undefined;
 if(!row){
  if(db.prepare('SELECT revision FROM intents WHERE ns=? LIMIT 1').get(namespace))throw Error('snapshot_missing_with_intents');
  return {revision:0,value:null};
 }
 if(!Number.isSafeInteger(row.revision)||row.revision<1)throw Error('corrupt_snapshot_revision');
 return {revision:row.revision,value:JSON.parse(row.body) as Json};
 };
 return Object.freeze({
 read,
 query,
 commit(input:Commit):CommitResult {
 let request:string;
 try {if(!input.intent || input.intent.length>256 || !Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0)throw Error();request=canonical({expectedRevision:input.expectedRevision,value:input.value});}catch{return {status:'not_committed',reason:'invalid_request'};}
 let begun=false,committing=false;
 try {
 db.exec('BEGIN IMMEDIATE');begun=true;
 const old=db.prepare('SELECT request,revision FROM intents WHERE ns=? AND id=?').get(namespace,input.intent) as {request:string;revision:number}|undefined;
 if(old){db.exec('ROLLBACK');begun=false;return old.request===request?{status:'committed',intent:input.intent,revision:old.revision}:{status:'not_committed',reason:'intent_conflict'};}
 const snapshot=read();
 if(snapshot.revision!==input.expectedRevision){db.exec('ROLLBACK');begun=false;return {status:'not_committed',reason:'revision_conflict'};}
 const revision=input.expectedRevision+1;
 db.prepare('INSERT INTO snapshots(ns,revision,body) VALUES(?,?,?) ON CONFLICT(ns) DO UPDATE SET revision=excluded.revision,body=excluded.body').run(namespace,revision,canonical(input.value));
 db.prepare('INSERT INTO intents(ns,id,request,revision) VALUES(?,?,?,?)').run(namespace,input.intent,request,revision);
 committing=true;db.exec('COMMIT');begun=false;
 return {status:'committed',intent:input.intent,revision};
 }catch{
 if(begun)try{db.exec('ROLLBACK');}catch{/* retain unknown; never overwrite */}
 return committing?{status:'unknown',intent:input.intent}:{status:'not_committed',reason:'storage_unavailable'};
 }
 },
 close(){db.close();}
 });
}
export function openSqliteStore(path:string,namespace:string):ManagedStore {
 const db=new DatabaseSync(path);
 try{return createSqliteStore(db,namespace);}catch(error){db.close();throw error;}
}
