import test from 'node:test';
import assert from 'node:assert/strict';
import {filteredFields,inventoryChanges,categoryFields,groupChoices} from '../dist/reign.mjs';
test('hero navigation preserves shared ownership controls and isolates hero fields',()=>{
 const fields=[{id:'owned',category:'Charms',group:'Owned charms'},{id:'first',category:'Charms',hero:1,group:'Footman loadout'},{id:'second',category:'Charms',hero:2,group:'Rifleman loadout'},{id:'level',category:'Heroes',hero:1}];
 assert.deepEqual(filteredFields(fields,{reignCategory:'Charms',reignHero:1}).map(f=>f.id),['owned','first']);
 assert.deepEqual(filteredFields(fields,{reignCategory:'Charms',reignHero:2,reignGroup:'Rifleman loadout'}).map(f=>f.id),['second']);
});
test('search spans categories without changing the active hero',()=>{
 const fields=[{id:'one',label:'Footman mastery',category:'Heroes',hero:1},{id:'two',label:'Glyph Mastery',category:'Perks'}];
 assert.deepEqual(filteredFields(fields,{reignCategory:'Heroes',reignHero:1},'glyph mastery').map(f=>f.id),['two']);
});

test('equipment-only changes appear in the review without scalar edits',()=>{
 const old={equipment:{carriers:[{id:'hero',label:'Footman',containers:[{index:0,label:'Active equipment',slots:[{slot:0,label:'Slot 1',item:null}]}]}]},glyphs:{heroes:[]}};
 const next=structuredClone(old);next.equipment.carriers[0].containers[0].slots[0].item={id:'ring',name:'Ring of Regeneration'};
 assert.deepEqual(inventoryChanges(old,next),['Footman / Active equipment / Slot 1: Empty → Ring of Regeneration']);
});

test('records separate global and hero scopes including purchase histories',()=>{
 const fields=[{id:'global',category:'Records',group:'Global records'},...Array.from({length:11},(_,i)=>[{id:`record${i+1}`,category:'Records',hero:i+1,group:`Hero ${i+1} · Records`},{id:`purchase${i+1}`,category:'Records',hero:i+1,group:`Hero ${i+1} · Purchase history`}]).flat()];
 assert.deepEqual(categoryFields(fields,{reignCategory:'Records'}).map(f=>f.id),['global']);
 const ui={reignCategory:'Records',reignRecordsScope:'7'};
 assert.deepEqual(filteredFields(fields,ui).map(f=>f.id),['record7','purchase7']);
 ui.reignGroup='Hero 7 · Purchase history';
 assert.deepEqual(filteredFields(fields,ui).map(f=>f.id),['purchase7']);
});
test('group buttons never strip distinguishing hero names',()=>{
 assert.deepEqual(groupChoices(['Footman · Records','Shade · Records'],'Records').map(x=>x[1]),['Footman · Records','Shade · Records']);
 assert.deepEqual(groupChoices(['Shade · Records','Shade · Purchase history'],'Records').map(x=>x[1]),['Gameplay records','Purchase history']);
});
