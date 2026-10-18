import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { writeFileSync } from 'node:fs';
const root=import.meta.dirname;
const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
try {
 const page=await browser.newPage({viewport:{width:1000,height:1200},deviceScaleFactor:1});
 await page.goto(pathToFileURL(resolve(root,'Overhead-LLC-Business-Plan.html')).href,{waitUntil:'networkidle'});
 await page.evaluate(()=>document.fonts.ready);
 const audit=await page.evaluate(()=>[...document.querySelectorAll('.page')].map((p,i)=>{
   const content=p.querySelector('.page-content').getBoundingClientRect(), footer=p.querySelector('.footer').getBoundingClientRect();
   const bounds=p.getBoundingClientRect();
   return {page:i+1,title:p.querySelector('h1').textContent,contentBottom:Math.round(content.bottom-bounds.top),footerTop:Math.round(footer.top-bounds.top),overflow:content.bottom>footer.top-12,wide:[...p.querySelectorAll('table,img,aside')].some(el=>el.getBoundingClientRect().right>bounds.right-25)};
 }));
 writeFileSync(resolve(root,'layout-audit.json'),JSON.stringify(audit,null,2));
 console.log(JSON.stringify(audit.filter(p=>p.overflow||p.wide),null,2));
 const images=await page.locator('img').evaluateAll(images=>images.every(i=>i.complete&&i.naturalWidth>0));
 if(!images)throw new Error('Unloaded image');
 await page.pdf({path:resolve(root,'Overhead-LLC-Business-Plan.pdf'),preferCSSPageSize:true,printBackground:true,tagged:true,outline:true});
 for(const n of [1,2,6,8,10,18,20,21,27])await page.locator('#page-'+n).screenshot({path:resolve(root,'assets','page-'+n+'.png')});
 console.log('PDF rendered. Pages:',audit.length,'Overflow:',audit.filter(x=>x.overflow||x.wide).length);
} finally {await browser.close();}
