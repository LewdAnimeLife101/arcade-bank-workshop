import {currentBankCandidate,shouldScanDirectory} from './discovery.mjs';

// One folder and one scan serve every profile. Switching maps never requests
// filesystem permission or replaces an editing session.
export class FolderSelection {
  constructor(profiles){this.profiles=profiles;this.root=null;this.entries=[];}
  async scan(root=this.root){
    if(!root)throw Error('Select your Starcraft folder first.');
    const found=[];
    const walk=async(dir,path,depth)=>{
      if(depth>7)return;
      for await(const [name,handle] of dir.entries()){
        if(handle.kind==='directory'){
          if(shouldScanDirectory(path,name))await walk(handle,path+'/'+name,depth+1);
        }else{
          const entry=currentBankCandidate(path+'/'+name,this.profiles);
          if(entry)found.push({...entry,handle});
        }
      }
    };
    await walk(root,root.name,0);
    this.root=root;this.entries=found;return found;
  }
  forProfile(id,account='all'){
    return this.entries.filter(e=>e.profile===id&&(account==='all'||e.account===account));
  }
}

// Persist the permission-bearing handle, never bank contents or pending edits.
export async function rememberedFolder(operation,handle){
  const db=await new Promise((resolve,reject)=>{
    const request=indexedDB.open('arcade-bank-folder',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('settings');
    request.onerror=()=>reject(request.error);request.onsuccess=()=>resolve(request.result);
  });
  try{return await new Promise((resolve,reject)=>{
    const tx=db.transaction('settings',operation==='get'?'readonly':'readwrite');
    const store=tx.objectStore('settings');
    const request=operation==='get'?store.get('folder'):store.put(handle,'folder');
    tx.oncomplete=()=>resolve(request.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });}finally{db.close();}
}
