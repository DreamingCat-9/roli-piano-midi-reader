import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const files={'/favicon.svg':'favicon.svg','/':'index.html','/style.css':'style.css'};
for(const name of ['acoustic_grand_piano','electric_piano_1','drawbar_organ','music_box','xylophone'])files[`/samples/${name}.json`]=`samples/${name}.json`;
// Browser modules: any plainly named .js file directly in src/, looked up per request so new modules need no restart.
const MODULE=/^\/src\/[A-Za-z0-9_-]+\.js$/;
const fileFor=pathname=>files[pathname]??(MODULE.test(pathname)?pathname.slice(1):null);
const port=Number(process.env.PORT||8765);
const host=process.env.PORT?'0.0.0.0':'127.0.0.1';
http.createServer(async(req,res)=>{const file=fileFor(new URL(req.url,'http://localhost').pathname);if(!file){res.writeHead(404).end();return;}try{const body=await readFile(fileURLToPath(new URL(file,import.meta.url)));res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':file.endsWith('.svg')?'image/svg+xml':'text/html');res.setHeader('Cache-Control','no-cache');res.setHeader('X-Content-Type-Options','nosniff');res.end(body);}catch(e){res.writeHead(e.code==='ENOENT'?404:500).end();}}).listen(port,host,()=>console.log(`ROLI Practice listening on ${host}:${port}`));






