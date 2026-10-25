import {loadPyodide} from './runtime/pyodide.mjs';
let py;
const ready=(async()=>{py=await loadPyodide({indexURL:new URL('runtime/',self.location).href});const archive=await (await fetch('engine.zip')).arrayBuffer();py.unpackArchive(archive,'zip',{extractDir:'/app'});py.runPython("import sys; sys.path.insert(0, '/app')");const bridge=await (await fetch('bridge.py')).text();py.runPython(bridge);postMessage({ready:true});})();
self.onmessage=async({data})=>{try{await ready;const fn=py.globals.get('handle');const result=JSON.parse(fn(JSON.stringify(data.request)));fn.destroy();postMessage({id:data.id,...result});}catch(e){postMessage({id:data.id,ok:false,error:String(e.message||e)});}};
ready.catch(e=>postMessage({fatal:String(e.message||e)}));
