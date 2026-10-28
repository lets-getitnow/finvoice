import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {parseCSV} from '../dist/lookup.mjs';
import {AddressConversation} from '../dist/resolver.mjs';
import {readFile,readdir,mkdir,writeFile,copyFile,cp} from 'node:fs/promises';
const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const assets={};
for(const name of await readdir('dist')) {
 const extension=name.slice(name.lastIndexOf('.'));
 if(types[extension]) assets['/'+name]={type:types[extension],body:await readFile('dist/'+name,'utf8')};
}

const csv=await readFile('private-data/properties.csv','utf8');
const expected=JSON.parse(await readFile('.openai/property-source.json','utf8'));
if(createHash('sha256').update(csv).digest('hex')!==expected.sha256)throw new Error('Server CSV does not match the approved source fingerprint.');
const dataset=parseCSV(csv);
const grouped=new Map();
for(const r of dataset.records){const house=r.streetKey.split(' ')[0];if(!grouped.has(house))grouped.set(house,[]);grouped.get(house).push([r.id,r.street,r.city,r.state,r.postal_code,r.values]);}
const groups=Object.fromEntries([...grouped].map(([house,records])=>[house,gzipSync(JSON.stringify(records)).toString('base64')]));
const streetGroups=Object.create(null);const parser=new AddressConversation([]);
for(const r of dataset.records){const name=parser.parse(r.street,'source',[r.cityKey].filter(Boolean)).name;if(!name)continue;(streetGroups[name]??=[]).push([r.streetKey.split(' ')[0],r.id]);}
const serverData={streetGroups,stats:dataset.stats,sourceHash:createHash('sha256').update(csv).digest('hex'),groups};
console.log(JSON.stringify({serverDatasetRows:dataset.stats.sourceRows,searchable:dataset.stats.searchable,houseGroups:grouped.size,largestHouseGroup:Math.max(...[...grouped.values()].map(x=>x.length))}));
const source=(await readFile('dist/lookup.mjs','utf8'))+'\n'+(await readFile('dist/resolver.mjs','utf8')).replace(/^import .*;$/m,'')+'\n'+(await readFile('sites/server-data.mjs','utf8')).replace(/^import .*;$/gm,'')+'\n'+(await readFile('sites/address-resolver.mjs','utf8')).replace(/^import .*;$/gm,'')+'\n'+(await readFile('sites/address-tools.mjs','utf8')).replace(/^import .*;$/gm,'')+'\n'+(await readFile('sites/properties.mjs','utf8')).replace(/^import .*;$/gm,'')+'\n'+(await readFile('sites/session.mjs','utf8'));
await mkdir('sites-artifact/dist/server',{recursive:true}); await mkdir('sites-artifact/.openai',{recursive:true});
await writeFile('sites-artifact/dist/server/index.js',source+'\nconst SERVER_DATA='+JSON.stringify(serverData)+';\nconst assets='+JSON.stringify(assets)+';\nexport default {async fetch(request,env){const path=new URL(request.url).pathname;if(path==="/api/address/tools")return addressTools(request,env);if(path==="/api/voice/session")return session(request,env);if(path.startsWith("/api/"))return properties(request,env);if(path==="/healthz")return new Response("ok");if(!["GET","HEAD"].includes(request.method))return new Response("Method not allowed",{status:405});const asset=assets[path==="/"?"/index.html":path];return asset?new Response(request.method==="HEAD"?null:asset.body,{headers:{"Content-Type":asset.type,"X-Content-Type-Options":"nosniff"}}):new Response("Not found",{status:404});}};');
await copyFile('.openai/hosting.json','sites-artifact/.openai/hosting.json');

await cp('drizzle','sites-artifact/drizzle',{recursive:true});
