import test from 'node:test';
import assert from 'node:assert/strict';
import {replaceVerifiedSet} from '../dist/saving.mjs';

const bytes=text=>new TextEncoder().encode(text);
const text=value=>new TextDecoder().decode(value);

function fixture(count=2){
  const events=[],backups=new Map();
  const rows=Array.from({length:count},(_,i)=>{
    const name=['FWLSBank.SC2Bank','FWLSBankChk.SC2Bank','FWLSBank2.SC2Bank'][i];
    const state={live:bytes('old'+i),opened:0,commits:0,aborts:0};
    const handle={name,async isSameEntry(other){return this===other;},async getFile(){
      await state.beforeRead?.();
      const copy=state.live.slice();return {arrayBuffer:async()=>copy.buffer};
    },async createWritable(){
      const attempt=++state.opened;events.push('open:'+i+':'+attempt);
      await state.onOpen?.(attempt);let staged;
      return {async write(value){await state.onWrite?.(attempt);staged=value.slice();events.push('write:'+i+':'+attempt);},
        async close(){events.push('close:'+i+':'+attempt);await state.beforeClose?.(attempt);state.live=staged;state.commits++;await state.afterClose?.(attempt);},
        async abort(){state.aborts++;events.push('abort:'+i+':'+attempt);}};
    }};
    return {name,handle,state,original:state.live.slice(),output:bytes('new'+i)};
  });
  const options={files:rows,confirmed:true,backup:async(raw,sha,file)=>{
    events.push('backup:'+file.name);backups.set(file.name,raw.slice());return file.name;
  },verifyBackup:async name=>backups.get(name)};
  return {rows,events,backups,options};
}

test('paired save backs up and stages every member before committing, then verifies all outputs',async()=>{
  const f=fixture(3),result=await replaceVerifiedSet(f.options);
  assert.deepEqual(result.map(text),['new0','new1','new2']);
  assert.deepEqual(f.rows.map(r=>text(r.state.live)),['new0','new1','new2']);
  assert.equal(f.backups.size,3);
  const firstOpen=f.events.findIndex(e=>e.startsWith('open:'));
  assert.equal(f.events.slice(0,firstOpen).filter(e=>e.startsWith('backup:')).length,3);
  const firstClose=f.events.findIndex(e=>e.startsWith('close:'));
  assert.equal(f.events.slice(0,firstClose).filter(e=>e.startsWith('write:')).length,3);
});

test('paired save requires confirmation and preexisting companion bytes',async()=>{
  const f=fixture();
  await assert.rejects(replaceVerifiedSet({...f.options,confirmed:false}),/outside every match/);
  f.rows[1].original=null;
  await assert.rejects(replaceVerifiedSet(f.options),/existing, opened files/);
  assert.equal(f.events.length,0);
});

test('duplicate filename and aliased handles are rejected before backups',async()=>{
  const f=fixture();f.rows[1].name=f.rows[0].name;
  await assert.rejects(replaceVerifiedSet(f.options),/distinct filename/);
  const g=fixture();g.rows[1].handle.isSameEntry=async()=>true;
  await assert.rejects(replaceVerifiedSet(g.options),/same file/);
  assert.equal(f.events.length+g.events.length,0);
});

test('stale original fails before backup or write',async()=>{
  const f=fixture();f.rows[1].state.live=bytes('new in-game save');
  await assert.rejects(replaceVerifiedSet(f.options),/changed on disk/);
  assert.equal(f.events.length,0);
});

test('corrupt independent backup prevents writes to both files',async()=>{
  const f=fixture();f.options.verifyBackup=async()=>bytes('corrupted backup');
  await assert.rejects(replaceVerifiedSet(f.options),/backup verification failed/);
  assert.ok(f.rows.every(r=>r.state.opened===0));
});

test('original changed during backup is detected before staging',async()=>{
  const f=fixture(),verify=f.options.verifyBackup;
  f.options.verifyBackup=async key=>{const raw=await verify(key);f.rows[0].state.live=bytes('concurrent save');return raw;};
  await assert.rejects(replaceVerifiedSet(f.options),/changed on disk/);
  assert.ok(f.rows.every(r=>r.state.opened===0));
});

test('failure staging second file aborts staged streams without committing either bank',async()=>{
  const f=fixture();f.rows[1].state.onWrite=async()=>{throw Error('out of space');};
  await assert.rejects(replaceVerifiedSet(f.options),/No files were committed/);
  assert.deepEqual(f.rows.map(r=>text(r.state.live)),['old0','old1']);
  assert.ok(f.rows.every(r=>r.state.aborts===1));
});

test('second close failure rolls the first commit back and verifies originals',async()=>{
  const f=fixture();f.rows[1].state.beforeClose=async()=>{throw Error('close failed');};
  let error;try{await replaceVerifiedSet(f.options);}catch(e){error=e;}
  assert.match(error.message,/original restored and verified/);
  assert.deepEqual(f.rows.map(r=>text(r.state.live)),['old0','old1']);
  assert.equal(error.recovery.length,2);
  assert.equal(f.backups.size,2);
});

test('close throwing after committing still rolls back both attempted members',async()=>{
  const f=fixture();f.rows[1].state.afterClose=async attempt=>{if(attempt===1)throw Error('postcommit failure');};
  await assert.rejects(replaceVerifiedSet(f.options),/original restored and verified/);
  assert.deepEqual(f.rows.map(r=>text(r.state.live)),['old0','old1']);
});

test('external change to already committed file is preserved rather than rolled over',async()=>{
  const f=fixture();f.rows[0].state.afterClose=async()=>{f.rows[0].state.live=bytes('external progress');};
  await assert.rejects(replaceVerifiedSet(f.options),/external change preserved/);
  assert.equal(text(f.rows[0].state.live),'external progress');
  assert.equal(text(f.rows[1].state.live),'old1');
  assert.equal(f.rows[0].state.opened,1);
});

test('a new external save while opening rollback stream is not overwritten',async()=>{
  const f=fixture();f.rows[1].state.beforeClose=async()=>{throw Error('second close failed');};
  f.rows[0].state.onOpen=async attempt=>{if(attempt===2)f.rows[0].state.live=bytes('racing save');};
  await assert.rejects(replaceVerifiedSet(f.options),/rollback could not be verified/);
  assert.equal(text(f.rows[0].state.live),'racing save');
  assert.equal(f.rows[0].state.aborts,1);
});

test('rollback failure reports manual recovery instead of claiming success',async()=>{
  const f=fixture();f.rows[1].state.beforeClose=async()=>{throw Error('second close failed');};
  f.rows[0].state.beforeClose=async attempt=>{if(attempt===2)throw Error('rollback failed');};
  await assert.rejects(replaceVerifiedSet(f.options),/rollback could not be verified; restore manually from Recovery vault/);
  assert.equal(text(f.rows[0].state.live),'new0');
  assert.equal(text(f.backups.get(f.rows[0].name)),'old0');
});

test('late external change to first member after second commits is detected',async()=>{
  const f=fixture();f.rows[1].state.afterClose=async attempt=>{if(attempt===1)f.rows[0].state.live=bytes('late change');};
  await assert.rejects(replaceVerifiedSet(f.options),/external change preserved/);
  assert.deepEqual(f.rows.map(r=>text(r.state.live)),['late change','old1']);
});

test('mutation of caller-owned output during backup cannot change the frozen plan',async()=>{
  const f=fixture(),backup=f.options.backup;
  f.options.backup=async(...args)=>{f.rows[0].output.fill(120);return backup(...args);};
  await replaceVerifiedSet(f.options);
  assert.equal(text(f.rows[0].state.live),'new0');
});
