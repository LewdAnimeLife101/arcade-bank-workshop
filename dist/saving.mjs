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
