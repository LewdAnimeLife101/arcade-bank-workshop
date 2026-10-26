// Accessible button and card choices shared by every map, including modal forms.
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
export function choicePage(options,query='',page=0,size=12){
 const q=query.trim().toLocaleLowerCase(),matches=options.filter(o=>`${o.label} ${o.description||''}`.toLocaleLowerCase().includes(q));
 const pages=Math.max(1,Math.ceil(matches.length/size)),index=Math.max(0,Math.min(page,pages-1));
 return {items:matches.slice(index*size,(index+1)*size),page:index,pages,total:matches.length};
}
export function choiceControl(label,options,value,{onChange,disabled=false}={}){
 const root=node('div',undefined,'choice-control'),trigger=node('button',undefined,'choice-trigger');trigger.type='button';
 let selected=String(value),locked=disabled;root.append(trigger);
 const draw=()=>{const item=options.find(o=>String(o.value)===selected);trigger.replaceChildren(node('span',item?.label??'Existing: '+selected),node('small',locked?'Read only':'Choose →'));trigger.disabled=locked;trigger.setAttribute('aria-label',label+': '+(item?.label??selected));trigger.setAttribute('aria-haspopup','dialog');};
 Object.defineProperty(root,'value',{get:()=>selected,set:v=>{selected=String(v);draw();}});
 Object.defineProperty(root,'disabled',{get:()=>locked,set:v=>{locked=!!v;draw();}});
 trigger.onclick=()=>openChoices(label,options,selected,value=>{root.value=value;root.dispatchEvent(new Event('change',{bubbles:true}));onChange?.(value);},trigger);
 draw();return root;
}
export function openChoices(title,options,value,choose,returnFocus){
 const returnRootId=returnFocus?.parentElement?.id;
 const dialog=node('dialog',undefined,'choice-dialog');dialog.setAttribute('aria-label','Choose '+title);
 const heading=node('h2',title),close=node('button','Cancel','choice-cancel');close.type='button';close.onclick=()=>dialog.close();
 const search=node('input');search.type='search';search.placeholder='Search names or descriptions…';search.setAttribute('aria-label','Search '+title+' choices');
 const summary=node('p',undefined,'choice-summary'),grid=node('div',undefined,'choice-grid'),pager=node('div',undefined,'choice-pager');let page=0;
 const draw=()=>{const result=choicePage(options,search.value,page);page=result.page;summary.textContent=`${result.total} choices · page ${page+1} of ${result.pages}`;grid.replaceChildren();pager.replaceChildren();
  for(const item of result.items){const card=node('button',undefined,'choice-card');card.type='button';card.setAttribute('aria-pressed',String(String(item.value)===String(value)));card.append(node('strong',item.label));if(item.description)card.append(node('span',item.description));card.onclick=()=>{dialog.close();choose(String(item.value));};grid.append(card);}
  if(!result.items.length)grid.append(node('p','No matching choices. Try a different name.'));
  if(result.pages>1){for(const [text,delta,disabled] of [['← Previous',-1,page===0],['Next →',1,page===result.pages-1]]){const b=node('button',text);b.type='button';b.disabled=disabled;b.onclick=()=>{page+=delta;draw();};pager.append(b);}}
 };
 search.oninput=()=>{page=0;draw();};dialog.append(heading,close,search,summary,grid,pager);dialog.addEventListener('close',()=>{dialog.remove();const target=returnFocus?.isConnected?returnFocus:returnRootId?document.getElementById(returnRootId)?.querySelector('button'):null;target?.focus();},{once:true});document.body.append(dialog);draw();dialog.showModal();search.focus();
}
