const {choicePage}=await import('./choices.mjs'+new URL(import.meta.url).search);
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const names={unity:{'Heroes':'Class evolutions','Skills & perks':'Talents'},liberty:{'Equipment & glyphs':'Soul jewels','Heroes':'Heroes'},mineralz:{'Appearance':'Probe skins'},mineralz_evolution_258:{'Heroes':'Workers','Skills & perks':'Skills & prestige perks'},fallen:{'Skills & perks':'Skill tiers'},probes_zealot_2118:{'Skills & perks':'Rewards'}};
const descriptions={'Progress & resources':'Levels, currencies and permanent progression.','Heroes':'Character progression and supported unlocks.','Skills & perks':'Skills, talents and permanent perks.','Equipment & glyphs':'Manage saved equipment and its effects.','Achievements & challenges':'Achievements, trophies and challenge unlocks.','Records & history':'Wins, highest rounds and saved lifetime records.','Appearance':'Available skins, colours and cosmetic choices.','Settings':'Your saved in-game preferences.','Advanced & preserved':'Version-specific and preserved records with their known limitations.'};
export function categoryName(profile,category){return names[profile]?.[category]||category;}
export function navigationModel(fields,ui){const categories=[...new Set(fields.map(f=>f.category||'Progress & resources'))];if(!categories.includes(ui.category))ui.category=categories[0];const scoped=fields.filter(f=>(f.category||'Progress & resources')===ui.category);const groups=[...new Set(scoped.map(f=>f.group))];if(!groups.includes(ui.group))ui.group=groups[0];return {categories,groups,scoped};}
export function visibleFields(fields,ui,query=''){const q=query.toLowerCase().trim();return fields.filter(f=>q?`${f.label} ${f.group} ${f.description}`.toLowerCase().includes(q):f.group===ui.group&&(f.category||'Progress & resources')===ui.category);}
export function renderProfileNavigation({root,current,profile,change}){
 const ui=current.ui,fields=current.data.fields;ui.overview??=true;const model=navigationModel(fields,ui);root.replaceChildren();
 const bar=node('div',undefined,'reign-buttons');bar.setAttribute('role','group');bar.setAttribute('aria-label','Editor categories');
 const go=category=>{ui.overview=category===null;if(category){ui.category=category;ui.group='';}ui.groupQuery='';ui.groupPage=0;ui.query='';ui.page=0;change();};
 const add=(label,active,click)=>{const b=node('button',label);b.type='button';b.setAttribute('aria-pressed',String(active));b.onclick=click;bar.append(b);};
 add('Overview',ui.overview,()=>go(null));for(const c of model.categories)add(categoryName(profile.id,c),!ui.overview&&ui.category===c,()=>go(c));root.append(bar);
 if(ui.overview){const panel=node('div',undefined,'reign-panel');panel.append(node('span',profile.name.toUpperCase(),'eyebrow'),node('h3','Choose what you want to edit.'),node('p',profile.cardDescription||profile.description));const grid=node('div',undefined,'reign-overview');
  for(const c of model.categories){const card=node('button',undefined,'reign-overview-card');card.type='button';card.append(node('strong',categoryName(profile.id,c)),node('span',descriptions[c]||'Saved settings and progression for this map.'));card.onclick=()=>go(c);grid.append(card);}
  const unlock=node('button',undefined,'reign-overview-card');unlock.append(node('strong','Unlock All'),node('span','Supported presets and map-specific actions. Review changes before saving.'));unlock.onclick=()=>{ui.view='unlocks';change();};grid.append(unlock);panel.append(grid);root.append(panel);return false;
 }
 const groupArea=node('div',undefined,'profile-groups');groupArea.append(node('h3',categoryName(profile.id,ui.category)));root.append(groupArea);
 if(model.groups.length>1){const search=node('input');search.type='search';search.value=ui.groupQuery||'';search.placeholder='Find a hero or slot…';search.setAttribute('aria-label','Find a category group');if(model.groups.length>16)groupArea.append(search);
  const buttons=node('div',undefined,'reign-buttons'),pager=node('div',undefined,'choice-pager');buttons.setAttribute('role','group');buttons.setAttribute('aria-label','Category groups');groupArea.append(buttons,pager);
  const draw=()=>{buttons.replaceChildren();pager.replaceChildren();const result=choicePage(model.groups.map(g=>({value:g,label:g.replace(/^Hero · /,'')})),ui.groupQuery||'',ui.groupPage||0,20);ui.groupPage=result.page;
   for(const g of result.items){const b=node('button',g.label);b.type='button';b.setAttribute('aria-pressed',String(ui.group===g.value));b.onclick=()=>{ui.group=g.value;ui.query='';ui.page=0;change();};buttons.append(b);}
   if(!result.total)buttons.append(node('p','No matching heroes or slots.'));
   if(result.pages>1){const prev=node('button','← Previous groups'),next=node('button','Next groups →');prev.disabled=result.page===0;next.disabled=result.page===result.pages-1;prev.onclick=()=>{ui.groupPage--;draw();};next.onclick=()=>{ui.groupPage++;draw();};pager.append(prev,node('span',`${result.page+1} / ${result.pages}`),next);}
  };search.oninput=()=>{ui.groupQuery=search.value;ui.groupPage=0;draw();};draw();
 }
 return true;
}
