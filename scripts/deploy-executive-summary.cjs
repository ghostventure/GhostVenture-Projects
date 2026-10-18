// Publish the built About route and plan, preserving the live Hosting inventory.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const cli=process.env.OVERHEAD_FIREBASE_TOOLS;
if(!cli)throw new Error('OVERHEAD_FIREBASE_TOOLS is required.');
const auth=require(path.join(cli,'lib/auth.js'));
const {requireAuth}=require(path.join(cli,'lib/requireAuth.js'));
const {Client}=require(path.join(cli,'lib/apiv2.js'));
const root=path.resolve(__dirname,'..'),out=path.join(root,'website-next/out'),report=path.join(root,'release-executive-summary');
fs.mkdirSync(report,{recursive:true});
const site='overhead-office';
const api=new Client({urlPrefix:'https://firebasehosting.googleapis.com',apiVersion:'v1beta1',auth:true});
const latest=async()=>(await api.get(`/sites/${site}/releases`,{queryParams:{pageSize:1}})).body.releases[0];
async function main(){
 await requireAuth({project:site,...auth.getGlobalDefaultAccount(),nonInteractive:true});
 const live=await latest(),source=live.version.name,version=(await api.get('/'+source)).body;
 const files={};let pageToken;
 do{const result=(await api.get('/'+source+'/files',{queryParams:{pageSize:1000,...(pageToken?{pageToken}:{})}})).body;for(const f of result.files||[])files[f.path]=f.hash;pageToken=result.nextPageToken;}while(pageToken);
 if(!files['/index.html']||!files['/about/index.html']||Object.keys(files).length<30)throw new Error('Incomplete live inventory');
 const original={...files},contents=new Map(),changed=[];
 const targets=['/sitemap.xml','/downloads/Overhead-LLC-Executive-Summary.pdf'];
 // Include regenerated route documents so shared footer links stay consistent.
 const routes=['','about','account','careers','contact','cylinder','dashboard','executive-summary','faq','feedback','investors','ios','legal','sign-in','support'];
 for(const route of routes)for(const ext of ['html','txt']){const url='/'+(route?route+'/':'')+'index.'+ext;if(fs.existsSync(path.join(out,url.slice(1))))targets.push(url);}
 function collect(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())collect(full);else targets.push('/'+path.relative(out,full).split(path.sep).join('/'));}}
 collect(path.join(out,'_next/static'));
 for(const url of targets){
  const bytes=fs.readFileSync(path.join(out,url.slice(1))),compressed=zlib.gzipSync(bytes,{level:9}),hash=crypto.createHash('sha256').update(compressed).digest('hex');
  if(files[url]===hash)continue;
  if(url.startsWith('/_next/static/')&&files[url]){
   const response=await fetch('https://overhead-office.web.app'+url);if(!response.ok)throw new Error('Unable to verify immutable asset '+url);
   if(!bytes.equals(Buffer.from(await response.arrayBuffer())))throw new Error('Immutable asset content collision: '+url);
   continue;
  }
  files[url]=hash;contents.set(hash,compressed);changed.push(url);
 }
 for(const [url,hash] of Object.entries(original))if(!targets.includes(url)&&files[url]!==hash)throw new Error('Unrelated file changed');
 fs.writeFileSync(path.join(report,'deployment-plan.json'),JSON.stringify({source,originalFiles:Object.keys(original).length,finalFiles:Object.keys(files).length,changed,configPreserved:true},null,2));
 console.log(JSON.stringify({source,changed:changed.length,preserved:Object.keys(original).length,configPreserved:true}));
 if(!process.argv.includes('--publish'))return;
 const created=(await api.post(`/sites/${site}/versions`,{config:version.config||{}})).body;
 fs.writeFileSync(path.join(report,'deployment-state.json'),JSON.stringify({source,target:created.name},null,2));
 const populated=(await api.post('/'+created.name+':populateFiles',{files})).body;
 const upload=new Client({urlPrefix:populated.uploadUrl,auth:true});
 for(const hash of populated.uploadRequiredHashes||[]){
  if(!contents.has(hash))throw new Error('Required unchanged file unavailable; not releasing');
  const response=await upload.request({method:'POST',path:'/'+hash,body:require('node:stream').Readable.from(contents.get(hash)),responseType:'stream',resolveOnHTTPError:true,signal:AbortSignal.timeout(120000)});
  if(response.status>=400)throw new Error('Upload failed: '+response.status);response.body.resume();
 }
 await api.patch('/'+created.name,{status:'FINALIZED'},{queryParams:{updateMask:'status'}});
 if((await latest()).version.name!==source)throw new Error('Live version changed; re-run before publishing');
 const released=(await api.post(`/sites/${site}/releases`,{message:'Feature Overhead LLC executive summary and downloadable PDF'},{queryParams:{versionName:created.name}})).body;
 fs.writeFileSync(path.join(report,'hosting-release.json'),JSON.stringify(released,null,2));
 console.log('Published '+released.name);
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
