/* Relative paths only: browsers never expose an arbitrary user's filesystem. */
const HANDLE=/^\d+-S2-\d+-\d+$/;
export function fileIdentity(relative){
  const parts=relative.replaceAll('\\','/').split('/'),i=parts.findIndex(x=>x.toLowerCase()==='banks');
  // A current bank is a direct child of Banks/<author>, never a descendant
  // of a backup/export folder even when it retains the main filename.
  if(i<2||i+3!==parts.length||parts.some(p=>!p||p==='.'||p==='..'))return null;
  if(!/^\d+$/.test(parts[i-2]))return null;
  if(i>=3&&parts[i-3].toLowerCase()!=='accounts')return null;
  const player=parts[i-1],author=parts[i+1];
  if(!HANDLE.test(player)||!HANDLE.test(author))return null;
  return {player,author,account:player+' · '+parts[i-2]};
}
export function classify(name,profiles){
  const lower=name.toLowerCase().replace(/\.sc2bank$/,'');
  for(const p of profiles){
    const main=p.mainNames.map(x=>x.toLowerCase().replace(/\.sc2bank$/,''));
    const names=p.bankNames.map(x=>x.toLowerCase().replace(/\.sc2bank$/,''));
    if(main.includes(lower)||names.includes(lower)||p.nativeBackupNames.some(x=>new RegExp('^'+x.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'_backup_[0-9]+$').test(lower)))return {profile:p.id,backup:!main.includes(lower)};
  }
  return null;
}

export function currentBankCandidate(relative,profiles){
  const identity=fileIdentity(relative);
  if(!identity)return null;
  const name=relative.replaceAll('\\','/').split('/').at(-1);
  if(!/\.sc2bank$/i.test(name))return null;
  const info=classify(name,profiles);
  return info&&!info.backup?{...identity,...info,name,relative}:null;
}

export function shouldScanDirectory(path,name){
  const parts=path.replaceAll('\\','/').split('/'),parent=parts.at(-1),grandparent=parts.at(-2)?.toLowerCase();
  if(parent.toLowerCase()==='banks')return HANDLE.test(name);
  if(HANDLE.test(parent))return grandparent!=='banks'&&name.toLowerCase()==='banks';
  if(/^\d+$/.test(parent))return HANDLE.test(name);
  if(parent.toLowerCase()==='accounts')return /^\d+$/.test(name);
  // A selected Documents/OneDrive location may contain StarCraft II; do not
  // wander into unrelated directories or copied Accounts trees in archives.
  return ['starcraft ii','accounts'].includes(name.toLowerCase());
}
