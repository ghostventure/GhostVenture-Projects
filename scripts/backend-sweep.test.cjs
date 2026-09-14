const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),os=require('node:os')
const {createRequire}=require('node:module')
function desktop(fetch) {
  const filename=path.resolve(__dirname,'../electron-backend.cjs')
  const module={exports:{}}
  vm.runInNewContext(fs.readFileSync(filename,'utf8')+`
    persist=()=>{};recordAudit=()=>{};requireRole=()=>{};requireFeature=()=>{};
    state=defaultState();activeSession={id:'s1',role:'Owner',firebaseIdToken:'token',firebaseUid:'uid'};
    activeWorkspaceId=()=> 'workspace';
    module.exports.inspect={state,listFirestoreDocuments,firebaseRequest,validRestoreState,changeSession:()=>{activeSession=null},root:p=>{dataRoot=p}};
  `,{require:createRequire(filename),module,console,process,Buffer,AbortSignal,URLSearchParams,fetch},{filename})
  return module.exports
}
test('customer listing traverses pages, encodes tokens and uses document identity',async()=>{
  const calls=[];const backend=desktop(async(url,options)=>{calls.push(url);assert.ok(options.signal);return {ok:true,json:async()=>calls.length===1?{documents:[{name:'customers/a',fields:{id:{stringValue:'spoof'}}}],nextPageToken:'a+/='}:{documents:[{name:'customers/b'}]}}})
  const docs=await backend.inspect.listFirestoreDocuments('workspaces/w/customers','token')
  assert.deepEqual(Array.from(docs,d=>d.id),['a','b']);assert.match(calls[1],/pageToken=a%2B%2F%3D/)
})
test('repeating page token fails instead of hanging or silently truncating',async()=>{
  const backend=desktop(async()=>({ok:true,json:async()=>({nextPageToken:'same'})}))
  await assert.rejects(backend.inspect.listFirestoreDocuments('workspaces/w/customers','token'),/repeated a page/)
})
test('cloud requests preserve caller cancellation and apply a default deadline',async()=>{
  const signals=[];const backend=desktop(async(_url,options)=>{signals.push(options.signal);return{ok:true,json:async()=>({})}})
  const signal=AbortSignal.timeout(1000);await backend.inspect.firebaseRequest('https://example.test',{signal});await backend.inspect.firebaseRequest('https://example.test');assert.equal(signals[0],signal);assert.ok(signals[1])
})
test('sync cannot write a fetched customer into a signed-out session',async()=>{
  let backend;backend=desktop(async()=>{backend.inspect.changeSession();return{ok:true,json:async()=>({documents:[{name:'customers/a'}]})}})
  await assert.rejects(backend.syncCustomersWithWorkspace(),/account changed/);assert.equal(backend.inspect.state.customers.length,0)
})
test('simultaneous sync is rejected without starting a second fetch',async()=>{
  let finish,calls=0;const backend=desktop(()=>{calls++;return new Promise(r=>{finish=r})})
  const first=backend.syncCustomersWithWorkspace();await assert.rejects(backend.syncCustomersWithWorkspace(),/already running/);finish({ok:true,json:async()=>({})});await first;assert.equal(calls,1)
})
test('restore rejects malformed collections and accepts older valid stores',()=>{
  const b=desktop().inspect;const valid={schema:'overhead-local-store-v2',customers:[],adminTasks:[],userProfiles:[]}
  assert.equal(b.validRestoreState(valid),true)
  for(const bad of [null,{}, {...valid,userProfiles:null},{...valid,customers:[null]},{...valid,settings:[]},{...valid,sessions:'bad'}])assert.equal(b.validRestoreState(bad),false)
})
test('support bundle omits credentials and honors store toggle',()=>{
  const b=desktop(),dir=fs.mkdtempSync(path.join(os.tmpdir(),'overhead-support-test-'));b.inspect.root(dir)
  b.inspect.state.userProfiles.push({password_hash:'DO-NOT-EXPORT'});b.inspect.state.microsoftConnections.push({token_cache:'DO-NOT-EXPORT'})
  try{const AdmZip=require('adm-zip');const bundle=new AdmZip(b.createSupportBundle().bundlePath);assert.equal(bundle.getEntry('overhead-store.secure'),null);assert.ok(bundle.getEntry('overhead-store.json'));for(const entry of bundle.getEntries())assert.ok(!entry.getData().toString().includes('DO-NOT-EXPORT'));b.inspect.state.appToggles.supportBundleIncludesStore=false;assert.equal(new AdmZip(b.createSupportBundle().bundlePath).getEntry('overhead-store.json'),null)}finally{fs.rmSync(dir,{recursive:true,force:true})}
})
function cloud(options={}) {
  const checkoutCalls=[];
  class Stripe { constructor(){this.checkout={sessions:{create:async(...args)=>{checkoutCalls.push(args);if(options.checkoutError)throw options.checkoutError;return{id:"cs_test",client_secret:"test"}}}}} }
  const records=new Map(),module={exports:{}},field={serverTimestamp:()=>({toDate:()=>new Date()}),delete:()=>null};let fail=false,serial=Promise.resolve()
  const profile={id:'u',data:()=>({status:'Active',email:'owner@example.test'})}
  const db={doc:p=>({path:p,get:async()=>({data:()=>p.startsWith('profiles/')?{status:'Active',role:'Administrator',workspace_id:'w'}:records.get(p)}),set:async v=>records.set(p,{...records.get(p),...v})}),collection:p=>({where:()=>({query:p})}),runTransaction:fn=>{
    const run=serial.then(async()=>{const writes=[];let writing=false;const tx={get:async ref=>{assert.equal(writing,false,'transaction reads must precede writes');if(ref.query)return{size:1,forEach:fn=>fn(profile)};return{exists:records.has(ref.path),data:()=>records.get(ref.path)}},create:(ref,v)=>{writing=true;writes.push([ref.path,v])},set:(ref,v)=>{writing=true;writes.push([ref.path,{...records.get(ref.path),...v}])}};const result=await fn(tx);if(fail){fail=false;throw Error('simulated commit failure')}for(const [p,v]of writes)records.set(p,v);return result});serial=run.catch(()=>{});return run
  }}
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../functions/index.js'),'utf8')+'\nmodule.exports.applyStripeEvent=applyStripeEvent;', {module,exports:module.exports,console,require:name=>name==='crypto'?require(name):name==='stripe'?Stripe:name==='firebase-functions/v2/https'?{onRequest:(_o,fn)=>fn}:name==='firebase-functions/v2/scheduler'?{onSchedule:(_o,fn)=>fn}:name==='firebase-functions/params'?{defineSecret:()=>({value:()=>''}),defineString:()=>({value:()=>''})}:name==='firebase-admin/app'?{initializeApp:()=>{}}:name==='firebase-admin/auth'?{getAuth:()=>({verifyIdToken:async()=>({uid:'u',email:'owner@example.test',email_verified:options.verified!==false})})}:{getFirestore:()=>db,FieldValue:field}})
  return{...module.exports,records,checkoutCalls,fail:()=>{fail=true}}
}
const event=(id,type,created,status='active')=>({id,type,created,data:{object:{id:'sub_one',subscription:'sub_one',status,payment_status:'paid',metadata:{workspaceId:'w',tier:'gold'}}}})
async function request(c,body){const result={};await c.billingApi({method:'POST',path:'/',get:()=> 'Bearer test',body},{status:n=>{result.status=n;return{json:v=>{result.body=v}}}});return result}
test('concurrent checkout requests create exactly one Stripe session',async()=>{
  const c=cloud(),body={action:'checkout',tier:'gold',acceptBillingPolicy:true};const results=await Promise.all([request(c,body),request(c,body)]);assert.equal(c.checkoutCalls.length,1);assert.equal(results.filter(r=>r.status===200).length,1);assert.match(c.checkoutCalls[0][1].idempotencyKey,/overhead-checkout/)
})
test('unverified user cannot invoke billing or create a trial',async()=>{
  const c=cloud({verified:false});const r=await request(c,{action:'start_free_gold_trial',acceptTrialPolicy:true});assert.equal(r.status,403);assert.equal(c.records.size,0)
})
test('a second plan cannot create a parallel paid subscription',async()=>{
  const c=cloud();c.records.set('workspaces/w/billing/current',{status:'active',tier:'silver',stripe_subscription_id:'sub_one'});const r=await request(c,{action:'checkout',tier:'gold',acceptBillingPolicy:true});assert.equal(r.status,403);assert.equal(c.checkoutCalls.length,0)
})
test('definitive checkout rejection clears lock but ambiguous failure retains it',async()=>{
  for(const type of ['StripeInvalidRequestError','StripeConnectionError']){const c=cloud({checkoutError:{type,message:'failed'}});await request(c,{action:'checkout',tier:'gold',acceptBillingPolicy:true});assert.equal(c.records.get('workspaces/w/billing/current').checkout_pending,type==='StripeConnectionError')}
})
test('concurrent trial requests grant one trial and consistent licenses',async()=>{
  const c=cloud(),body={action:'start_free_gold_trial',acceptTrialPolicy:true};const results=await Promise.all([request(c,body),request(c,body)]);assert.equal(results.filter(r=>r.status===200).length,1);assert.equal(c.records.get('workspaces/w/billing/current').trial_used,true);assert.equal(c.records.get('workspaces/w/licenses/u').status,'Trial')
})
test('unpaid subscription update suspends license instead of granting paid access',async()=>{
  const c=cloud();await c.applyStripeEvent(event('evt_1','customer.subscription.updated',10,'unpaid'));assert.equal(c.records.get('workspaces/w/billing/current').status,'unpaid');assert.equal(c.records.get('workspaces/w/licenses/u').status,'Suspended')
})
test('replayed or older webhook cannot reactivate canceled licenses',async()=>{
  const c=cloud();const paid=event('evt_1','invoice.paid',10);await c.applyStripeEvent(paid);await c.applyStripeEvent(event('evt_2','customer.subscription.deleted',20));await c.applyStripeEvent(paid);await c.applyStripeEvent(event('evt_3','invoice.paid',15));await c.applyStripeEvent(event('evt_4','invoice.paid',20));assert.equal(c.records.get('workspaces/w/licenses/u').status,'Suspended');assert.equal(c.records.get('workspaces/w/billing/current').status,'canceled')
})
test('failed webhook commit is retryable with no partially updated billing or licenses',async()=>{
  const c=cloud(),e=event('evt_1','invoice.paid',10);c.fail();await assert.rejects(c.applyStripeEvent(e),/commit failure/);assert.equal(c.records.size,0);await c.applyStripeEvent(e);assert.equal(c.records.get('workspaces/w/licenses/u').status,'Active');assert.ok(c.records.has('stripe_events/evt_1'))
})
test('unrelated refund events never overwrite the subscription ID or status',async()=>{
  const c=cloud();await c.applyStripeEvent(event('evt_1','invoice.paid',10));await c.applyStripeEvent(event('evt_2','refund.created',20));assert.equal(c.records.get('workspaces/w/billing/current').stripe_subscription_id,'sub_one');assert.equal(c.records.get('workspaces/w/billing/current').status,'active')
})
test('invoice parent metadata is accepted and unpaid checkout does not activate access',async()=>{
  const c=cloud(),e=event('evt_1','invoice.paid',10);e.data.object.parent={subscription_details:{metadata:e.data.object.metadata,subscription:'sub_one'}};delete e.data.object.metadata;delete e.data.object.subscription;await c.applyStripeEvent(e);assert.equal(c.records.get('workspaces/w/billing/current').status,'active');const checkout=event('evt_2','checkout.session.completed',20);checkout.data.object.payment_status='unpaid';await c.applyStripeEvent(checkout);assert.equal(c.records.get('workspaces/w/licenses/u').status,'Suspended')
})
