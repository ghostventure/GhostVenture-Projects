/** Read-only browser checks. Run against local Vite for member fixtures; live checks never sign in. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
const base=process.env.FOXHUB_CHECK_URL || 'http://127.0.0.1:4174';
const browser=await chromium.launch();
try {
 const page=await browser.newPage(); const errors=[];page.on('pageerror',error=>errors.push(error.message));
 for(const width of [390,1440]) {
  await page.setViewportSize({width,height:900});await page.goto(base,{waitUntil:'networkidle'});
  await page.getByRole('heading',{name:'A place for your people.'}).waitFor();
  assert.equal(await page.locator('.footer-group').count(),8);
  for(const group of await page.locator('.footer-group').all()){await group.locator('summary').click();assert.ok(await group.locator('a').count());await group.locator('summary').click();}
  assert.equal(await page.locator('.footer-group a').count(),49);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const body=await page.locator('body').innerText();for(const technical of ['users/{uid}','EstateHat','Android app GUI','Tamper-resistant posture'])assert.ok(!body.includes(technical));
  await page.getByRole('button',{name:'Join FoxHub',exact:true}).click();await page.getByRole('heading',{name:'Sign up',exact:true}).waitFor();
  await page.goto(base+'/signin',{waitUntil:'networkidle'});
  const submit=page.locator('button[type="submit"]');assert.ok((await submit.boundingBox()).y+(await submit.boundingBox()).height<900);
  await page.getByRole('button',{name:'Forgot password?'}).click();await page.getByRole('heading',{name:/password/i}).first().waitFor();
  console.log(`PASS public, footer, sign-up entry, sign-in and recovery at ${width}px`);
 }
 if(new URL(base).hostname==='127.0.0.1') {
  const source=await readFile('src/FoxHubShell.jsx','utf8');
  const names=source.match(/function FoxHubShell\(\{([\s\S]*?)\}\)/)[1].split(',').map(part=>part.split('=')[0].trim()).filter(Boolean);
  await page.goto(base,{waitUntil:'networkidle'});
  // Render the real shell with synthetic member data, isolated from Firebase and write operations.
  await page.evaluate(async names=>{
   const {default:React}=await import('/node_modules/.vite/deps/react.js');const {default:{createRoot}}=await import('/node_modules/.vite/deps/react-dom_client.js');
   const {default:Shell}=await import('/src/FoxHubShell.jsx');const {createSeedState}=await import('/src/repository-local.js');const {views,miniApps}=await import('/src/data.js');
   const state=createSeedState();state.authenticated=true;state.backendMode='local';state.profile={...state.profile,role:'member',email:'preview@example.invalid',name:'Preview Member',handle:'preview',accessState:'active'};
   document.getElementById('root').style.display='none';const host=document.createElement('div');host.id='member-fixture';document.body.append(host);
   function Fixture(){const [tab,setTab]=React.useState('hub');window.selectFixtureTab=setTab;const props=Object.fromEntries(names.map(n=>[n,()=>{}]));return React.createElement(Shell,{...props,state,theme:'green-composite',activeTab:tab,setActiveTab:setTab,currentView:views[tab],selectedThread:state.threads[0],activeCircle:state.circles[0],activeMiniApp:miniApps[0],busy:false,listings:state.listings,savedSearches:[],listingAlerts:[],listingCategories:[],listingTypes:[],listingTags:[],tutorialAssistant:null});}
   createRoot(host).render(React.createElement(Fixture));
  },names);
  await page.getByRole('heading',{name:'Welcome back, Preview Member.'}).waitFor();
  for(const width of [390,1440]) {
   await page.setViewportSize({width,height:1000});await page.evaluate(()=>window.selectFixtureTab('hub'));
   if(width===390){await page.getByRole('button',{name:'More',exact:true}).click();await page.getByRole('dialog',{name:'Quick navigation'}).waitFor();await page.keyboard.press('Escape');}
   await page.getByRole('button',{name:'Open messages',exact:true}).click();await page.waitForTimeout(200);
   const tabs=['hub','chat','circles','market','wallet','discover','growth','experience'];
   const tabsWithoutGenericFeed=new Set(['hub','chat','circles','growth','discover']);
   const tabsWithGenericFeed=new Set(['market','wallet','experience']);
   for(const tab of tabs) {
    await page.evaluate(tab=>window.selectFixtureTab(tab),tab);await page.waitForTimeout(150);
    assert.ok(await page.locator('#member-fixture .app-shell').count(),tab);
    const genericFeed=page.locator('#member-fixture .section-feed-surface');
    if(tabsWithoutGenericFeed.has(tab)) assert.equal(await genericFeed.count(),0,`${tab} must not show the generic section feed`);
    if(tabsWithGenericFeed.has(tab)) assert.equal(await genericFeed.count(),1,`${tab} should retain its generic section feed`);
   }
   await page.evaluate(()=>window.selectFixtureTab('hub'));await page.waitForTimeout(150);
   await page.evaluate(()=>window.scrollTo(0,0));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Member Home must fit the viewport');
   await page.screenshot({path:`/tmp/foxhub-member-${width}.png`});
   console.log(`PASS member workspace tabs at ${width}px`);
  }
 }
 assert.deepEqual(errors,[]);console.log('PASS no uncaught browser errors');
} finally {await browser.close();}
