// Reign's named navigation and inventory views. All mutations use the validated bridge.
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const button=(text,fn,cls='')=>{const b=node('button',text,cls);b.type='button';b.onclick=fn;return b;};
const select=(label,options,value)=>{const wrap=node('label',label,'reign-control'),input=node('select');input.setAttribute('aria-label',label);for(const [v,t] of options){const o=node('option',t);o.value=v;input.append(o);}input.value=value;wrap.append(input);return {wrap,input};};
const number=(label,value,min,max)=>{const wrap=node('label',label,'reign-control'),input=node('input');input.type='number';input.value=value;input.min=min;input.max=max;wrap.append(input);return {wrap,input};};
export function inventoryChanges(before,after){
 if(!before||!after)return [];const lines=[];
 for(const c of after.equipment.carriers){const old=before.equipment.carriers.find(x=>x.id===c.id);for(const t of c.containers)for(const s of t.slots){const prior=old?.containers.find(x=>x.index===t.index)?.slots.find(x=>x.slot===s.slot);if(prior?.item?.id!==s.item?.id)lines.push(`${c.label} / ${t.label} / ${s.label}: ${prior?.item?.name||'Empty'} → ${s.item?.name||'Empty'}`);}}
 const glyphText=g=>g?.empty?'Empty':`${g?.qualityLabel||'Unknown'} · ${g?.name||'Glyph'} · tier ${g?.tier??'?'} · ${(g?.stats||[]).map(s=>s.label+' '+s.value).join(', ')}`;
 for(const h of after.glyphs.heroes){const old=before.glyphs.heroes.find(x=>x.id===h.id);for(const s of h.slots){const prior=old?.slots.find(x=>x.slot===s.slot);if(glyphText(prior)!==glyphText(s))lines.push(`${h.label} / ${s.label}: ${glyphText(prior)} → ${glyphText(s)}`);}}
 return lines;
}
function pageSlots(panel,slots,ui,key,draw){const pages=Math.ceil(slots.length/24);ui[key]=Math.min(ui[key]||0,Math.max(0,pages-1));if(pages>1)buttons(panel,Array.from({length:pages},(_,i)=>[i,`${i*24+1}–${Math.min(slots.length,(i+1)*24)}`]),ui[key],i=>{ui[key]=i;draw();},'Inventory slot pages');return slots.slice(ui[key]*24,ui[key]*24+24);}
function buttons(parent,items,current,choose,label){const bar=node('div',undefined,'reign-buttons');bar.setAttribute('role','group');bar.setAttribute('aria-label',label);for(const [id,title] of items){const b=button(title,()=>choose(id));b.setAttribute('aria-pressed',String(String(id)===String(current)));bar.append(b);}parent.append(bar);}
export function filteredFields(fields,ui,query=''){
 const q=query.toLowerCase().trim();
 return fields.filter(f=>q?`${f.label} ${f.group} ${f.description}`.toLowerCase().includes(q):f.category===ui.reignCategory&&(!['Heroes','Ascendancy','Charms'].includes(ui.reignCategory)||f.hero==null||String(f.hero)===String(ui.reignHero))&&(!ui.reignGroup||f.group===ui.reignGroup));
}
export function renderReign({current,root,change,modal,action}){
 const {data,ui}=current,r=data.reign;root.replaceChildren();
 ui.reignCategory??='Overview';ui.reignHero??=r.heroes[0].id;
 const categories=['Overview','Heroes','Equipment','Glyphs','Ascendancy','Perks','Charms','Resources','Records','Preferences','Advanced'];
 const labels={Heroes:'Hero progression',Ascendancy:'Ascendancy',Preferences:'Game settings',Advanced:'Advanced records'};
 buttons(root,categories.map(c=>[c,labels[c]||c]),ui.reignCategory,c=>{ui.reignCategory=c;ui.reignGroup='';ui.query='';ui.page=0;change();},'Reign editor categories');
 const panel=node('div',undefined,'reign-panel');root.append(panel);
 if(['Heroes','Glyphs','Ascendancy','Charms'].includes(ui.reignCategory))buttons(panel,r.heroes.map(h=>[h.id,h.name]),ui.reignHero,id=>{ui.reignHero=id;ui.reignGroup='';ui.page=0;change();},'Choose a hero');
 const equipment=r.equipment,glyphs=r.glyphs;
 if(ui.reignCategory==='Overview'){
  panel.append(node('span','REIGN OF CHAOS · YOUR SAVE','eyebrow'),node('h3','Everything has its place.'),node('p','Choose a hero to edit its level, evolution and ascendancy. Equipment and glyphs have separate inventories; adding a stored item does not equip it.'));
  const grid=node('div',undefined,'reign-overview');
  for(const [title,body,target] of [['Hero progression','Named evolution forms, exact level XP and Hero mastery.','Heroes'],['Equipment','Browse '+equipment.catalog.length+' named items. Choose active equipment, hero storage or the shared stash.','Equipment'],['Glyphs','Named powers, actual rarity and tier-specific stat limits. Create in storage, then equip.','Glyphs'],['Ascendancy','Named abilities and passive nodes, with point budgets and requirements.','Ascendancy'],['Perks & charms','Manage permanent perks, owned charms and normal charm loadouts.','Perks'],['Unlock All','Apply supported map presets, then review and save your changes.','Unlock All']]){
   const card=button('',()=>{if(target==='Unlock All')ui.view='unlocks';else ui.reignCategory=target;ui.reignGroup='';change();},'reign-overview-card');card.append(node('strong',title),node('span',body));grid.append(card);
  }panel.append(grid);
  const missing=equipment.carriers.filter(c=>c.heroId&&!c.editable);if(missing.length)panel.append(node('p','Saved inventories unavailable: '+missing.map(c=>c.label).join(', ')+'. Play and save these heroes once before editing their equipment.','coverage-note'));
  return false;
 }
 if(ui.reignCategory==='Equipment'){renderEquipment(panel,equipment,ui,change,modal,request=>action('reign_equipment',request));return false;}
 if(ui.reignCategory==='Glyphs'){renderGlyphs(panel,glyphs,ui,change,modal,request=>action('reign_glyph',request));return false;}
 const scoped=data.fields.filter(f=>f.category===ui.reignCategory&&(!['Heroes','Ascendancy','Charms'].includes(ui.reignCategory)||f.hero==null||String(f.hero)===String(ui.reignHero)));
 const groups=[...new Set(scoped.map(f=>f.group))];if(!groups.includes(ui.reignGroup))ui.reignGroup='';
 if(groups.length>1)buttons(panel,[['','All fields'],...groups.map(g=>[g,g.replace(/^.+? · /,'')])],ui.reignGroup,g=>{ui.reignGroup=g;ui.page=0;change();},'Field groups');
 if(ui.reignCategory==='Ascendancy')panel.append(node('p','Allocate a total point budget first, then choose named ranks. Passive nodes must connect to Skill Points. Review validates the whole tree.','reign-hint'));
 if(ui.reignCategory==='Advanced')panel.append(node('p','Unmapped and reserved records are kept separate from normal gameplay controls. Their descriptions state the known limits.','reign-hint'));
 return true;
}
function rarity(parent,value){if(value)parent.append(node('span',value,'reign-rarity'));}
function renderEquipment(panel,data,ui,change,modal,act){
 ui.equipmentCarrier??=data.carriers.find(c=>c.editable&&c.heroId)?.id||data.carriers[0].id;
 buttons(panel,data.carriers.map(c=>[c.id,c.label]),ui.equipmentCarrier,id=>{ui.equipmentCarrier=id;ui.equipmentContainer=0;change();},'Equipment destination');
 const carrier=data.carriers.find(c=>c.id===ui.equipmentCarrier)||data.carriers[0];ui.equipmentContainer??=0;
 const tab=carrier.containers.find(c=>c.index===ui.equipmentContainer)||carrier.containers[0];
 buttons(panel,carrier.containers.map(c=>[c.index,c.label]),tab.index,n=>{ui.equipmentContainer=n;change();},'Inventory tabs');
 panel.append(node('h3',carrier.label+' · '+tab.label),node('p',tab.label==='Active equipment'?data.activeSlotRule:carrier.heroId?'Items stored here belong to this hero. Move an item into Active equipment to equip it.':'Items stored here appear in the shared stash chest. Withdraw them in game.'));
 if(!carrier.editable)panel.append(node('p',carrier.reason,'coverage-note'));
 const grid=node('div',undefined,'reign-slots');
 for(const slot of pageSlots(panel,tab.slots,ui,'equipmentPage',change)){const card=button('',()=>equipmentSlot(data,carrier,tab,slot,modal,act),'reign-slot');card.append(node('small',slot.label),node('strong',slot.item?.name||'Empty slot'));rarity(card,slot.item?.rarity);if(!slot.editable)card.append(node('small',slot.item?'Preserved':'Unavailable'));card.setAttribute('aria-label',carrier.label+' '+tab.label+' '+slot.label+': '+(slot.item?.name||'Empty slot'));grid.append(card);}panel.append(grid);
 const help=node('details');help.append(node('summary','Where will my items appear?'));for(const line of [...data.delivery,data.duplicates,data.verification])help.append(node('p',line));panel.append(help);
}
function equipmentSlot(data,carrier,tab,slot,modal,act){
 const box=modal(carrier.label+' · '+tab.label+' · '+slot.label),base={carrier:carrier.id,container:tab.index,slot:slot.slot};
 if(!slot.editable){box.append(node('p',slot.reason));if(slot.item){box.append(node('h3',slot.item.name),node('p',slot.item.description));rarity(box,slot.item.rarity);}return;}
 if(slot.item){box.append(node('h3',slot.item.name));rarity(box,slot.item.rarity);box.append(node('p',slot.item.description,'reign-description'));
  box.append(button('Move to another slot',()=>equipmentDestination(data,slot.item,modal,d=>act({...base,action:'move',toCarrier:d.carrier,toContainer:d.container,toSlot:d.slot}))),button('Review removal',()=>act({...base,action:'remove'}),'danger'));return;
 }
 const search=node('input');search.type='search';search.placeholder='Search item names and effects';search.setAttribute('aria-label','Search equipment');const filters=node('div'),list=node('div',undefined,'reign-catalog');let selected='All rarities';
 box.append(node('p','Add to '+carrier.label+' → '+tab.label+' → '+slot.label+'. The original bank stays unchanged until you save.'),search,filters,list);
 const draw=()=>{filters.replaceChildren();buttons(filters,['All rarities',...new Set(data.catalog.map(i=>i.rarity))].map(v=>[v,v]),selected,v=>{selected=v;draw();},'Item rarity');list.replaceChildren();
  const matches=data.catalog.filter(i=>(slot.slotClass==='storage'||i.slotClass===slot.slotClass)&&(selected==='All rarities'||i.rarity===selected)&&`${i.name} ${i.description}`.toLowerCase().includes(search.value.toLowerCase()));
  for(const item of matches){const card=node('article',undefined,'reign-catalog-card');card.append(node('h4',item.name));rarity(card,item.rarity);card.append(node('p',item.description,'reign-description'));if(item.dynamicStats)card.append(node('small','Some values are calculated in-game; the tooltip marks these as dynamic.'));card.append(button('Review adding '+item.name,()=>act({...base,action:'add',itemId:item.id}),'primary'));list.append(card);}if(!matches.length)list.append(node('p','No matching items for this slot.'));
 };search.oninput=draw;draw();
}
function equipmentDestination(data,item,modal,choose){
 const box=modal('Choose an empty destination'),tabs=node('div'),slots=node('div',undefined,'reign-slots');box.append(node('p','Move '+item.name+'. Choose the destination explicitly; occupied slots will not be overwritten.'),tabs,slots);let carrier=data.carriers.find(c=>c.editable),index=carrier?.containers[0].index;
 const draw=()=>{tabs.replaceChildren();slots.replaceChildren();if(!carrier)return;buttons(tabs,data.carriers.filter(c=>c.editable).map(c=>[c.id,c.label]),carrier.id,id=>{carrier=data.carriers.find(c=>c.id===id);index=0;draw();},'Move destination hero or stash');buttons(tabs,carrier.containers.map(t=>[t.index,t.label]),index,n=>{index=n;draw();},'Move destination inventory');const tab=carrier.containers.find(t=>t.index===index);const itemClass=data.catalog.find(i=>i.id===item.id)?.slotClass;
  for(const s of tab.slots.filter(s=>s.editable&&!s.item&&(s.slotClass==='storage'||s.slotClass===itemClass)))slots.append(button(s.label,()=>choose({carrier:carrier.id,container:index,slot:s.slot}),'reign-slot'));if(!slots.childElementCount)slots.append(node('p','No compatible empty slots here.'));
 };draw();
}
function glyphSummary(box,g){rarity(box,g.qualityLabel);box.append(node('p','Tier '+g.tier));for(const power of g.powers||[]){box.append(node('h4',power.name),node('p',power.description,'reign-description'));}for(const stat of g.stats||[])box.append(node('p',stat.label+': '+stat.value+' '+stat.unit+' · tier ceiling '+stat.max));}
function renderGlyphs(panel,data,ui,change,modal,act){
 const hero=data.heroes.find(h=>String(h.id)===String(ui.reignHero))||data.heroes[0];ui.glyphView??='equipped';
 buttons(panel,[['equipped','Equipped glyphs'],['storage','Glyph storage']],ui.glyphView,v=>{ui.glyphView=v;change();},'Glyph inventory');
 panel.append(node('h3',hero.label+' · '+(ui.glyphView==='storage'?'Glyph storage':'Equipped glyphs')),node('p',ui.glyphView==='storage'?data.storageHelp:data.equipHelp),node('p','Glyph Crafting Power: '+data.mastery,'reign-hint'));
 const grid=node('div',undefined,'reign-slots');for(const g of pageSlots(panel,hero.slots.filter(g=>g.location===ui.glyphView),ui,'glyphPage',change)){const card=button('',()=>glyphSlot(data,hero,g,modal,act),'reign-slot');card.append(node('small',g.label),node('strong',g.empty?'Empty slot':g.name));rarity(card,g.qualityLabel);if(!g.empty&&g.tier!=null)card.append(node('small','Tier '+g.tier));if(g.locked)card.append(node('small','Requires Glyph Crafting Power '+g.requiredMastery));grid.append(card);}panel.append(grid);
 const help=node('details');help.append(node('summary','Glyph powers, limits & delivery'));for(const t of [data.powerHelp,data.limitsHelp,data.saveHelp])help.append(node('p',t));panel.append(help);
}
function glyphSlot(data,hero,g,modal,act){
 const box=modal(hero.label+' · '+g.label),base={hero:hero.id,slot:g.slot};
 if(!g.editable){box.append(node('p',g.description),node('p',g.error));return;}
 if(g.empty){if(g.location==='equipped'){box.append(node('p','Create or choose a glyph in this hero’s Glyph storage, then equip it into a matching rarity slot.'));return;}glyphForm(box,data,hero,g,act);return;}
 glyphSummary(box,g);box.append(button('Edit glyph',()=>glyphForm(modal('Edit '+hero.label+' glyph'),data,hero,g,act)));
 if(g.location==='storage'){for(const destination of hero.slots.filter(s=>s.location==='equipped'&&s.acceptsQuality===g.quality)){box.append(button('Equip → '+destination.label,()=>glyphTransfer(data,hero,g,destination,modal,act)));}}
 else box.append(button('Unequip to storage',()=>glyphStorageDestination(hero,g,modal,d=>act({...base,action:'unequip',toSlot:d.slot}))));
 if(g.location==='storage')box.append(button('Move within glyph storage',()=>glyphStorageDestination(hero,g,modal,d=>act({...base,action:'move',toSlot:d.slot}))));
 box.append(button('Review removing glyph',()=>act({...base,action:'remove'}),'danger'));
}
function glyphTransfer(data,hero,g,d,modal,act){const box=modal('Equip '+g.qualityLabel+' glyph');box.append(node('p',hero.label+': '+g.label+' → '+d.label+'. '+(d.empty?'The storage slot becomes empty.':'The currently equipped glyph swaps into this storage slot.')));let unlock;
 if(data.mastery<d.requiredMastery){const label=node('label',undefined,'reign-checkbox');unlock=node('input');unlock.type='checkbox';label.append(unlock,document.createTextNode(' Also raise Glyph Crafting Power to '+d.requiredMastery+' (required for this slot)'));box.append(label);}
 box.append(button('Review equipping glyph',()=>act({action:'equip',hero:hero.id,slot:g.slot,toSlot:d.slot,unlockMastery:!!unlock?.checked}),'primary'));
}
function glyphStorageDestination(hero,g,modal,choose){const box=modal('Choose an empty glyph storage slot'),grid=node('div',undefined,'reign-slots');box.append(grid);for(const s of hero.slots.filter(s=>s.location==='storage'&&s.empty&&s.editable))grid.append(button(s.label,()=>choose(s),'reign-slot'));if(!grid.childElementCount)grid.append(node('p','Glyph storage is full.'));}
function glyphForm(box,data,hero,g,act){
 let quality=g.quality??data.qualities[0].id;const qualityBar=node('div'),form=node('div');box.append(node('p',g.empty?'A new glyph goes into '+hero.label+'’s glyph storage. Equip it separately to activate its effects.':'Edit this glyph’s rarity, powers and stat rolls. Existing unsupported values are preserved unless changed.'),qualityBar,form);
 const build=()=>{qualityBar.replaceChildren();buttons(qualityBar,data.qualities.map(q=>[q.id,q.name||q.label]),quality,id=>{quality=id;build();},'Glyph rarity');form.replaceChildren();
  const q=data.qualities.find(q=>q.id===quality),tier=number('Glyph tier',g.tier??1,data.tierMin,g.legacyTier?g.tier:data.tierMax);tier.input.step='1';form.append(tier.wrap);
  const powerOptions=q.powers.map(p=>[p.id,p.name]),p1=select('First power',powerOptions,g.quality===quality?g.powers?.[0]?.id:q.powers[0].id),p2=select('Second power (optional)',[['','None'],...powerOptions],g.quality===quality?(g.powers?.[1]?.id??''):'');const effect=node('div',undefined,'reign-hint');const effects=()=>{effect.replaceChildren();for(const input of [p1.input,p2.input]){const p=q.powers.find(p=>String(p.id)===input.value);if(p)effect.append(node('h4',p.name),node('p',p.description));}};p1.input.onchange=effects;p2.input.onchange=effects;form.append(p1.wrap,p2.wrap,effect);effects();
  const lines=node('div'),rows=[];form.append(node('h4','Stat rolls'),node('p',data.limitsHelp),lines);
  const addLine=initial=>{if(rows.length>=data.maxStatLines)return;const row=node('div',undefined,'reign-stat-line'),type=select('Stat',data.stats.map(s=>[s.id,s.label]),initial?.id??data.stats[0].id),amount=number('Amount',initial?.value??'0.1',0.1,100),hint=node('small');amount.input.step='any';const entry={type:type.input,amount:amount.input,row};rows.push(entry);
   const limits=()=>{const stat=data.stats.find(s=>String(s.id)===type.input.value),cap=stat.maxByTier[String(Number(tier.input.value))];amount.input.max=cap??'';hint.textContent=stat.description+' '+stat.unit+' · '+(cap?'Tier ceiling: '+cap:'Legacy tier; unchanged original rolls only.');};type.input.onchange=limits;entry.limits=limits;limits();row.append(type.wrap,amount.wrap,hint,button('Remove stat',()=>{rows.splice(rows.indexOf(entry),1);row.remove();}));lines.append(row);};
  for(const stat of g.stats||[])addLine(stat);if(g.empty)addLine();tier.input.oninput=()=>rows.forEach(r=>r.limits());form.append(button('Add stat line',()=>addLine()));
  let unlock;if(g.empty&&data.mastery<1){const label=node('label',undefined,'reign-checkbox');unlock=node('input');unlock.type='checkbox';label.append(unlock,document.createTextNode(' Also unlock Glyph Crafting Power rank 1'));form.append(label);}
  form.append(button(g.empty?'Review creating glyph':'Review glyph changes',()=>act({action:g.empty?'create':'edit',hero:hero.id,slot:g.slot,quality,tier:Number(tier.input.value),powers:[p1.input.value,p2.input.value].filter(v=>v!=='').map(Number),stats:rows.map(r=>({id:Number(r.type.value),value:r.amount.value})),unlockMastery:!!unlock?.checked}),'primary'));
 };build();
}
