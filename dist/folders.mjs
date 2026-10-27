import {currentBankCandidate,shouldScanDirectory} from './discovery.mjs?v=fallen089';
const {isAccountShortcut,readAccountShortcut,addAccountName}=await import('./account-names.mjs?v='+(new URL(import.meta.url).searchParams.get('v')||'1'));

// One folder and one scan serve every profile. Switching maps never requests
// filesystem permission or replaces an editing session.
export class FolderSelection {
  constructor(profiles){this.profiles=profiles;this.root=null;this.entries=[];this.accountNames=new Map();}
  async scan(root=this.root){
    if(!root)throw Error('Select your Starcraft folder first.');
    const found=[],names=new Map(this.accountNames);
    const walk=async(dir,path,depth)=>{
      if(depth>7)return;
      for await(const [name,handle] of dir.entries()){
        if(handle.kind==='directory'){
          if(shouldScanDirectory(path,name))await walk(handle,path+'/'+name,depth+1);
        }else{
          if(isAccountShortcut(path,name)){
            try{addAccountName(names,await readAccountShortcut(await handle.getFile()));}catch{/* Missing name metadata does not block bank discovery. */}
          }
          const entry=currentBankCandidate(path+'/'+name,this.profiles);
          if(entry)found.push({...entry,handle,directory:dir});
        }
      }
    };
    await walk(root,root.name,0);
    this.root=root;this.entries=found;this.accountNames=names;return found;
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
