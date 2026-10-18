import {chromium} from 'playwright';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..'),out=resolve(root,'website-next/out'),review=resolve(root,'release-business-plan');
await mkdir(review,{recursive:true});
const live=process.argv.includes('--live');let server;
if(!live){server=createServer(async(req,res)=>{try{
 let file=resolve(out,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
 if(file!==out&&!file.startsWith(out+sep))throw Error('Invalid path');
 if((await stat(file)).isDirectory())file=resolve(file,'index.html');
 const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.txt':'text/plain','.pdf':'application/pdf','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
 res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(await readFile(file));
 }catch{res.statusCode=404;res.end('Not found');}});await new Promise(r=>server.listen(0,'127.0.0.1',r));}
const base=live?'https://overhead-office.web.app':'http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1280,height:960}});page.on('pageerror',e=>errors.push(e.message));
 const response=await page.goto(base+'/about/',{waitUntil:'networkidle'});assert.equal(response.status(),200);
 const section=page.locator('#business-plan');await section.scrollIntoViewIfNeeded();
 await section.getByRole('heading',{name:'A closer look at Overhead LLC.'}).waitFor();
 assert.ok(await section.locator('img').evaluate(i=>i.complete&&i.naturalWidth>0));
 assert.equal(await section.getByRole('link',{name:'Download PDF',exact:true}).getAttribute('download'),'Overhead-LLC-Business-Plan.pdf');
 await section.screenshot({path:resolve(review,(live?'live':'local')+'-desktop.png')});
 for(const width of [390,320]){await page.setViewportSize({width,height:844});await section.scrollIntoViewIfNeeded();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Horizontal overflow at '+width);}
 await section.screenshot({path:resolve(review,(live?'live':'local')+'-mobile.png')});
 const pdf=await fetch(base+'/downloads/Overhead-LLC-Business-Plan.pdf');assert.equal(pdf.status,200);assert.match(pdf.headers.get('content-type'),/application\/pdf/);
 const bytes=Buffer.from(await pdf.arrayBuffer()),hash=b=>createHash('sha256').update(b).digest('hex');
 assert.equal(hash(bytes),hash(await readFile(resolve(root,'business-plan-2026-09-13/Overhead-LLC-Business-Plan.pdf'))));
 await page.setViewportSize({width:1280,height:960});await page.goto(base+'/',{waitUntil:'networkidle'});
 assert.equal((await page.goto(base+'/about/',{waitUntil:'networkidle'})).status(),200);await page.locator('#business-plan').waitFor();
 assert.equal(await page.locator('footer').getByRole('link',{name:'User Guide',exact:true}).getAttribute('href'),'/user-guide/');
 if(live)for(const route of ['/sign-in/','/user-guide/','/downloads/OverHead-Desktop-0.3.12-win-x64.zip'])assert.equal((await fetch(base+route,{method:'HEAD'})).status,200);
 assert.deepEqual(errors,[]);
 const report={mode:live?'live':'local',verifiedAt:new Date().toISOString(),aboutPage:true,homeNavigation:true,mobileWidths:[390,320],pdfBytes:bytes.length,pdfSha256:hash(bytes),consoleErrors:errors};
 await writeFile(resolve(review,(live?'live':'local')+'-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();if(server)await new Promise(r=>server.close(r));}
