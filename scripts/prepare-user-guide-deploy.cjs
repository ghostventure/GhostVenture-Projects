const fs = require('node:fs')
const path = require('node:path')

module.exports = async function prepareGuide(root, liveFiles) {
  const stage = path.join(root, 'release-user-guide/site-patch')
  fs.mkdirSync(stage, {recursive:true})
  const textPaths = Object.keys(liveFiles).filter(p => /\.(html|txt|js|xml)$/.test(p) && !p.startsWith('/__/') && !p.startsWith('/downloads/') && !p.startsWith('/updates/') && !p.startsWith('/user-guide/'))
  const texts = new Map()
  await Promise.all(textPaths.map(async p => {
    const response = await fetch('https://overhead-office.web.app'+p)
    if (!response.ok) throw new Error(`Cannot preserve live page ${p}: ${response.status}`)
    texts.set(p, await response.text())
  }))
  const updated = new Map()
  for (const [p,original] of texts) {
    let content = original.replaceAll('/downloads/OverHead-Business-Office-Guide.pdf','/user-guide/').replaceAll('Business Guide','User Guide')
    if (p === '/sitemap.xml' && !content.includes('/user-guide/')) content=content.replace('</urlset>','<url><loc>https://overhead-office.web.app/user-guide/</loc><changefreq>monthly</changefreq><priority>0.8</priority></url></urlset>')
    if (content !== original) updated.set(p,content)
  }
  // Changed immutable JS assets receive new names; old assets stay available.
  const renamed = new Map()
  for (let pass=0;pass<8;pass++) {
    let grew=false
    for(const [p] of updated) if(p.endsWith('.js')&&!renamed.has(p)) {
      renamed.set(p,p.replace(/\.js$/, '-user-guide.js')); grew=true
    }
    for(const [p,original] of texts) {
      let content=updated.get(p)||original
      for(const [oldName,newName] of renamed) content=content.replaceAll(path.posix.basename(oldName),path.posix.basename(newName))
      if(content!==original) updated.set(p,content)
    }
    if(!grew)break
  }
  const artifacts=[]
  for(const [p,content] of updated) {
    const target=renamed.get(p)||p
    const local=path.join(stage,target.slice(1))
    fs.mkdirSync(path.dirname(local),{recursive:true});fs.writeFileSync(local,content)
    artifacts.push([target,path.relative(path.join(root,'release-user-guide'),local)])
  }
  const publicRoot=path.join(root,'website-next/public')
  const collect=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    const full=path.join(dir,entry.name)
    if(entry.isDirectory())collect(full)
    else artifacts.push(['/'+path.relative(publicRoot,full).split(path.sep).join('/'),path.relative(path.join(root,'release-user-guide'),full)])
  }}
  collect(path.join(publicRoot,'user-guide'))
  artifacts.push(['/downloads/OverHead-User-Guide.pdf','../website-next/public/downloads/OverHead-User-Guide.pdf'])
  if(!updated.has('/index.html')&&!texts.get('/index.html')?.includes('/user-guide/'))throw new Error('Could not locate the live footer link on the homepage.')
  fs.writeFileSync(path.join(root,'release-user-guide/site-patch-report.json'),JSON.stringify({modified:[...updated.keys()],renamed:[...renamed],artifacts:artifacts.map(([url])=>url)},null,2))
  console.log(`Prepared guide and ${updated.size} navigation/sitemap updates; ${renamed.size} new JS assets.`)
  return artifacts
}
