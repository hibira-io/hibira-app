// hero.cjs <outroot> <langs...>: the App Store header and search results art
// (one 16:9 universal asset, 5244x2950 PNG) per language. The headline and
// icon sit in Apple's art safe area (1402x962 at 1921,660); the real app
// screenshots from raw/<lang> fan out on both sides as background.
const { chromium } = require('playwright'); const fs=require('fs'), path=require('path');
const [outroot, ...langs] = process.argv.slice(2);
const T=JSON.parse(fs.readFileSync(path.join(__dirname,'texts.json')));
const fonts={ja:"'Noto Sans CJK JP'",ko:"'Noto Sans CJK KR'",'zh-TW':"'Noto Sans CJK TC'",'zh-CN':"'Noto Sans CJK SC'",th:"'Noto Sans Thai'"};
const shots=['2-apps','1-products','3-inbox','4-request'];
const icon='data:image/png;base64,'+fs.readFileSync(path.join(__dirname,'../../ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png')).toString('base64');
// Phone positions: two on each side of the safe area, the outer ones lower and tilted.
const phones=[{x:180,y:900,r:-8},{x:1000,y:560,r:-3},{x:3369,y:560,r:3},{x:4190,y:900,r:8}];
(async()=>{
 const b=await chromium.launch(); const p=await b.newPage({viewport:{width:5244,height:2950}});
 for (const l of langs){
  const X=T[l]; const dir=path.join(outroot,X.asc); fs.mkdirSync(dir,{recursive:true});
  const ph=shots.map((s,i)=>{const img='data:image/png;base64,'+fs.readFileSync(path.join(__dirname,'raw',l,s+'.png')).toString('base64');const q=phones[i];
   return `<div style="position:absolute;left:${q.x}px;top:${q.y}px;width:875px;height:1901px;border-radius:110px;overflow:hidden;transform:rotate(${q.r}deg);box-shadow:0 60px 160px rgba(80,0,10,.4),0 0 0 18px rgba(255,255,255,.18)"><img src="${img}" style="width:875px;display:block"></div>`;}).join('');
  const size=X.h[0].replace('\n','').length>22?112:124;
  await p.setContent(`<html lang="${X.locale}"><body style="margin:0;width:5244px;height:2950px;overflow:hidden;background:radial-gradient(70% 70% at 50% 35%,#F06A6E 0%,#E5484D 50%,#B9333A 100%);font-family:${fonts[l]?fonts[l]+',':''}Inter,'Noto Sans',sans-serif">
   ${ph}
   <div style="position:absolute;left:1921px;top:660px;width:1402px;height:962px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:#fff">
    <img src="${icon}" style="width:250px;height:250px;border-radius:56px;box-shadow:0 24px 70px rgba(80,0,10,.35);margin-bottom:56px">
    <h1 style="margin:0;font-size:${size}px;line-height:1.2;font-weight:800;letter-spacing:-0.01em">${X.h[0].replace(/\n/g,'<br>')}</h1>
    <p style="margin:44px 0 0;font-size:52px;font-weight:600;opacity:.9;font-family:Inter,'Noto Sans',sans-serif">Realtime · Live Chat · Approvals · Waiting Rooms</p>
   </div></body></html>`);
  await p.evaluate(()=>document.fonts.ready);
  await p.screenshot({path:path.join(dir,'universal.png'),type:'png',omitBackground:false});
  console.log('hero',l);
 }
 await b.close();})();
