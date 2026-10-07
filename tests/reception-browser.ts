import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
async function main() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const user = {
    id: "00000000-0000-4000-8000-000000000001",
    aud: "authenticated",
    role: "authenticated",
    email: "admin-test@example.com",
    app_metadata: { role: "admin", provider: "email" },
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  const jwt = (admin: boolean) =>
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ) +
    "." +
    Buffer.from(
      JSON.stringify({
        sub: user.id,
        exp: Math.floor(Date.now() / 1000) + 3600,
        role: "authenticated",
        app_metadata: admin ? { role: "admin" } : {},
      }),
    ).toString("base64url") +
    ".test-signature";
  const stale = jwt(false),
    fresh = jwt(true);
  const session = {
    access_token: stale,
    refresh_token: "test-refresh-token",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    token_type: "bearer",
    user: { ...user, app_metadata: { provider: "email" } },
  };

 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  for(const width of [1440,390]) {
   const page=await browser.newPage({viewport:{width,height:950}});let saved=0;
   await page.addInitScript(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key:'sb-'+new URL(base).hostname.split('.')[0]+'-auth-token',session:{...session,user,access_token:fresh}});
   await page.routeWebSocket('**/realtime/**',s=>s.close());
   await page.route('**/api/admin/booking-notifications',r=>r.fulfill({json:{delivered:2,failed:0}}));
   await page.route('**/api/availability', route=>route.fulfill({json:{rooms:[{id:'room-test',name:'Twin A',nightly_rate:200000}]}}));
   await page.route(base+'/**',async route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/auth/v1/user')return route.fulfill({json:user});
    if(url.pathname==='/rest/v1/rpc/available_rooms')return route.fulfill({json:[{id:'room-test',name:'Twin A',nightly_rate:200000}]});
    if(url.pathname==='/rest/v1/rpc/reception_booking'){
     const data=route.request().postDataJSON();assert.equal(data.p_guest.expectedAmount,400000);assert.equal(data.p_guest.whatsappOptIn,false);assert.ok(data.p_request_id);saved++;return route.fulfill({json:{id:'test-booking',status:'confirmed'}});
    }
    if(url.pathname.startsWith('/rest/v1/'))return route.fulfill({json:[]});
    return route.abort();
   });
   await page.goto('http://localhost:3000/admin');await page.getByRole('button',{name:'Rooms',exact:true}).click();
   const form=page.locator('.reception-booking');await form.waitFor();assert.equal(await page.getByText('Add a physical room',{exact:true}).count(),0);
   await form.getByLabel('Check-in',{exact:true}).fill('2090-10-10');await form.getByLabel('Check-out',{exact:true}).fill('2090-10-12');
   await form.getByRole('button',{name:'Check availability',exact:true}).click();await form.getByLabel('First name',{exact:true}).fill('Test');await form.getByLabel('Last name',{exact:true}).fill('Guest');await form.getByLabel('Email',{exact:true}).fill('test@example.com');await form.getByLabel('Phone',{exact:true}).fill('123456789');await form.getByLabel('The guest has authorized',{exact:false}).check();
   await form.screenshot({path:'artifacts/reception-'+width+'.png'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await form.getByRole('button',{name:'Confirm booking and block rooms'}).click();await page.getByText('Booking test-booking: confirmed.',{exact:false}).waitFor();assert.equal(saved,1);console.log('PASS '+width+'px reception booking (mocked Supabase only)');await page.close();
  }
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
