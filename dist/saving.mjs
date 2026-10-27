/* Shared browser save guard for every map profile. No game file is auto-saved. */
export const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
export async function replaceVerified({handle,original,output,confirmed,backup,verifyBackup}) {
  if(!confirmed)throw Error('Confirm that you are outside every match.');
  if(!handle||!original||!output)throw Error('Open and validate a main bank before replacing it.');
  const originalHash=await digest(original);
  async function fresh(){const live=new Uint8Array(await (await handle.getFile()).arrayBuffer());if(await digest(live)!==originalHash)throw Error('The original bank changed on disk. Reopen it before saving.');}
  await fresh();
  const key=await backup(original,originalHash);
  const restored=await verifyBackup(key);
  if(!restored||await digest(restored)!==originalHash)throw Error('Independent backup verification failed; the bank was not replaced.');
  const stream=await handle.createWritable({keepExistingData:false});
  try{await fresh();await stream.write(output);await stream.close();}
  catch(e){try{await stream.abort();}catch{}throw e;}
  const readback=new Uint8Array(await (await handle.getFile()).arrayBuffer());
  if(await digest(readback)!==await digest(output))throw Error('Written bytes did not match. Your original is in Recovery vault.');
  return readback;
}

/* Browser files have separate commits: this is a backed-up transaction with
 * best-effort verified rollback, not an atomic multi-file filesystem operation.
 * Creating a missing companion requires ZIP export instead: getFileHandle's
 * create option cannot exclusively create a file without racing another writer.
 * backup(bytes, sha256, file) must persist outside the selected SC2 directory.
 */
export async function replaceVerifiedSet({files,confirmed,backup,verifyBackup}) {
  if(!confirmed)throw Error('Confirm that you are outside every match.');
  if(!Array.isArray(files)||files.length<2||files.length>3)throw Error('Select two or three existing banks for paired replacement.');
  if(typeof backup!=='function'||typeof verifyBackup!=='function')throw Error('Independent verified backups are required.');
  const names=new Set(),rows=[];
  for(const file of files){
    if(!file||typeof file.name!=='string'||!file.name||/[\\/]/.test(file.name)||names.has(file.name.toLowerCase()))throw Error('Every bank in a paired save must have a distinct filename.');
    if(!file.handle||!(file.original instanceof Uint8Array)||!(file.output instanceof Uint8Array))throw Error('Paired replacement requires existing, opened files. Export the bank bundle to install a missing companion.');
    if(!file.original.length||!file.output.length)throw Error('Empty banks cannot be replaced.');
    if(file.handle.name&&file.handle.name.toLowerCase()!==file.name.toLowerCase())throw Error('The selected file handle does not match '+file.name+'.');
    for(const other of rows){
      if(file.handle===other.handle||(typeof file.handle.isSameEntry==='function'&&await file.handle.isSameEntry(other.handle)))throw Error('Two bank entries refer to the same file.');
    }
    names.add(file.name.toLowerCase());
    // Freeze the plan's bytes across async backup, permission and disk operations.
    const row={...file,original:file.original.slice(),output:file.output.slice(),stream:null,attempted:false,closed:false};
    row.originalHash=await digest(row.original);row.outputHash=await digest(row.output);rows.push(row);
  }
  const read=async row=>new Uint8Array(await (await row.handle.getFile()).arrayBuffer());
  async function fresh(row,expected=row.originalHash){
    const bytes=await read(row);
    if(await digest(bytes)!==expected)throw Error(row.name+' changed on disk. Reopen the banks before saving.');
    return bytes;
  }
  async function freshSet(){for(const row of rows)await fresh(row,row.closed?row.outputHash:row.originalHash);}
  await freshSet();
  for(const row of rows){
    row.backupKey=await backup(row.original.slice(),row.originalHash,{name:row.name,handle:row.handle});
    const restored=await verifyBackup(row.backupKey);
    if(!restored||await digest(restored)!==row.originalHash)throw Error('Independent backup verification failed for '+row.name+'; no banks were replaced.');
  }
  await freshSet();
  try{
    for(const row of rows){
      row.stream=await row.handle.createWritable({keepExistingData:false});
      await row.stream.write(row.output);
    }
    // Every output is staged and every backup verified before the first commit.
    await freshSet();
    const result=[];
    for(const row of rows){
      await freshSet();
      row.attempted=true;
      await row.stream.close();row.closed=true;
      const bytes=await read(row);
      if(await digest(bytes)!==row.outputHash)throw Error('Written bytes did not match '+row.name+'.');
      result.push(bytes);
    }
    // A subsequent writer may have changed an earlier committed member.
    await freshSet();
    return result;
  }catch(error){
    for(const row of rows){if(row.stream&&!row.closed){try{await row.stream.abort();}catch{}}}
    const recovery=[];
    // close() can fail after committing; inspect all attempted entries.
    for(const row of [...rows].reverse()){
      if(!row.attempted)continue;
      let rollback;
      try{
        const actual=await digest(await read(row));
        if(actual===row.originalHash){recovery.push({name:row.name,status:'original unchanged'});continue;}
        if(actual!==row.outputHash){recovery.push({name:row.name,status:'external change preserved; restore manually from Recovery vault'});continue;}
        rollback=await row.handle.createWritable({keepExistingData:false});
        await fresh(row,row.outputHash);
        await rollback.write(row.original);
        await fresh(row,row.outputHash);
        await rollback.close();rollback=null;
        await fresh(row,row.originalHash);
        recovery.push({name:row.name,status:'original restored and verified'});
      }catch{
        if(rollback){try{await rollback.abort();}catch{}}
        recovery.push({name:row.name,status:'rollback could not be verified; restore manually from Recovery vault'});
      }
    }
    const detail=recovery.length?recovery.map(x=>x.name+': '+x.status).join('; '):'No files were committed.';
    const failure=Error('Paired replacement failed: '+(error?.message||String(error))+' '+detail+' Verified originals remain in Recovery vault. Do not enter a match until all files are restored or the pair is saved successfully.');
    failure.recovery=recovery;failure.cause=error;throw failure;
  }
}
