import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../dist/visits.mjs',import.meta.url),'utf8');
function fixture(){
 const values=new Map(),calls=[];let count=0,queue=Promise.resolve();
 const localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
 const navigator={locks:{request:(_,fn)=>{const next=queue.then(fn);queue=next.catch(()=>{});return next;}}};
 const fetch=async(url,options)=>{calls.push({url,options});if(url.includes('/hit/'))count++;return {ok:true,json:async()=>({value:count})};};
 return {values,calls,localStorage,navigator,fetch};
}
async function page(f,overrides={}){
 const output={textContent:''};
 await vm.runInNewContext(source,{document:{getElementById:()=>output},location:{hostname:'lewdanimelife101.github.io',pathname:'/arcade-bank-workshop/'},localStorage:f.localStorage,navigator:f.navigator,fetch:f.fetch,AbortSignal,...overrides});
 return output.textContent;
}
test('return visits and refreshes increment a browser only once',async()=>{
 const f=fixture();assert.equal(await page(f),'Unique visitors: 1');assert.equal(await page(f),'Unique visitors: 1');assert.equal(await page(f),'Unique visitors: 1');
 assert.equal(f.calls.filter(c=>c.url.includes('/hit/')).length,1);
 assert.equal(f.values.size,1);assert.equal([...f.values.values()][0],'counted');
 assert.ok(f.calls.every(c=>c.options.credentials==='omit'&&c.options.referrerPolicy==='no-referrer'));
});
test('simultaneous tabs share a single first-visit count',async()=>{
 const f=fixture();await Promise.all([page(f),page(f),page(f)]);assert.equal(f.calls.filter(c=>c.url.includes('/hit/')).length,1);
});
test('localhost reads only and unrelated preview hosts make no request',async()=>{
 const f=fixture();await page(f,{location:{hostname:'127.0.0.1',pathname:'/'}});assert.equal(f.values.size,0);assert.ok(f.calls[0].url.includes('/get/'));
 await page(f,{location:{hostname:'preview.example',pathname:'/arcade-bank-workshop/'}});assert.equal(f.calls.length,1);
});
test('blocked storage never increments on repeated visits',async()=>{
 const f=fixture(),blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
 await page(f,{localStorage:blocked});await page(f,{localStorage:blocked});assert.ok(f.calls.every(c=>c.url.includes('/get/')));
});
test('uncertain failed hit is not retried on refresh',async()=>{
 const f=fixture();assert.equal(await page(f,{fetch:async()=>{throw Error('network interrupted');}}),'Visitor count unavailable');
 await page(f);assert.ok(f.calls[0].url.includes('/get/'));
});
test('clearing storage counts a new browser visit',async()=>{
 const f=fixture();await page(f);f.values.clear();assert.equal(await page(f),'Unique visitors: 2');
});
