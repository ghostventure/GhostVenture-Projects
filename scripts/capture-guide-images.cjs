const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const {_electron} = require('playwright')
const root = path.resolve(__dirname,'..')
const output = path.join(root,'website-next/public/user-guide/images')
const sampleRoot = fs.mkdtempSync(path.join(os.tmpdir(),'overhead-guide-sample-'))
const dataDir = path.join(sampleRoot,'OverHead/data')
fs.mkdirSync(dataDir,{recursive:true})
fs.mkdirSync(output,{recursive:true})
const timestamp = new Date().toISOString()
// This fictional local profile is used only to illustrate the real packaged UI.
const fixture = {
  userProfiles:[{id:'guide-owner',email:'owner@example.test',owner_name:'Sample Owner',business_name:'Sample Service Office',role:'Owner',status:'Active',email_verified:true,terms_accepted_at:timestamp,created_at:timestamp,updated_at:timestamp}],
  sessions:[{id:'guide-session',user_profile_id:'guide-owner',lock_state:'unlocked',started_at:timestamp,last_seen_at:timestamp,ended_at:''}],
  customers:[{id:'guide-customer',business_name:'Sample Customer',owner_name:'Taylor Example',email:'taylor@example.test',industry:'Home services',service_area:'Local area',preferred_contact:'Email',status:'Active',created_at:timestamp,updated_at:timestamp}],
  subscriptions:[{id:'guide-plan',manager_email:'owner@example.test',tier:'gold',payment_status:'trial',trial_ends_at:new Date(Date.now()+30*86400000).toISOString(),created_at:timestamp,updated_at:timestamp}],
  adminTasks:[{id:'guide-task',title:'Follow up on Taylor’s quote',area:'Customers',status:'Open',protected:false,created_at:timestamp,updated_at:timestamp}],
  appointments:[],quotes:[],invoices:[],
}
fs.writeFileSync(path.join(dataDir,'overhead-store.json'),JSON.stringify(fixture))
async function main() {
  const desktop = await _electron.launch({executablePath:require('electron'),args:[path.join(__dirname,'stripe-package-harness.cjs')],env:{...process.env,OVERHEAD_SMOKE_DATA:sampleRoot}})
  try {
    const page=await desktop.firstWindow()
    await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1280,960))
    await page.getByRole('heading',{name:'Current work',exact:true}).waitFor({timeout:30000})
    await page.screenshot({path:path.join(output,'dashboard.jpg'),type:'jpeg',quality:85})
    await page.locator('.nav-item').filter({hasText:'Customers'}).click()
    await page.getByRole('heading',{name:'Add customer',exact:true}).waitFor()
    await page.locator('.customer-manager').screenshot({path:path.join(output,'add-customer.jpg'),type:'jpeg',quality:85})
    await page.locator('.nav-item').filter({hasText:'Team Dashboard'}).click()
    const create=page.locator('.action-panel').filter({has:page.getByRole('heading',{name:'Create office work',exact:true})})
    await create.getByRole('button',{name:'quote',exact:true}).click()
    await create.screenshot({path:path.join(output,'create-quote.jpg'),type:'jpeg',quality:85})
    await page.locator('.nav-item').filter({hasText:'Settings'}).click()
    await page.getByRole('heading',{name:'Workspace controls and safe operations'}).waitFor()
    const health=page.locator('.backend-health').filter({has:page.getByText('Local workspace health',{exact:true})})
    await health.scrollIntoViewIfNeeded()
    const clip=await health.evaluate(el=>{const r=el.getBoundingClientRect();const note=el.querySelector('small').getBoundingClientRect();return {x:r.x+window.scrollX,y:r.y+window.scrollY,width:r.width,height:note.bottom-r.top+8}})
    await page.screenshot({path:path.join(output,'backup-controls.jpg'),type:'jpeg',quality:85,clip})
    console.log('Captured four real packaged-app screens using fictional local data.')
  } finally {await desktop.close()}
}
main().catch(error=>{console.error(error.message);process.exitCode=1})
