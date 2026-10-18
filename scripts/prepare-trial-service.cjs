// Stage the no-card service independently from the unconfigured paid billing service.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'release-trial-functions');fs.mkdirSync(dir,{recursive:true});
let source=fs.readFileSync(path.join(root,'functions/index.js'),'utf8');
source=source.replace("const { defineSecret, defineString } = require('firebase-functions/params')", "const unavailable = () => ({ value: () => { throw new Error('Paid billing is not available in the trial service.') } }); const defineSecret = unavailable, defineString = unavailable");
source=source.replace(/^exports\.billingApi = onRequest\(.+$/m,'');
if(source.includes('exports.billingApi')||source.includes("require('firebase-functions/params')"))throw Error('Trial service still includes payment configuration');
fs.writeFileSync(path.join(dir,'index.js'),source);fs.copyFileSync(path.join(root,'functions/package.json'),path.join(dir,'package.json'));fs.copyFileSync(path.join(root,'functions/package-lock.json'),path.join(dir,'package-lock.json'));
fs.writeFileSync(path.join(root,'firebase.trials.json'),JSON.stringify({functions:{source:'release-trial-functions',codebase:'trials',runtime:'nodejs22'}},null,2)+'\n');
console.log('Staged isolated trial service without Stripe parameters or payment endpoint');
