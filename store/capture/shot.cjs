// shot.cjs <lang> <outdir> [scale]: the four App Store screens as the Hibira app shows them.
const { chromium } = require('playwright'); const fs=require('fs'), path=require('path');
const [lang, outdir, scale='3'] = process.argv.slice(2);
const st=JSON.parse(fs.readFileSync(__dirname+'/state.json'));
const X=JSON.parse(fs.readFileSync(__dirname+'/texts.json'))[lang];
const cur=JSON.parse(fs.readFileSync(__dirname+'/cur.json'));
(async()=>{
 fs.mkdirSync(outdir,{recursive:true});
 const b=await chromium.launch();
 const ctx=await b.newContext({viewport:{width:440,height:956},deviceScaleFactor:+scale,isMobile:true,hasTouch:true,locale:X.bcp,
  userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 HibiraApp/ios'});
 await ctx.addCookies([...Object.entries(st.owner_cookies).map(([name,value])=>({name,value,domain:'localhost',path:'/'})),...Object.entries(st.appr_cookies).map(([name,value])=>({name,value,domain:'approvals.localhost',path:'/'}))]);
 await ctx.addInitScript((ws)=>{ try{ localStorage.setItem('hap:onboarding-hidden:'+ws,'1'); }catch{} }, st.ws);
 const p=await ctx.newPage(); p.on('pageerror',e=>console.log('pageerror',e.message));
 const shot=n=>p.screenshot({path:path.join(outdir,n+'.png')});
 await p.goto('http://localhost:8080/portal/dashboard'); await p.waitForTimeout(2500);
 await p.locator('header button').first().click(); await p.waitForTimeout(700); await shot('1-products');
 await p.goto('http://localhost:8080/portal/apps'); await p.waitForTimeout(3000); await shot('2-apps');
 await p.goto('http://approvals.localhost:8080/inbox'); await p.waitForTimeout(2500); await shot('3-inbox');
 await p.goto('http://approvals.localhost:8080/inbox/'+cur.ids[0]); await p.waitForTimeout(2500); await shot('4-request');
 await b.close();})();
