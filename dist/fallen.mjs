/* Fallen World 0.89: explicit, coordinated main/comparison-bank saves. */
import {replaceVerifiedSet} from './saving.mjs?v=fallen089';
const MAIN='FWLSBank.SC2Bank', MIRROR='FWLSBankChk.SC2Bank';
const bytes=async file=>{if(file.size>4194304)throw Error('Comparison bank exceeds 4 MB.');return new Uint8Array(await file.arrayBuffer());};

export async function mirrorPicker(s,box,{el,task,b64}) {
  const panel=el('section',undefined,'coverage-note'),status=el('p');
  panel.append(el('h3','Bank Guard comparison save'),el('p','The main bank and FWLSBankChk must be saved together. Existing comparison files are checked for the same account and author. Historical snapshots are preserved.'),status);
  box.append(panel);
  let source=null;
  const set=(value,text)=>{source=value;status.textContent=text;};
  async function fromDirectory(directory){
    try{const handle=await directory.getFileHandle(MIRROR);set({raw:await bytes(await handle.getFile()),handle},'Found FWLSBankChk in this bank’s folder. Its signature will be checked before export or replacement.');}
    catch(e){if(e.name!=='NotFoundError')throw e;set({raw:null,handle:null},'No comparison bank exists in this folder. Export will include a new signed comparison bank. Install both files together; direct replacement requires both originals to exist.');}
  }
  if(s.directory)await fromDirectory(s.directory);
  else if(s.mirrorFile)set({raw:await bytes(s.mirrorFile),handle:null},'Found FWLSBankChk in the selected account folder. Copy export is available.');
  else if(s.data.demo)set({raw:null,handle:null},'Synthetic example: a fictional comparison bank will be generated.');
  else status.textContent='Open your existing FWLSBankChk, or confirm that this account has no comparison bank yet.';
  const actions=el('div',undefined,'dialog-actions');panel.append(actions);
  const pick=el('button','Open existing FWLSBankChk');pick.type='button';actions.append(pick);
  const fallback=el('input');fallback.type='file';fallback.accept='.SC2Bank';fallback.hidden=true;panel.append(fallback);
  async function selected(file,handle){
    if(file.name.toLowerCase()!==MIRROR.toLowerCase())throw Error('Choose FWLSBankChk.SC2Bank. Snapshot files are not comparison banks.');
    set({raw:await bytes(file),handle},'Comparison bank selected. Account, author and native signature will be checked.');
  }
  pick.onclick=()=>task(async()=>{
    if(!window.showOpenFilePicker){fallback.click();return;}
    const [handle]=await showOpenFilePicker({multiple:false,types:[{description:'SC2 comparison bank',accept:{'application/octet-stream':['.SC2Bank']}}]});
    await selected(await handle.getFile(),handle);
  });
  fallback.onchange=()=>task(async()=>{if(fallback.files[0])await selected(fallback.files[0],null);fallback.value='';});
  if(window.showDirectoryPicker&&s.handle){
    const folder=el('button','Select this bank’s folder');folder.type='button';actions.append(folder);
    folder.onclick=()=>task(async()=>{
      const directory=await showDirectoryPicker({mode:'read',id:'fallen-author-folder'});
      const main=await directory.getFileHandle(MAIN);
      if(!await s.handle.isSameEntry(main))throw Error('That folder does not contain the exact main bank you opened.');
      s.directory=directory;await fromDirectory(directory);
    });
  }
  if(!s.directory&&!s.mirrorFile&&!s.data.demo){
    const row=el('label',undefined,'confirm-check'),missing=el('input');missing.type='checkbox';
    row.append(missing,el('span','This account has no FWLSBankChk yet — create one in the export.'));panel.append(row);
    missing.onchange=()=>{if(missing.checked)set({raw:null,handle:null},'A new comparison bank will be included in the ZIP. Existing snapshots and backups are not modified.');else set(null,'Choose the existing comparison bank or confirm that none exists.');};
  }
  return {get:()=>{if(!source)throw Error('Select the comparison bank, or confirm that it does not exist yet.');return {...source,encoded:source.raw===null?null:b64(source.raw)};}};
}

export async function saveFallen(s,mode,ctx){
  const {el,modal,task,b64,un64,rpc,download,message,vault,reloaded}=ctx;
  const box=modal(mode==='replace'?'Replace Fallen World’s paired banks':'Export Fallen World 0.89 banks');
  box.append(el('p','0.89 uses a main progression bank and a signed comparison bank. This workflow keeps their tracked values consistent. It does not remove account-list restrictions, alter historical snapshots or prove live-game acceptance.'));
  const picker=await mirrorPicker(s,box,ctx);
  const review=el('button','Review coordinated save','primary');box.append(review);
  review.onclick=()=>task(async()=>{
    const original=picker.get();
    if(mode==='replace'){
      if(!s.directory)throw Error('Select this bank’s folder so replacement can verify that both current files belong together.');
      if(!original.handle)throw Error('Direct replacement requires an existing comparison bank. Use Export copy to create the two-file ZIP and install both together.');
      const canonical=await s.directory.getFileHandle(MIRROR);
      if(!await canonical.isSameEntry(original.handle))throw Error('The selected comparison bank is not the current file in this main bank’s folder.');
    }
    const result=await rpc({op:'fallen_bundle',session:s.data.session,mirror:original.encoded});
    const next=modal('Review main bank + comparison bank');
    next.append(el('p',MAIN+' + '+MIRROR),el('p','Both signed outputs pass the 0.89 source-derived range and comparison checks. This is an offline check; the map’s account restrictions and historical snapshots remain.'),el('pre',result.notes.join('\n')));
    if(mode==='export'){
      next.append(el('p','Install both files together in the same account/author folder while outside every match. Retain independent originals.'));
      const go=el('button','Download paired banks as ZIP','primary');go.onclick=()=>{download(un64(result.archive),(s.data.demo?'demo-':'')+'Fallen-World-0.89-banks.zip');ctx.close();message('Paired export downloaded. No original files were changed.');};next.append(go);return;
    }
    next.append(el('p','Both originals are backed up and verified before writing. Browser storage cannot commit two files atomically; a failed save attempts a verified rollback. Recovery vault retains both originals.'));
    const row=el('label',undefined,'confirm-check'),confirm=el('input');confirm.type='checkbox';row.append(confirm,el('span','SC2 is closed, or I am at the main menu outside every match.'));next.append(row);
    const go=el('button','Back up & replace both banks','primary');go.disabled=true;confirm.onchange=()=>go.disabled=!confirm.checked;next.append(go);
    go.onclick=()=>task(async()=>{
      const files=[{name:MAIN,handle:s.handle,original:s.original,output:un64(result.output)},{name:MIRROR,handle:original.handle,original:original.raw,output:un64(result.guardOutput)}];
      const readbacks=await replaceVerifiedSet({files,confirmed:confirm.checked,backup:async(raw,sha,file)=>{
        const record={id:crypto.randomUUID(),created:new Date().toISOString(),name:file.name,player:s.data.player,author:s.data.author,profile:'fallen',raw,sha};await vault('put',record);return record.id;
      },verifyBackup:async id=>(await vault('get',id))?.raw});
      await reloaded(s,readbacks[0]);ctx.close();message('Main and comparison banks replaced and read back successfully. Both originals are in Recovery vault. Snapshots were preserved; live acceptance has not been tested.');
    });
  });
}
