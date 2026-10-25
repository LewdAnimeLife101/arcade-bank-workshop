// Read only the local target metadata in SC2's Windows account shortcuts.
// Never launch shortcuts, follow targets, or use display names as save identity.
const CLSID=[1,20,2,0,0,0,0,0,192,0,0,0,0,0,0,70];
export function isAccountShortcut(path,name){
  return /(?:^|\/)StarCraft II$/i.test(path.replaceAll('\\','/'))&&/^.+_\d+@\d+\.lnk$/i.test(name);
}
export function accountShortcut(bytes,filename){
  try{
    const match=/^(.+)_\d+@(\d+)\.lnk$/i.exec(filename);
    if(!match||bytes.length<76||bytes.length>65536)return null;
    const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    if(v.getUint32(0,true)!==76||CLSID.some((n,i)=>bytes[i+4]!==n))return null;
    const flags=v.getUint32(20,true);let offset=76;
    if(flags&1)offset+=2+v.getUint16(offset,true);
    if(!(flags&2)||offset+28>bytes.length)return null;
    const length=v.getUint32(offset,true),header=v.getUint32(offset+4,true);
    if(length<28||header<28||header>length||offset+length>bytes.length)return null;
    if(!(v.getUint32(offset+8,true)&1))return null;
    const text=(relative,unicode)=>{
      if(relative<header||relative>=length)throw Error('Invalid string offset');
      const start=offset+relative,step=unicode?2:1;let end=start;
      while(end+step<=offset+length&&(unicode?v.getUint16(end,true):bytes[end])!==0)end+=step;
      if(end+step>offset+length)throw Error('Unterminated path');
      return new TextDecoder(unicode?'utf-16le':'windows-1252',{fatal:true}).decode(bytes.subarray(start,end));
    };
    const unicode=header>=36&&v.getUint32(offset+28,true)>0&&v.getUint32(offset+32,true)>0;
    const base=text(v.getUint32(offset+(unicode?28:16),true),unicode);
    const suffix=text(v.getUint32(offset+(unicode?32:24),true),unicode);
    const target=(base+(suffix&&base&&!/[\\/]$/.test(base)?'\\':'')+suffix).replaceAll('\\','/');
    const identity=/(?:^|\/)Accounts\/(\d+)\/(\d+-S2-\d+-\d+)\/?$/i.exec(target);
    if(!identity||target.split('/').some(p=>p==='.'||p==='..'))return null;
    const region=identity[2].split('-')[0];
    if(region!==match[2])return null;
    const name=match[1].replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,'').trim();
    if(!name||name.length>80)return null;
    return {account:identity[2]+' · '+identity[1],name,region};
  }catch{return null;}
}
export async function readAccountShortcut(file){
  if(file.size>65536)return null;
  return accountShortcut(new Uint8Array(await file.arrayBuffer()),file.name);
}
export function addAccountName(names,record){
  if(!record)return;
  const values=new Set(names.get(record.account)||[]);values.add(record.name);
  names.set(record.account,[...values].sort());
}
export function accountName(key,names){
  const values=names.get(key);
  if(!values?.length)return key;
  const region=key.split('-')[0];
  return values.join(' / ')+' · '+({1:'Americas',2:'Europe',3:'Korea',5:'China'}[region]||'Region '+region);
}
export function accountLabels(keys,names){
  const labels=new Map([...keys].map(k=>[k,accountName(k,names)])),counts=new Map();
  for(const label of labels.values())counts.set(label,(counts.get(label)||0)+1);
  for(const [key,label] of labels)if(counts.get(label)>1)labels.set(key,label+' · '+key);
  return labels;
}
