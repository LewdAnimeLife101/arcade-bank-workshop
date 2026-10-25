import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileIdentity,classify,currentBankCandidate,shouldScanDirectory} from '../dist/discovery.mjs';
import {replaceVerified} from '../dist/saving.mjs';
import {FolderSelection} from '../dist/folders.mjs';
import {accountShortcut,accountName,accountLabels,addAccountName,isAccountShortcut} from '../dist/account-names.mjs';
const profiles=JSON.parse(await readFile(new URL('../dist/profiles.json',import.meta.url)));
const bytes=text=>new TextEncoder().encode(text);

function directory(name,children){return {name,kind:'directory',async *entries(){for(const child of children)yield [child.name,child];}};}
function shortcutFixture(target,{unicode=false,split=false}={}){
  const header=unicode?36:28,encoding=unicode?'utf16le':'latin1';
  const base=Buffer.from((split?'C:\\Users\\':target)+'\0',encoding);
  const suffix=Buffer.from((split?target.slice(9):'')+'\0',encoding);
  const info=Buffer.alloc(header+base.length+suffix.length);
  info.writeUInt32LE(info.length,0);info.writeUInt32LE(header,4);info.writeUInt32LE(1,8);
  info.writeUInt32LE(header,unicode?28:16);info.writeUInt32LE(header+base.length,unicode?32:24);
  base.copy(info,header);suffix.copy(info,header+base.length);
  const head=Buffer.alloc(76);head.writeUInt32LE(76);head.set([1,20,2,0,0,0,0,0,192,0,0,0,0,0,0,70],4);head.writeUInt32LE(2,20);
  return Buffer.concat([head,info]);
}
test('account names use exact shortcut targets, including split ANSI and Unicode paths',()=>{
  const target='C:\\Users\\Example\\Documents\\StarCraft II\\Accounts\\100\\1-S2-1-1234567';
  for(const options of [{},{split:true},{unicode:true}]){
    const result=accountShortcut(shortcutFixture(target,options),'Test_Player_123@1.lnk');
    assert.deepEqual(result,{account:'1-S2-1-1234567 · 100',name:'Test_Player',region:'1'});
  }
  assert.equal(isAccountShortcut('Documents/StarCraft II','Test_123@1.lnk'),true);
  assert.equal(isAccountShortcut('StarCraft II/Backup','Test_123@1.lnk'),false);
  assert.equal(accountShortcut(shortcutFixture(target),'Test_123@2.lnk'),null);
  assert.equal(accountShortcut(shortcutFixture(target+'\\Banks'),'Test_123@1.lnk'),null);
  const malformed=shortcutFixture(target);malformed.writeUInt32LE(999999,76);
  assert.equal(accountShortcut(malformed,'Test_123@1.lnk'),null);
  assert.equal(accountShortcut(new Uint8Array(8),'Test_123@1.lnk'),null);
});
test('names remain display labels: duplicate names and regions never merge account identity',()=>{
  const names=new Map(),keys=['1-S2-1-1234567 · 100','2-S2-1-2345678 · 100','1-S2-1-3456789 · 200'];
  for(const account of keys)addAccountName(names,{account,name:'Example'});
  const labels=accountLabels(keys,names);
  assert.equal(labels.get(keys[1]),'Example · Europe');
  assert.ok(labels.get(keys[0]).startsWith('Example · Americas'));
  assert.notEqual(labels.get(keys[0]),labels.get(keys[2]));
  assert.equal(accountName('Synthetic example',names),'Synthetic example');
  assert.equal(accountName('1-S2-1-9999999 · 300',names),'1-S2-1-9999999 · 300');
});
test('folder scans read name metadata once for all profiles without following shortcuts',async()=>{
  const payload=shortcutFixture('C:\\Users\\Example\\StarCraft II\\Accounts\\100\\1-S2-1-1234567');
  const shortcut={name:'Example_123@1.lnk',kind:'file',getFile:async()=>({name:'Example_123@1.lnk',size:payload.length,arrayBuffer:async()=>Uint8Array.from(payload).buffer})};
  const selected=new FolderSelection(profiles);
  await selected.scan(directory('StarCraft II',[shortcut]));
  assert.equal(accountName('1-S2-1-1234567 · 100',selected.accountNames),'Example · Americas');
  assert.deepEqual(selected.entries,[]);
});
test('one folder scan retains all profiles and accounts across map switches',async()=>{
  const file=name=>({name,kind:'file'});
  const root=directory('StarCraft II',[directory('Accounts',[directory('100',[directory('1-S2-1-1234567',[directory('Banks',[directory('1-S2-1-7654321',[
    file('zombieworldu.SC2Bank'),file('Banks.SC2Bank'),file('MineralzSurvival2.SC2Bank'),directory('Backup',[file('Banks.SC2Bank')])
  ])])])])])]);
  const selected=new FolderSelection(profiles);await selected.scan(root);
  assert.equal(selected.entries.length,3);
  const unity=selected.forProfile('unity')[0];
  assert.equal(selected.forProfile('mineralz_evolution_258').length,1);
  assert.equal(selected.forProfile('mineralz').length,1);
  assert.equal(selected.forProfile('unity')[0],unity);
  assert.equal(selected.root,root);
  assert.equal(selected.forProfile('unity','different account').length,0);
  const broken=directory('StarCraft II',[]);broken.entries=async function*(){throw Error('permission revoked');};
  await assert.rejects(selected.scan(broken),/permission revoked/);
  assert.equal(selected.root,root);assert.equal(selected.forProfile('unity')[0],unity);
  await selected.scan();assert.equal(selected.entries.length,3);
});

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

test('Probes vs Zealot discovers each supported companion separately and omits encrypted MMR',()=>{
  const root='StarCraft II/Accounts/100/1-S2-1-1234567/Banks/1-S2-1-7654321/';
  for(const name of ['ProbesvZealot2','PvsZ2GameplayOptions','PvZ2Options2']){
    const entry=currentBankCandidate(root+name+'.SC2Bank',profiles);
    assert.equal(entry.profile,'probes_zealot_2118');assert.equal(entry.backup,false);
    assert.equal(currentBankCandidate(root+'backup/'+name+'.SC2Bank',profiles),null);
    assert.equal(currentBankCandidate(root+name+'_backup_1.SC2Bank',profiles),null);
  }
  assert.equal(currentBankCandidate(root+'PvZ2MMR.SC2Bank',profiles),null);
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
