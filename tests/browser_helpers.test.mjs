import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileIdentity,classify,currentBankCandidate,shouldScanDirectory} from '../dist/discovery.mjs';
import {replaceVerified} from '../dist/saving.mjs';
const profiles=JSON.parse(await readFile(new URL('../dist/profiles.json',import.meta.url)));
const bytes=text=>new TextEncoder().encode(text);

test('discovery separates accounts/authors, supports redirected paths and never elevates backups',()=>{
  for(const base of ['Documents/StarCraft II','OneDrive/Documents/StarCraft II']){
    const a=fileIdentity(base+'/Accounts/100/1-S2-1-1234567/Banks/1-S2-1-7654321/FWLSBank.SC2Bank');
    const b=fileIdentity(base+'/Accounts/200/1-S2-1-2345678/Banks/1-S2-1-7654321/FWLSBank.SC2Bank');
    assert.notEqual(a.account,b.account);assert.equal(a.author,'1-S2-1-7654321');
  }
  assert.deepEqual(classify('FWLSBank_backup_9.SC2Bank',profiles),{profile:'fallen',backup:true});
  assert.deepEqual(classify('MineralzSurvival2BU3.SC2Bank',profiles),{profile:'mineralz',backup:true});
  assert.deepEqual(classify('BlizzardBuiltIn.SC2Bank',profiles),{profile:'reign',backup:false});
  assert.equal(fileIdentity('Unknown/Banks/Other/Bank.SC2Bank'),null);
  assert.equal(classify('unregistered.SC2Bank',profiles),null);
});

test('only the direct main bank survives when nested copies keep its original filename',()=>{
  const root='StarCraft II/Accounts/100/1-S2-1-1234567/Banks/1-S2-1-7654321';
  const files=['zombieworldu.SC2Bank','Backup/zombieworldu.SC2Bank','old/zombieworldu.SC2Bank','exports/2026/zombieworldu.SC2Bank','copy/1-S2-1-7654321/zombieworldu.SC2Bank','Banks/zombieworldu.SC2Bank'];
  const found=files.map(name=>currentBankCandidate(root+'/'+name,profiles)).filter(Boolean);
  assert.equal(found.length,1);assert.equal(found[0].relative,root+'/zombieworldu.SC2Bank');
  for(const name of ['Backup','old','exports','1-S2-1-1234567','Accounts'])assert.equal(shouldScanDirectory(root,name),false);
});

test('known rotating backups are excluded even directly alongside a main',()=>{
  const root='StarCraft II/Accounts/100/1-S2-1-1234567/Banks/1-S2-1-7654321/';
  for(const name of ['MineralzSurvival2BU1.SC2Bank','MineralzSurvival2BU3.SC2Bank','FWLSBank_backup_99.SC2Bank'])assert.equal(currentBankCandidate(root+name,profiles),null);
  for(const name of ['MineralzSurvival2.SC2Bank','FWLSBank.SC2Bank','HackersWillBeBanned.SC2Bank','BlizzardBuiltIn.SC2Bank'])assert.ok(currentBankCandidate(root+name,profiles));
});

test('canonical traversal ignores copied trees but retains distinct account and author choices',()=>{
  assert.equal(shouldScanDirectory('StarCraft II','Backup'),false);
  assert.equal(shouldScanDirectory('StarCraft II','Accounts'),true);
  assert.equal(shouldScanDirectory('Documents','StarCraft II'),true);
  assert.equal(shouldScanDirectory('StarCraft II/Accounts','100'),true);
  assert.equal(shouldScanDirectory('StarCraft II/Accounts/100','1-S2-1-1234567'),true);
  assert.equal(shouldScanDirectory('StarCraft II/Accounts/100/1-S2-1-1234567','Banks'),true);
  assert.equal(shouldScanDirectory('StarCraft II/Accounts/100/1-S2-1-1234567/Banks','1-S2-1-7654321'),true);
  const a=currentBankCandidate('StarCraft II/Accounts/100/1-S2-1-1234567/Banks/1-S2-1-7654321/DirectStrike.SC2Bank',profiles);
  const b=currentBankCandidate('StarCraft II/Accounts/100/1-S2-1-1234567/Banks/1-S2-1-7654322/DirectStrike.SC2Bank',profiles);
  assert.ok(a&&b);assert.equal(a.account,b.account);assert.notEqual(a.author,b.author);
  assert.equal(fileIdentity('StarCraft II/Accounts/100/1-S2-1-1234567/Banks/Backup/1-S2-1-7654321/DirectStrike.SC2Bank'),null);
});

function setup(){
  const s={live:bytes('original'),writes:0,backups:new Map(),aborted:false};
  s.handle={getFile:async()=>({arrayBuffer:async()=>s.live.slice().buffer}),createWritable:async()=>{
    if(s.race)s.live=bytes('changed after backup');let staged;
    return {write:async value=>{s.writes++;staged=value.slice();},close:async()=>{s.live=s.corrupt?bytes('broken'):staged;},abort:async()=>{s.aborted=true;}};
  }};
  s.args={handle:s.handle,original:s.live.slice(),output:bytes('validated output'),confirmed:true,backup:async raw=>{s.backups.set('id',raw.slice());return 'id';},verifyBackup:async id=>s.backups.get(id)};
  return s;
}
test('successful replacement retains independently readable original and verifies output',async()=>{
  const s=setup();const out=await replaceVerified(s.args);assert.deepEqual(out,s.args.output);assert.deepEqual(s.backups.get('id'),bytes('original'));assert.equal(s.writes,1);
});
test('each save requires menu confirmation',async()=>{const s=setup();await assert.rejects(replaceVerified({...s.args,confirmed:false}),/Confirm/);assert.equal(s.writes,0);});
test('freshness mismatch never writes',async()=>{const s=setup();s.live=bytes('game changed');await assert.rejects(replaceVerified(s.args),/changed/);assert.equal(s.writes,0);});
test('backup read-back mismatch never writes',async()=>{const s=setup();await assert.rejects(replaceVerified({...s.args,verifyBackup:async()=>bytes('bad')}),/backup verification/);assert.equal(s.writes,0);});
test('change between backup and write aborts staging',async()=>{const s=setup();s.race=true;await assert.rejects(replaceVerified(s.args),/changed/);assert.equal(s.writes,0);assert.equal(s.aborted,true);});
test('corrupt read-back reports retained recovery',async()=>{const s=setup();s.corrupt=true;await assert.rejects(replaceVerified(s.args),/Recovery vault/);assert.deepEqual(s.backups.get('id'),bytes('original'));});
