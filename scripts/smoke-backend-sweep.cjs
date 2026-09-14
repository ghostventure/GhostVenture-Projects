const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict')
const {_electron}=require('playwright')
async function main(){
  const release=path.resolve(__dirname,'../release-backend-sweep-ux-0.3.13'),data=fs.mkdtempSync(path.join(os.tmpdir(),'overhead-backend-smoke-'))
  const app=await _electron.launch({executablePath:require('electron'),args:[path.join(__dirname,'backend-sweep-package-harness.cjs')],env:{...process.env,OVERHEAD_SMOKE_DATA:data}})
  try{const page=await app.firstWindow();await page.locator('.login-card').waitFor({timeout:30000});const result=await app.evaluate(({app,BrowserWindow})=>({userData:app.getPath('userData'),windows:BrowserWindow.getAllWindows().length}));assert.ok(result.userData.startsWith(data));assert.equal(result.windows,1);await page.screenshot({path:path.join(release,'startup-smoke.png')});fs.writeFileSync(path.join(release,'smoke-result.json'),JSON.stringify({passed:true,...result},null,2));console.log('PASS: packaged application code opens one sign-in window with isolated data')}finally{await app.close()}
}
main().catch(e=>{console.error(e);process.exitCode=1})
