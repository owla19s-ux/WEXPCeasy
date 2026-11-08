import {DatabaseSync} from 'node:sqlite';
export type Json = null | boolean | number | string | Json[] | {[key: string]: Json};
export interface Snapshot {readonly revision: number; readonly value: Json}
export interface Commit {readonly intent: string; readonly expectedRevision: number; readonly value: Json}
export type CommitResult = {readonly status:'committed'; readonly intent:string; readonly revision:number}
 | {readonly status:'not_committed'; readonly reason:'revision_conflict'|'intent_conflict'|'invalid_request'|'storage_unavailable'}
 | {readonly status:'unknown'; readonly intent:string};
export interface Store {read():Snapshot; commit(input:Commit):CommitResult; query(intent:string):Extract<CommitResult,{status:'committed'}>|undefined}
export interface ManagedStore extends Store {close():void}
export interface SqlitePort {
 /** Native connection fact. Without it a failed rollback requires closing/reopening before recovery. */
 readonly isTransaction?:boolean;
 exec(sql:string):void; prepare(sql:string):{get(...args:(string|number)[]):unknown;run(...args:(string|number)[]):unknown};close():void
}
function plain(value:unknown):value is Record<string,unknown>{
 return !!value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
}
function fields(value:Record<string,unknown>,keys:string[]):boolean{
 return Reflect.ownKeys(value).length===keys.length&&keys.every(key=>{
  const descriptor=Object.getOwnPropertyDescriptor(value,key);
  return !!descriptor&&Object.hasOwn(descriptor,'value')&&descriptor.enumerable===true;
 });
}
function canonical(value:Json,ancestors=new Set<object>()):string{
 if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
 if(typeof value==='number'){if(!Number.isFinite(value))throw Error('invalid_json');return JSON.stringify(value);}
 if(typeof value!=='object'||ancestors.has(value))throw Error('invalid_json');
 ancestors.add(value);
 try{
  if(Array.isArray(value)){
   if(Reflect.ownKeys(value).length!==value.length+1)throw Error('invalid_json_array');
   const items:string[]=[];
   for(let index=0;index<value.length;index++){
    const descriptor=Object.getOwnPropertyDescriptor(value,String(index));
    if(!descriptor||!Object.hasOwn(descriptor,'value')||!descriptor.enumerable)throw Error('invalid_json_array');
    items.push(canonical(descriptor.value as Json,ancestors));
   }
   return '['+items.join(',')+']';
  }
  if(!plain(value))throw Error('invalid_json_object');
  const keys=Object.keys(value);
  if(!fields(value,keys))throw Error('invalid_json_object');
  return '{'+keys.sort().map(key=>JSON.stringify(key)+':'+canonical(value[key] as Json,ancestors)).join(',')+'}';
 }finally{ancestors.delete(value);}
}
function intentId(value:unknown):value is string{
 return typeof value==='string'&&value.length>0&&value.length<=256&&Buffer.from(value,'utf8').toString('utf8')===value;
}
function storedJson(body:unknown):Json{
 if(typeof body!=='string')throw Error('corrupt_json');
 try{const value=JSON.parse(body) as Json;
  if(canonical(value)!==body)throw Error('corrupt_json');return value;
 }catch{throw Error('corrupt_json');}
}
interface HeadRow {
 revision:number|null;body:string|null;receiptCount:number;distinctRevisions:number;
 firstRevision:number|null;lastRevision:number|null;invalidRevisions:number;latestRequest:string|null;latestIntentId:string|null;
 intentId?:string|null;intentRevision?:number|null;intentRequest?:string|null;
}
/** One namespace aggregate and its intent proofs in a single SQLite transaction.
 * A receipt proves a durable technical commit, never success of an external operation.
 * Reads/query use one SQLite statement so concurrent commits cannot mix proof generations.
 */
export function createSqliteStore(db:SqlitePort,namespace:string):ManagedStore{
 if(typeof namespace!=='string'||!/^[a-z][a-z0-9-]{0,63}$/.test(namespace))throw Error('invalid_namespace');
 db.exec('PRAGMA busy_timeout=1000; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS snapshots(ns TEXT PRIMARY KEY, revision INTEGER NOT NULL, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS intents(ns TEXT NOT NULL,id TEXT NOT NULL,request TEXT NOT NULL,revision INTEGER NOT NULL,PRIMARY KEY(ns,id));');
 // This index changes no stored domain data; an old read-only database remains readable without it.
 try{db.exec('CREATE INDEX IF NOT EXISTS intents_namespace_revision ON intents(ns,revision)');}
 catch(error){const code=(error as {errcode?:unknown}).errcode;if(typeof code!=='number'||(code&255)!==8)throw error;}
 let quarantined=false,closed=false,busy=false;
 const transactionState=():boolean|undefined=>{try{return typeof db.isTransaction==='boolean'?db.isTransaction:undefined;}catch{return undefined;}};
 function ready(){
  if(closed||quarantined||busy||transactionState()===true)throw Error('storage_unavailable');
 }
 const columns='s.revision,s.body,h.receiptCount,h.distinctRevisions,h.firstRevision,h.lastRevision,h.invalidRevisions,latest.request AS latestRequest,latest.id AS latestIntentId';
 const source=" FROM (SELECT 1) seed LEFT JOIN snapshots s ON s.ns=? CROSS JOIN (SELECT COUNT(*) AS receiptCount,COUNT(DISTINCT revision) AS distinctRevisions,MIN(revision) AS firstRevision,MAX(revision) AS lastRevision,COALESCE(SUM(CASE WHEN typeof(revision)<>'integer' OR revision<1 OR revision>9007199254740991 THEN 1 ELSE 0 END),0) AS invalidRevisions FROM intents WHERE ns=?) h LEFT JOIN intents latest ON latest.ns=? AND latest.revision=s.revision";
 function row(intent?:string):HeadRow{
  return db.prepare('SELECT '+columns+(intent===undefined?'':',found.id AS intentId,found.revision AS intentRevision,found.request AS intentRequest')+source+
   (intent===undefined?'':' LEFT JOIN intents found ON found.ns=? AND found.id=?')).get(namespace,namespace,namespace,...(intent===undefined?[]:[namespace,intent])) as HeadRow;
 }
 function checkedHead(result:HeadRow):Snapshot{
  if(!result||!Number.isSafeInteger(result.receiptCount)||result.receiptCount<0)throw Error('corrupt_storage');
  if(result.revision===null){
   if(result.receiptCount!==0||result.body!==null)throw Error('snapshot_missing_with_intents');
   return {revision:0,value:null};
  }
  const revision=result.revision;
  if(!Number.isSafeInteger(revision)||revision<1||result.receiptCount!==revision||
   result.distinctRevisions!==revision||result.firstRevision!==1||result.lastRevision!==revision||result.invalidRevisions!==0)throw Error('corrupt_storage_revision');
  const value=storedJson(result.body);
  if(!intentId(result.latestIntentId))throw Error('corrupt_latest_intent');
  if(result.latestRequest!=='{"expectedRevision":'+(revision-1)+',"value":'+result.body+'}')throw Error('snapshot_receipt_mismatch');
  return {revision,value};
 }
 function checkedReceipt(result:HeadRow,head:Snapshot,intent:string){
  if(result.intentId===null)return;
  const revision=result.intentRevision;
  if(result.intentId!==intent||typeof revision!=='number'||!Number.isSafeInteger(revision)||revision<1||revision>head.revision)throw Error('corrupt_intent_revision');
  const request=storedJson(result.intentRequest);
  if(!plain(request)||!fields(request,['expectedRevision','value'])||!Number.isSafeInteger(request.expectedRevision)||
   Number(request.expectedRevision)<0||Number(request.expectedRevision)+1!==revision)throw Error('corrupt_intent_request');
  return {status:'committed' as const,intent,revision,request:result.intentRequest!};
 }
 const read=():Snapshot=>{ready();return checkedHead(row());};
 const query=(intent:string)=>{
  if(!intentId(intent))throw Error('invalid_intent');ready();
  const result=row(intent),head=checkedHead(result),proof=checkedReceipt(result,head,intent);
  return proof?{status:'committed' as const,intent,revision:proof.revision}:undefined;
 };
 return Object.freeze({read,query,
  commit(input:Commit):CommitResult{
   let intent:string,expectedRevision:number,body:string,request:string;
   try{
    if(!plain(input)||!fields(input,['intent','expectedRevision','value'])||!intentId(input.intent)||
     !Number.isSafeInteger(input.expectedRevision)||Number(input.expectedRevision)<0||Number(input.expectedRevision)>=Number.MAX_SAFE_INTEGER)throw Error('invalid_commit');
    intent=input.intent;expectedRevision=Number(input.expectedRevision);body=canonical(input.value as Json);
    request='{"expectedRevision":'+expectedRevision+',"value":'+body+'}';
   }catch{return {status:'not_committed',reason:'invalid_request'};}
   try{ready();}catch{return {status:'not_committed',reason:'storage_unavailable'};}
   let committing=false;busy=true;
   try{
    db.exec('BEGIN IMMEDIATE');
    const result=row(intent),snapshot=checkedHead(result),old=checkedReceipt(result,snapshot,intent);
    if(old){db.exec('ROLLBACK');return old.request===request?{status:'committed',intent,revision:old.revision}:{status:'not_committed',reason:'intent_conflict'};}
    if(snapshot.revision!==expectedRevision){db.exec('ROLLBACK');return {status:'not_committed',reason:'revision_conflict'};}
    const revision=expectedRevision+1;
    db.prepare('INSERT INTO snapshots(ns,revision,body) VALUES(?,?,?) ON CONFLICT(ns) DO UPDATE SET revision=excluded.revision,body=excluded.body').run(namespace,revision,body);
    db.prepare('INSERT INTO intents(ns,id,request,revision) VALUES(?,?,?,?)').run(namespace,intent,request,revision);
    committing=true;db.exec('COMMIT');
    if(transactionState()===true)throw Error('commit_unconfirmed');
    return {status:'committed',intent,revision};
   }catch{
    try{db.exec('ROLLBACK');}catch{
     // A live/unverifiable transaction can show uncommitted rows. Never report those as durable receipts.
     if(transactionState()!==false)quarantined=true;
    }
    return committing?{status:'unknown',intent}:{status:'not_committed',reason:'storage_unavailable'};
   }finally{busy=false;}
  },
  close(){if(closed)return;if(busy)throw Error('storage_busy');db.close();closed=true;}
 });
}
export function openSqliteStore(path:string,namespace:string):ManagedStore{
 const db=new DatabaseSync(path);
 try{return createSqliteStore(db,namespace);}catch(error){db.close();throw error;}
}
