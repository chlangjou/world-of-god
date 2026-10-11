'use strict';
// Dependency-free web server: serving JSON over HTTP avoids file:// fetch restrictions.
const http=require('node:http'), fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),port=Number(process.env.PORT||8000);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
'.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
http.createServer((req,res)=>{
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}
 catch {res.writeHead(400).end('Invalid path');return;}
 const full=path.resolve(root,'.'+pathname);
 if(full!==root&&!full.startsWith(root+path.sep)){res.writeHead(403).end('Forbidden');return;}
 let file=full;try{if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');}
 catch {res.writeHead(404).end('Not found');return;}
 fs.readFile(file,(err,data)=>{
   if(err){res.writeHead(err.code==='ENOENT'?404:500).end('Cannot read file');return;}
   res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
   res.end(data);
 });
}).listen(port,()=>console.log('PoC v2: http://localhost:'+port+'/'));
