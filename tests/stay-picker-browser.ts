import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
async function main() {
 const browser = await chromium.launch({channel:"msedge",headless:true});
 try {
  for(const width of [1440,390]) {
   const page=await browser.newPage({viewport:{width,height:900},reducedMotion:"reduce"});
   await page.goto("http://localhost:3000");
   // Wait for hydration before interacting with server-rendered controls.
   await page.waitForTimeout(1500);
   await page.getByRole("button",{name:"Check-in",exact:true}).click();
   await page.getByRole("dialog").waitFor();
   const bounds=await page.getByRole("dialog").boundingBox();
   assert.ok(bounds && bounds.x>=0 && bounds.x+bounds.width<=width);
   const first=await page.locator('.calendar-days button:focus').getAttribute('data-day');
   assert.ok(first);
   await page.keyboard.press('ArrowRight');
   const arrival=await page.locator('.calendar-days button:focus').getAttribute('data-day');
   assert.notEqual(first,arrival);
   await page.keyboard.press('Enter');
   assert.equal(await page.locator('input[name=checkin]').inputValue(),arrival);
   await page.getByRole('button',{name:'Check-out',exact:true}).click();
   const departure=await page.locator('.calendar-days button:focus').getAttribute('data-day');
   assert.ok(departure!>arrival!);
   await page.keyboard.press('Enter');
   await page.getByRole('button',{name:'Guests',exact:true}).click();
   await page.keyboard.press('End');
   await page.keyboard.press('Enter');
   assert.equal(await page.locator('input[name=adults]').inputValue(),'4');
   await page.getByRole('button',{name:'Check-in',exact:true}).click();
   await page.keyboard.press('Escape');
   assert.equal(await page.getByRole('dialog').count(),0);
   await page.screenshot({path:`artifacts/picker-${width}.png`});
   await page.getByRole('button',{name:'Find your stay'}).click();
   await page.waitForURL('**/availability?**');
   const url=new URL(page.url());
   assert.equal(url.searchParams.get('checkin'),arrival);
   assert.equal(url.searchParams.get('checkout'),departure);
   assert.equal(url.searchParams.get('adults'),'4');
   console.log(`PASS ${width}px calendar keyboard selection, date bounds, guest selection, Escape and search parameters`);
   await page.close();
  }
 } finally {await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
