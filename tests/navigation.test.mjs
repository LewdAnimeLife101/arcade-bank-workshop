import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {choicePage} from '../dist/choices.mjs';
import {navigationModel,visibleFields,categoryName} from '../dist/navigation.mjs';
test('choice cards search labels and descriptions and clamp page bounds',()=>{
 const rows=Array.from({length:100},(_,i)=>({value:i,label:'Level '+i,description:i===50?'Exact target XP':'XP threshold'}));
 assert.equal(choicePage(rows,'',99).page,8);
 assert.equal(choicePage(rows,'',8).items.length,4);
 assert.deepEqual(choicePage(rows,'exact target').items.map(x=>x.value),[50]);
 assert.equal(choicePage(rows,'unavailable',50).pages,1);
 assert.equal(choicePage(rows,'unavailable',50).page,0);
});
test('navigation keeps valid section choices and each session retains its own group',()=>{
 const fields=[{category:'Heroes',group:'Hero · Marine',label:'Level'},{category:'Heroes',group:'Hero · Medic',label:'Level'},{category:'Equipment & glyphs',group:'Soul jewel 1',label:'First unique effect'}];
 const a={category:'Heroes',group:'Hero · Medic'},b={category:'Equipment & glyphs',group:'Soul jewel 1'};
 navigationModel(fields,a);navigationModel(fields,b);
 assert.equal(a.group,'Hero · Medic');assert.equal(b.group,'Soul jewel 1');
 assert.equal(visibleFields(fields,a).length,1);
 assert.equal(visibleFields(fields,a,'unique effect')[0].group,'Soul jewel 1');
 a.category='Equipment & glyphs';navigationModel(fields,a);assert.equal(a.group,'Soul jewel 1');
});
test('profile category labels use the existing game concepts',()=>{
 assert.equal(categoryName('liberty','Equipment & glyphs'),'Soul jewels');
 assert.equal(categoryName('unity','Skills & perks'),'Talents');
 assert.equal(categoryName('mineralz_evolution_258','Skills & perks'),'Skills & prestige perks');
});
test('owned editor UI contains no native selects or datalists',()=>{
 for(const file of ['index.html','app.js','reign.mjs','navigation.mjs','choices.mjs']){
  const text=fs.readFileSync(new URL('../dist/'+file,import.meta.url),'utf8');
  assert.doesNotMatch(text,/<(?:select|datalist)\b|(?:el|node|createElement)\(['"](?:select|option|datalist)['"]\)/i,file);
 }
});
