import {digest,replaceVerified} from './saving.mjs?v=fallen089';
import {currentBankCandidate,shouldScanDirectory,classify as classifyName} from './discovery.mjs?v=fallen089';
const $=id=>document.getElementById(id);
const release=new URL(import.meta.url).searchParams.get('v')||'1';
const {choiceControl}=await import('./choices.mjs?v='+release);
const {renderProfileNavigation,visibleFields}=await import('./navigation.mjs?v='+release);
const {renderReign,filteredFields:reignFields,inventoryChanges}=await import('./reign.mjs?v='+release);
const {saveFallen,mirrorPicker}=await import('./fallen.mjs?v='+release);
const {FolderSelection,rememberedFolder}=await import('./folders.mjs?v='+release);
const {accountLabels,accountName,isAccountShortcut,readAccountShortcut,addAccountName}=await import('./account-names.mjs?v='+release);
const profiles=await (await fetch('profiles.json?v='+release,{cache:'no-store'})).json();
$('profile-count').textContent=String(profiles.length).padStart(2,'0')+' map profiles';
const folderSelection=new FolderSelection(profiles);
let profile=profiles[0],current=null,entries=[],account='all',page=0,busy=false,folderReady=false;
const fallbackFiles=new Map();
const sessions=new Map(),selectedSessions=new Map(),requests=new Map();let sequence=0;
const worker=new Worker('worker.js?v='+release,{type:'module'});
const ready=new Promise((resolve,reject)=>{worker.onmessage=({data})=>{if(data.ready){$('engine-state').textContent='Local engine ready';$('engine-detail').textContent=profiles.length+' audited codecs · browser only';$('engine-dot').textContent='●';resolve();}else if(data.fatal){$('engine-state').textContent='Engine could not start';message(data.fatal,true);reject(Error(data.fatal));}else{const pending=requests.get(data.id);if(pending){requests.delete(data.id);data.ok?pending.resolve(data.data):pending.reject(Error(data.error));}}};worker.onerror=e=>{message('Local engine failed: '+(e.message||'Worker startup error')+' ('+(e.filename||'worker')+':'+(e.lineno||0)+')',true);reject(Error(e.message));};});
ready.catch(()=>{});
async function rpc(request){await ready;return new Promise((resolve,reject)=>{const id=++sequence;requests.set(id,{resolve,reject});worker.postMessage({id,request});});}
function message(text,error=false){$('message').textContent=text;$('message').classList.toggle('error',error);$('dashboard-message').textContent=error?text:'';if(error&&$('welcome').open)welcomeStatus(text,true);if(error&&$('dialog').open){let note=$('dialog-error');if(!note){note=el('p',undefined,'error');note.id='dialog-error';note.setAttribute('role','alert');$('dialog-content').append(note);}note.textContent=text;}}
async function task(fn){if(busy)return;busy=true;document.body.setAttribute('aria-busy','true');for(const node of document.querySelectorAll('main,header,dialog'))node.inert=true;try{await fn();}catch(e){if(e.name!=='AbortError')message(e.message||String(e),true);}finally{busy=false;document.body.removeAttribute('aria-busy');for(const node of document.querySelectorAll('main,header,dialog'))node.inert=false;}}
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const b64=bytes=>{let text='';for(let i=0;i<bytes.length;i+=32768)text+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(text);};
const un64=text=>Uint8Array.from(atob(text),c=>c.charCodeAt(0));

function download(bytes,name){const url=URL.createObjectURL(new Blob([bytes],{type:'application/octet-stream'}));const a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),15000);}
function modal(title){$('dialog-content').replaceChildren(el('h2',title));if(!$('dialog').open)$('dialog').showModal();return $('dialog-content');}
$('dialog-close').onclick=()=>$('dialog').close();
const cacheKey=(a,p)=>a+'|'+p;
const sessionKey=(a,p,author,name)=>JSON.stringify([a,p,author,name]);
function keep(){if(current){const key=sessionKey(current.account,current.data.profile,current.data.author,current.data.name);sessions.set(key,current);selectedSessions.set(cacheKey(current.account,current.data.profile),key);}}
function switchSession(){keep();current=sessions.get(selectedSessions.get(cacheKey(account,profile.id)))||null;page=0;message('');render();renderBanks();}

function chooseMap(id){
 const next=profiles.find(p=>p.id===id);if(!next)return;
 keep();profile=next;$('map').value=id;switchSession();
 $('dashboard').hidden=true;$('workspace').hidden=false;$('all-maps').hidden=false;
 $('editor-title').focus({preventScroll:true});$('workspace').scrollIntoView({block:'start'});
}
function showDashboard(){
 keep();$('workspace').hidden=true;$('dashboard').hidden=false;$('all-maps').hidden=true;
 renderDashboard();$('dashboard-title').focus({preventScroll:true});$('dashboard').scrollIntoView({block:'start'});
}
function renderDashboard(){
 $('map-cards').replaceChildren();$('collection-count').textContent=profiles.length+' map editors';
 for(const p of profiles){
  const card=el('button',undefined,'map-card');card.type='button';card.setAttribute('aria-label','Open '+p.name+' editor');
  const top=el('span',undefined,'map-card-top'),img=el('img');img.src='assets/maps/'+p.id+'.webp';img.alt='';img.width=225;img.height=150;img.decoding='async';
  const version=el('span','PROFILE '+p.version,'map-card-version');top.append(img,version);
  const name=el('span',p.name,'map-card-title'),description=el('span',p.cardDescription||p.description,'map-card-description');
  const bottom=el('span',undefined,'map-card-bottom');const retained=[...sessions.values()].filter(s=>s.data.profile===p.id);
  const pending=retained.some(s=>s.pending.size||s.data.dirty);
  bottom.append(el('span',pending?'Edits in progress':retained.length?'Session open':'Open editor'),el('span','↗'));
  if(pending)card.classList.add('has-edits');card.onclick=()=>chooseMap(p.id);card.append(top,name,description);
  if(folderReady){const count=entries.filter(e=>!e.backup&&e.profile===p.id).length;card.append(el('span',count?count+' current bank'+(count===1?'':'s')+' found':'No current bank found','map-card-bank-count'));}
  card.append(bottom);$('map-cards').append(card);
 }
}
$('map').onclick=showDashboard;
$('all-maps').onclick=showDashboard;
$('home').onclick=event=>{event.preventDefault();showDashboard();};
renderDashboard();
function refreshAccounts(){const keys=new Set(entries.map(e=>e.account));for(const s of sessions.values())keys.add(s.account);if(account!=='all')keys.add(account);const labels=accountLabels(keys,folderSelection.accountNames);const options=[{value:'all',label:'All detected accounts'},...[...keys].sort((a,b)=>labels.get(a).localeCompare(labels.get(b))).map(key=>({value:key,label:labels.get(key),description:key==='Synthetic example'?'Fictional account for trying the editor.':key}))];$('accounts').replaceChildren(choiceControl('Local account',options,account,{onChange:value=>{account=value;switchSession();}}));}


function render(){
 $('map').textContent=profile.name+' · Change map';refreshAccounts();
 $('map-info').replaceChildren(el('b','Audited profile '+profile.version+' · Map '+(profile.region||1)+'/'+profile.map),el('p',profile.description));
 $('empty').hidden=!!current;$('loaded').hidden=!current;$('editor-title').textContent=current?profile.name:'Choose a bank to begin';
 $('editor-subtitle').textContent=current?current.data.name+' · '+(current.data.demo?'Synthetic example — do not install':'Original validated locally'):'Your original stays unchanged until you explicitly save.';
 $('status-badge').textContent=current?(current.data.demo?'EXAMPLE':'VALIDATED ORIGINAL'):'LOCAL ONLY';
 if(!current)return;
 $('identity').textContent='Player: '+current.data.player+'  /  Map author: '+current.data.author+'  /  '+current.account;
 renderNavigation();
 $('warnings').replaceChildren(...[...current.data.warnings,'Offline validation does not prove acceptance in a published match.',...(profile.id==='fallen'?['Fallen World 0.89 exports the main and comparison banks together. Historical snapshots and map-side account restrictions remain; a matching pair is not proof of live acceptance.']:[])].map(t=>el('p',t)));
 $('replace').disabled=!current.handle||current.data.demo||current.backup;
 $('replace').title=!current.handle?'Open using a supported browser file picker or folder picker to replace the current file.':current.backup?'Backups cannot be replaced as main banks.':'';
 renderFields();renderPresets();renderEditorPage();updateDirty();
}
function updateDirty(){$('change-count').textContent=current?(current.pending.size+' unapplied field change(s)'+(current.data.dirty?' · validated edits staged':'')):'No pending edits';}
function valueOf(f){return current.pending.has(f.id)?current.pending.get(f.id):f.value;}
function renderFields(){if(!current)return;if((profile.id==='reign'&&!current.ui.reignFields)||(profile.id!=='reign'&&!current.ui.profileFields))return;const query=$('search').value.toLowerCase(),group=current.ui.group;const filtered=profile.id==='reign'?reignFields(current.data.fields,current.ui,query):visibleFields(current.data.fields,current.ui,query);const pages=Math.max(1,Math.ceil(filtered.length/50));page=Math.min(page,pages-1);$('fields').replaceChildren();current.ui.page=page;$('field-summary').textContent=(query?'Search results':profile.id==='reign'?(current.ui.reignGroup||current.ui.reignCategory):group)+' · '+filtered.length+' fields · '+filtered.filter(f=>!f.readonly).length+' editable';
 for(const f of filtered.slice(page*50,page*50+50)){const row=el('div',undefined,'field-row'),copy=el('div',undefined,'field-copy'),label=el('label',f.label);const inputId='field-'+current.data.fields.indexOf(f);label.htmlFor=inputId;if(query)copy.append(el('small',f.group,'field-context'));copy.append(label);if(f.description)copy.append(el('p',f.description));const selectionHelp=f.options?.some(o=>o.description)?el('p',f.options.find(o=>String(o.value)===String(valueOf(f)))?.description||'Existing effect code preserved.','option-description'):null;if(selectionHelp)copy.append(selectionHelp);if(f.max!==null&&f.max!==undefined)copy.append(el('small',`Supported range: ${f.min??0}–${f.max}`));if(f.readonly)copy.append(el('small',f.kind==='info'?'Availability from saved progress':f.automatic?'Calculated automatically':'Preserved read-only'));let input;
 if(f.kind==='info'){const output=el('output',String(valueOf(f)));output.id=inputId;row.append(copy,output);if(f.action){const unlock=el('button','Unlock');unlock.onclick=()=>task(()=>preview('preset',f.action));row.append(unlock);}$('fields').append(row);continue;}
 if(f.options?.length){const options=[...f.options];if(!options.some(o=>String(o.value)===String(valueOf(f))))options.push({value:valueOf(f),label:'Existing: '+valueOf(f)});input=choiceControl(f.label,options,valueOf(f));}
 else if(f.kind==='bool'||f.kind==='bit'){input=el('input');input.type='checkbox';input.checked=!!valueOf(f);}
 else if(f.kind==='string'&&String(valueOf(f)).length>45){input=el('textarea');input.value=String(valueOf(f));}
 else{input=el('input');input.type=['int','fixed'].includes(f.kind)?'number':'text';input.value=String(valueOf(f));if(input.type==='number'){input.min=f.min??0;if(f.max!=null)input.max=f.max;input.step=f.kind==='fixed'?'any':'1';}}
 if(input.type==='number'){input.addEventListener('input',()=>{if(input.value!==''&&Number.isFinite(Number(input.value))){if(f.max!=null&&Number(input.value)>Number(f.max))input.value=String(f.max);if(f.min!=null&&Number(input.value)<Number(f.min))input.value=String(f.min);}});}input.id=inputId;input.disabled=!!f.readonly;const stage=()=>{const v=input.type==='checkbox'?input.checked:input.value;if(String(v)===String(f.value))current.pending.delete(f.id);else current.pending.set(f.id,v);current.output=null;if(selectionHelp)selectionHelp.textContent=f.options.find(o=>String(o.value)===String(v))?.description||'Existing effect code preserved.';updateDirty();if(profile.id==='liberty'&&f.label==='Jewel tier')updateSoulLimits(f);};input.addEventListener('input',stage);input.addEventListener('change',stage);row.append(copy,input);$('fields').append(row);}
 if(!filtered.length)$('fields').append(el('p','No fields match this search.'));
 $('pagination').replaceChildren();if(pages>1){const prev=el('button','← Previous'),next=el('button','Next →');prev.disabled=page===0;next.disabled=page===pages-1;prev.onclick=()=>{current.ui.page=--page;renderFields();};next.onclick=()=>{current.ui.page=++page;renderFields();};$('pagination').append(prev,el('span',`${page+1} / ${pages} · ${filtered.length} fields`),next);}
}
function updateSoulLimits(tierField){
 const tier=Number(valueOf(tierField)),cap=current.data.soulCaps?.[String(tier)]??0;
 const stats=current.data.fields.filter(f=>f.group===tierField.group&&f.kind==='fixed');
 stats.forEach((f,i)=>{if(i<5){f.max=cap*(i===0?10:1);const value=Number(valueOf(f));if(Number.isFinite(value)&&value>f.max)current.pending.set(f.id,String(f.max));}});
 renderFields();updateDirty();
 message('Tier limits updated. Any base stats above the new tier cap were reduced in the pending preview. Effects and enhancement count were preserved.');
}
$('search').oninput=()=>{current.ui.query=$('search').value;current.ui.page=page=0;renderFields();};
function renderPresets(){
 const bar=$('preset-bar');bar.replaceChildren();if(!current)return;
 if(profile.id==='liberty'&&current.ui.group?.startsWith('Soul jewel ')){const b=el('button','Max base stats for this jewel');b.onclick=()=>task(()=>preview('preset','soul:'+current.ui.group.split(' ').at(-1)));bar.append(b);}
 const meta=current.data.presetCoverage||{};$('unlock-summary').textContent=meta.summary||'Apply the supported progression presets for this map.';
 const cards=$('unlock-cards');cards.replaceChildren();
 for(const [action,title,tag,body] of [
  ['all_full','Unlock all','MAXIMUM PROGRESSION','Maximize supported unlocks and progression. Public records may look heavily edited.'],
  ['all_plausible','Unlock all (with legit stats)','PLAUSIBLE PUBLIC RECORDS','Keep the supported unlocks and power while using a more restrained public-stat template. Required records and visible max levels may remain high.']]){
  const card=el('article',undefined,'unlock-card');card.append(el('span',tag,'eyebrow'),el('h4',title));if(meta.partial)card.append(el('span','Partial coverage — see limits below','coverage-badge'));card.append(el('p',body));const button=el('button',title,action==='all_full'?'primary':'secondary');button.onclick=()=>task(()=>preview('preset',action));card.append(button);cards.append(card);
 }
 const coverage=$('unlock-coverage');coverage.replaceChildren(el('h4',meta.partial?'Coverage & limits':'What changes'));
 if(meta.differences)coverage.append(el('p',meta.differences));
 const ul=el('ul');for(const text of meta.limits||[])ul.append(el('li',text));coverage.append(ul,el('p','“Legit stats” means an authored public-record template. It does not establish earned progress or guarantee that edited stats appear legitimate.'));
 const specific=$('map-presets');specific.replaceChildren();
 for(const item of current.data.presetActions||[]){const card=el('article',undefined,'specific-card');card.append(el('h4',item.title),el('p',item.description));const button=el('button',item.title);button.onclick=()=>{
   if(item.action==='funded_skills'){task(fundedSkills);return;}
   if(item.action==='navigate:souls'){current.ui.view='edit';current.ui.overview=false;current.ui.category='Equipment & glyphs';current.ui.group='Soul jewel 1';current.ui.groupPage=0;current.ui.groupQuery='';current.ui.query='';render();return;}
   task(()=>preview('preset',item.action));
  };card.append(button);specific.append(card);
 }
 if(!specific.childElementCount)specific.append(el('p','This profile uses the two presets above. Individual unlocks remain available in Edit bank.','muted'));
}
function renderNavigation(){
 current.ui??={view:'edit',category:'',group:'',query:'',page:0};const ui=current.ui,isReign=profile.id==='reign';
 $('reign-browser').hidden=!isReign;$('profile-browser').hidden=isReign;
 if(isReign)ui.reignFields=renderReign({current,root:$('reign-browser'),change:render,modal,action:(op,request)=>task(()=>preview(op,undefined,{request}))});
 else ui.profileFields=renderProfileNavigation({current,profile,root:$('profile-browser'),change:render});
 const visible=isReign?ui.reignFields:ui.profileFields;
 for(const id of ['fields','field-summary','pagination','preset-bar'])$(id).hidden=!visible;
 document.querySelector('#page-edit .tools').hidden=!visible;
 $('search').value=ui.query;page=ui.page||0;
}
function renderEditorPage(){
 if(!current)return;for(const name of ['edit','unlocks','validation']){const active=current.ui.view===name;$('page-'+name).hidden=!active;$('tab-'+name).setAttribute('aria-selected',String(active));$('tab-'+name).tabIndex=active?0:-1;}
}
for(const name of ['edit','unlocks','validation'])$('tab-'+name).onclick=()=>{if(current){current.ui.view=name;renderEditorPage();}};
for(const [index,name] of ['edit','unlocks','validation'].entries())$('tab-'+name).onkeydown=event=>{if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();const next=['edit','unlocks','validation'][(index+(event.key==='ArrowRight'?1:2))%3];$('tab-'+next).click();$('tab-'+next).focus();}};

async function fundedSkills(){
 const s=current,box=modal('Funded skill loadout · three-file export');
 box.append(el('p','Ordinary Unlock all changes progression, not saved skill spending. This separate preset funds regular skills and Ascendancy, chooses affordable Special ranks and reserves points for Extras. It raises your skill and ascension levels.'));
 box.append(el('p','Open FWLSBank2.SC2Bank from the same account and map-author folder. Your other slots are preserved. The selected slot is replaced with AllSkills and enabled for automatic loading.'));
 const guardPicker=await mirrorPicker(s,box,fallenContext());
 const file=el('input');file.type='file';file.accept='.SC2Bank';file.id='companion-file';const fileLabel=el('label','Existing FWLSBank2 companion');fileLabel.htmlFor=file.id;
 const slot=choiceControl('Slot to replace',Array.from({length:5},(_,i)=>({value:i+1,label:'Slot '+(i+1)})),1);slot.id='loadout-slot';const slotLabel=el('label','Slot to replace');slotLabel.htmlFor=slot.id;
 const priority=choiceControl('Special-point priority',['Income & experience','Buff chance & experience','Balanced'].map(name=>({value:name,label:name})),'Income & experience');priority.id='special-priority';const priorityLabel=el('label','Special-point priority');priorityLabel.htmlFor=priority.id;
 const go=el('button','Review funded bundle','primary');go.onclick=()=>task(async()=>{
  if(!file.files[0]||file.files[0].name.toLowerCase()!=='fwlsbank2.sc2bank')throw Error('Choose the existing FWLSBank2.SC2Bank from this account’s author folder.');
  if(file.files[0].size>4194304)throw Error('Companion exceeds 4 MB.');
  const result=await rpc({op:'funded_skills',session:s.data.session,mirror:guardPicker.get().encoded,edits:Object.fromEntries(s.pending),companion:b64(new Uint8Array(await file.files[0].arrayBuffer())),slot:Number(slot.value),priority:priority.value});
  const review=modal('Review funded skills bundle');review.append(el('p','No original was changed. Back up all originals and install FWLSBank, FWLSBankChk and FWLSBank2 together outside every match. Historical snapshots are preserved. Extras purchases are still made manually each match; not all Special caps can be funded at once.'),el('pre',result.notes));
  const downloadButton=el('button','Download all three banks as ZIP','primary');downloadButton.onclick=()=>{download(un64(result.archive),(s.data.demo?'demo-':'')+'Fallen-World-funded-skills.zip');$('dialog').close();message('Three-bank bundle exported. Original files, snapshots and your editing session are unchanged.');};review.append(downloadButton);
 });
 box.append(fileLabel,file,slotLabel,slot,priorityLabel,priority,go);
}
async function update(op,extra={}){const data=await rpc({op,session:current.data.session,edits:Object.fromEntries(current.pending),...extra});current.data=data;current.pending.clear();current.output=data.output?un64(data.output):null;if(data.original)current.original=un64(data.original);keep();render();return data;}
function changes(before,after){const old=new Map(before.map(f=>[f.id,f]));return after.filter(f=>String(f.value)!==String(old.get(f.id)?.value)).map(f=>`${f.group} / ${f.label}: ${old.get(f.id)?.value??'—'} → ${f.value}`);}
async function preview(op='preview',action,extra={}){const before=current.data.fields,beforeReign=current.data.reign;const data=await update(op,{...(action?{action}:{}),...extra});const box=modal(op==='preset'?'Review staged preset':'Changes validated');box.append(el('p','These changes are staged in this browser. Your original file has not been modified.'));const diff=changes(before,data.fields).concat(inventoryChanges(beforeReign,data.reign));box.append(el('pre',(diff.length?diff.slice(0,160).join('\n')+(diff.length>160?`\n… ${diff.length-160} more changes`:''):'No additional changes. Current pending state passed validation.')+'\n\n'+(data.notes||[]).join('\n')));const actions=el('div',undefined,'dialog-actions'),undo=el('button','Undo latest'),done=el('button','Keep staged changes','primary');undo.onclick=()=>task(async()=>{await update('undo');$('dialog').close();});done.onclick=()=>$('dialog').close();actions.append(undo,done);box.append(actions);}
$('preview').onclick=()=>task(()=>preview());$('undo').onclick=()=>task(async()=>{await update('undo');message('Latest validated changes undone.');});$('reset').onclick=()=>{const box=modal('Reset pending changes?');box.append(el('p','Return this session to the original bank you opened. Other accounts and maps are kept.'));const button=el('button','Reset this session','primary');button.onclick=()=>task(async()=>{await update('reset');$('dialog').close();});box.append(button);};
const classify=name=>classifyName(name,profiles);
function renderBanks(){
 const list=$('bank-list');list.replaceChildren();
 const filtered=entries.filter(e=>!e.backup&&e.profile===profile.id&&(account==='all'||e.account===account)).sort((a,b)=>a.relative.localeCompare(b.relative));
 if(filtered.length>1)list.append(el('small','More than one main-bank location matches. Choose the account, author and path you use; no file is selected by age.'));
 for(const entry of filtered){const b=el('button',entry.name);b.append(el('small','Main bank · '+accountName(entry.account,folderSelection.accountNames)),el('small','Author '+entry.author));if(filtered.length>1)b.append(el('small',entry.relative));b.onclick=()=>task(()=>openEntry(entry));list.append(b);}
 if(entries.length&&!filtered.length)list.append(el('small','No current main bank found for this map and account. Nested copies and backups are excluded.'));
}
function folderStatus(text){$('folder-status').textContent=text;$('rescan-folder').hidden=!folderSelection.root;}
function welcomeStatus(text,error=false){$('welcome-status').textContent=text;$('welcome-status').classList.toggle('error',error);}
function finishFolderSelection(){
 folderReady=true;renderDashboard();
 $('dashboard-folder-status').textContent=entries.length+' current bank'+(entries.length===1?'':'s')+' found across your accounts. Choose a map to see its saves.';
 $('dashboard-folder').textContent='Change folder';
 $('welcome').close();
}
function skipFolderSelection(){if(busy)return;$('welcome').close();$('dashboard-title').focus({preventScroll:true});}
function pickFolder(){welcomeStatus('Choose your StarCraft II folder in Documents or OneDrive.');return task(()=>scanFolder());}
$('welcome-folder').onclick=pickFolder;
$('dashboard-folder').onclick=pickFolder;
$('welcome-skip').onclick=skipFolderSelection;
$('welcome').addEventListener('cancel',event=>{event.preventDefault();skipFolderSelection();});
$('welcome-reconnect').onclick=()=>task(async()=>{
 const root=folderSelection.root;if(!root)return;
 welcomeStatus('Requesting access to your remembered folder…');
 if(await root.requestPermission({mode:'read'})!=='granted'){welcomeStatus('Access was not granted. Try reconnecting or select a different folder.',true);return;}
 await scanFolder(root);
});
async function scanFolder(root){
 if(!window.showDirectoryPicker){$('folder-fallback').click();return;}
 try{root=root||await showDirectoryPicker({mode:'read',id:'starcraft-banks'});}catch(error){if(error.name==='AbortError'){welcomeStatus('No folder selected. Choose a folder when you’re ready, or continue without one.');return;}throw error;}
 welcomeStatus('Finding current banks for all supported maps…');
 entries=await folderSelection.scan(root);refreshAccounts();renderBanks();
 let suffix='';try{await rememberedFolder('put',root);}catch{suffix=' Remembered for this tab only.';}
 folderStatus('Selected: '+root.name+'. Shared by all map profiles.'+suffix);
 message(`Found ${entries.length} main bank file(s). Nested copies and backups are excluded. No files changed.`);
 finishFolderSelection();
}
$('folder').onclick=()=>task(()=>scanFolder());
$('rescan-folder').onclick=()=>task(async()=>{
 const root=folderSelection.root;
 if(await root.queryPermission({mode:'read'})!=='granted'&&await root.requestPermission({mode:'read'})!=='granted')throw Error('Folder access was not granted. Select your Starcraft folder again.');
 await scanFolder(root);
});
async function restoreFolder(){
 if(!window.showDirectoryPicker)return;
 try{
  const root=await rememberedFolder('get');if(!root)return;
  folderSelection.root=root;
  if(await root.queryPermission({mode:'read'})==='granted'){
   entries=await folderSelection.scan();refreshAccounts();renderBanks();
   folderStatus('Selected: '+root.name+'. Shared by all map profiles.');
   finishFolderSelection();
  }else{folderStatus('Remembered: '+root.name+'. Click Refresh banks to reconnect.');$('welcome-reconnect').hidden=false;welcomeStatus('Your folder is remembered. Reconnect it to find your current banks.');}
 }catch{folderStatus('Select your Starcraft folder to reconnect.');welcomeStatus('Your previous folder could not be read. Select it again to reconnect.',true);}
}
$('folder-fallback').onchange=()=>task(async()=>{
 if(!$('folder-fallback').files.length)return;
 welcomeStatus('Finding current banks for all supported maps…');const found=[];fallbackFiles.clear();
 for(const file of $('folder-fallback').files){
  const relative=file.webkitRelativePath,parts=relative.split('/');fallbackFiles.set(relative,file);
  // Match the native walk: every directory transition must be canonical.
  if(parts.slice(1,-1).some((name,i)=>!shouldScanDirectory(parts.slice(0,i+1).join('/'),name)))continue;
  if(isAccountShortcut(parts.slice(0,-1).join('/'),file.name)){try{addAccountName(folderSelection.accountNames,await readAccountShortcut(file));}catch{}}
  const entry=currentBankCandidate(relative,profiles);if(entry)found.push({...entry,file});
 }
 entries=found;
 folderSelection.root=null;$('rescan-folder').hidden=true;folderStatus('Folder selected. Shared by all map profiles in this tab.');
 refreshAccounts();renderBanks();
 message(`Found ${entries.length} main bank file(s). Nested copies and backups are excluded. This browser can export copies; direct replacement requires Chrome or Edge file access.`);
 finishFolderSelection();
});
async function openEntry(entry){const old=sessions.get(sessionKey(entry.account,entry.profile,entry.author,entry.name));if(old&&(old.data.dirty||old.pending.size)){message('Resumed this bank’s pending edits. Reset that session before re-reading its disk file.');selectedSessions.set(cacheKey(entry.account,entry.profile),sessionKey(entry.account,entry.profile,entry.author,entry.name));account=entry.account;profile=profiles.find(p=>p.id===entry.profile);$('map').value=profile.id;refreshAccounts();switchSession();return;}
 const file=entry.handle?await entry.handle.getFile():entry.file;if(file.size>4194304)throw Error('Banks must be no larger than 4 MB.');const bytes=new Uint8Array(await file.arrayBuffer());const data=await rpc({op:'open',profile:entry.profile,raw:b64(bytes),name:entry.name,player:entry.player,author:entry.author});keep();account=entry.account;profile=profiles.find(p=>p.id===entry.profile);current={data,account,handle:entry.handle||null,directory:entry.directory||null,mirrorFile:entry.relative?fallbackFiles.get(entry.relative.replace(/[^/]+$/,'FWLSBankChk.SC2Bank')):null,backup:entry.backup,original:bytes,pending:new Map(),output:null};keep();$('map').value=profile.id;refreshAccounts();page=0;message('Original checks passed. Edit a field, then review your changes.');render();renderBanks();}
function askIdentity(file,handle){const box=modal('Open your bank');box.append(el('p','Use the original player and map-author handles from the bank’s folder path. Account selection does not convert ownership. Example path: … / <player> / Banks / <author> / '+file.name));const player=el('input'),author=el('input');player.placeholder='1-S2-1-1234567';author.placeholder='1-S2-1-7654321';player.id='original-player';author.id='original-author';for(const [text,input] of [['Original player handle',player],['Map-author handle',author]]){const l=el('label',text);l.htmlFor=input.id;box.append(l,input);}const go=el('button','Validate & open','primary');go.onclick=()=>task(async()=>{const pattern=/^\d+-S2-\d+-\d+$/;if(!pattern.test(player.value.trim())||!pattern.test(author.value.trim()))throw Error('Enter both original handles in the displayed format.');await openEntry({profile:profile.id,name:file.name,player:player.value.trim(),author:author.value.trim(),account:player.value.trim()+' · manual',file,handle,backup:classify(file.name)?.backup??true});$('dialog').close();});box.append(el('div','', 'dialog-actions'));box.lastChild.append(go);}
$('open').onclick=()=>task(async()=>{if(window.showOpenFilePicker){const [handle]=await showOpenFilePicker({types:[{description:'SC2 bank',accept:{'application/octet-stream':['.SC2Bank']}}],multiple:false});askIdentity(await handle.getFile(),handle);}else $('file').click();});
$('file').onchange=()=>{if($('file').files[0])askIdentity($('file').files[0],null);$('file').value='';};
$('demo').onclick=()=>task(async()=>{const demoAccount='Synthetic example';keep();account=demoAccount;const existing=sessions.get(selectedSessions.get(cacheKey(account,profile.id)));if(existing)current=existing;else{const data=await rpc({op:'open',profile:profile.id,demo:true});current={data,account,pending:new Map(),handle:null,backup:false,original:null,output:null};}keep();refreshAccounts();message('Synthetic example only. No real account or bank is connected.');render();renderBanks();});
$('export').onclick=()=>task(async()=>{await update('preview');if(current.data.profile==='fallen'){await saveFallen(current,'export',fallenContext());return;}const box=modal('Export a validated copy');box.append(el('p','The original bank stays unchanged. Keep the exact filename when installing an edited save, and leave every match first.'));const b=el('button','Download '+current.data.name,'primary');const s=current;b.onclick=()=>{download(s.output,(s.data.demo?'demo-':'')+s.data.name);$('dialog').close();message('Validated copy downloaded. The current bank was not replaced.');};box.append(b);});
const db=new Promise((resolve,reject)=>{const r=indexedDB.open('arcade-bank-workshop-recovery',1);r.onupgradeneeded=()=>r.result.createObjectStore('backups',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
async function vault(method,value){const d=await db;return new Promise((resolve,reject)=>{const tx=d.transaction('backups',method==='put'?'readwrite':'readonly'),store=tx.objectStore('backups');const r=method==='put'?store.put(value):method==='get'?store.get(value):store.getAll();let result;r.onsuccess=()=>{result=r.result;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Recovery storage unavailable.'));});}
function fallenContext(){return {el,modal,task,b64,un64,rpc,download,message,vault,close:()=>$('dialog').close(),reloaded:async(s,raw)=>{s.data=await rpc({op:'open',profile:'fallen',raw:b64(raw),name:s.data.name,player:s.data.player,author:s.data.author});s.original=raw;s.output=null;s.pending.clear();keep();render();}};}
$('replace').onclick=()=>task(async()=>{if(!current.handle||current.backup||current.data.demo)throw Error('Replacement is only available for an opened main bank.');await update('preview');if(current.data.profile==='fallen'){await saveFallen(current,'replace',fallenContext());return;}const s=current,box=modal('Replace this current bank?');box.append(el('p',`${s.data.name} · ${s.data.player}`),el('p','A verified original backup is stored in this browser’s Recovery vault, outside the SC2 bank folders. You can download it later. Clearing this site’s browser data removes that vault.'));const row=el('div',undefined,'confirm-check'),check=el('input');check.type='checkbox';check.id='menu-confirm';const label=el('label','StarCraft II is closed, or I am at the main menu outside every match.');label.htmlFor=check.id;row.append(check,label);box.append(row);const go=el('button','Back up & replace','primary');go.disabled=true;check.onchange=()=>go.disabled=!check.checked;go.onclick=()=>task(async()=>{if(!check.checked)throw Error('Confirm that you are outside every match.');const readback=await replaceVerified({handle:s.handle,original:s.original,output:s.output,confirmed:check.checked,backup:async(raw,sha)=>{const record={id:crypto.randomUUID(),created:new Date().toISOString(),name:s.data.name,player:s.data.player,author:s.data.author,profile:s.data.profile,raw,sha};await vault('put',record);return record.id;},verifyBackup:async id=>(await vault('get',id))?.raw});s.data=await rpc({op:'open',profile:s.data.profile,raw:b64(readback),name:s.data.name,player:s.data.player,author:s.data.author});s.original=readback;s.output=null;s.pending.clear();keep();render();$('dialog').close();message('Bank replaced and verified. Original preserved in Recovery vault. The game has not been observed reloading it.');});box.append(el('div',undefined,'dialog-actions'));box.lastChild.append(go);});
$('backups').onclick=()=>task(async()=>{const records=(await vault('all')).sort((a,b)=>b.created.localeCompare(a.created));const box=modal('Recovery vault');box.append(el('p','Verified originals from replacements made in this browser. Download an independent copy before clearing site data.'));if(!records.length)box.append(el('p','No replacements have been made in this browser.'));for(const r of records){const b=el('button',r.name+' · '+r.player+' · '+new Date(r.created).toLocaleString());b.className='full';b.onclick=()=>task(async()=>{if(await digest(r.raw)!==r.sha)throw Error('Backup checksum mismatch.');download(r.raw,r.name);});box.append(b);}});
$('guide').onclick=()=>{const box=modal('Your bank, step by step');for(const [title,text] of [['1. Choose your map','Choose one of our version-specific profiles. Match the displayed map version; a bank does not prove which map release wrote it.'],['2. Find your account','Select the StarCraft II folder under Documents or OneDrive. The site detects bank folders and keeps accounts and map authors separate. Or open a file and enter its original handles.'],['3. Edit and review','Fields show known bounds and descriptions. Validation applies the same codecs as our desktop editor. Review presets before exporting; unsupported original data is preserved or rejected.'],['4. Save outside a match','Export a copy in any supported browser. Chrome and Edge can also replace a file you explicitly opened, after original-change checks, a verified recovery backup and your per-save main-menu confirmation.'],['Privacy and persistence','Files are processed locally. Unsaved editing sessions live in memory and are lost when the page closes. The selected folder is shared across profiles. Chrome and Edge can remember its handle across visits, subject to browser permission. Unsaved edits are not retained after closing the page. Replacement backups persist in the local Recovery vault; they are not uploaded.'],['Compatibility','Map updates, account restrictions and game logic can still reject offline-valid saves. This tool does not grant staff access. Fallen World 0.89 saves FWLSBank and FWLSBankChk together, while preserving snapshots. Account restrictions cannot be removed by editing a bank. Paired browser replacement is backed up with rollback handling; it is not an atomic multi-file commit.']])box.append(el('h3',title),el('p',text));};
window.addEventListener('beforeunload',e=>{if([...sessions.values()].some(s=>s.data.dirty||s.pending.size)){e.preventDefault();e.returnValue='';}});
render();
$('welcome').showModal();
welcomeStatus('Checking for a remembered folder…');
await task(restoreFolder);
if($('welcome').open&&$('welcome-status').textContent==='Checking for a remembered folder…')welcomeStatus('Folder access stays in your browser. Your bank files are never uploaded.');
if($('welcome').open)$('welcome-folder').focus();
