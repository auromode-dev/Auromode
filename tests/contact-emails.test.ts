import test from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '../app/api/contact/route';
import { processContactEmails } from '../lib/contact-notifications';
test('contact enquiry emails both recipients and retries only the failed recipient',async t=>{
 const settings={NEXT_PUBLIC_SUPABASE_URL:'https://test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test',RESEND_API_KEY:'test',NOTIFICATION_FROM_EMAIL:'sender@example.com',ADMIN_NOTIFICATION_EMAIL:'admin@example.com'};
 for(const [k,v] of Object.entries(settings)){const prev=process.env[k];process.env[k]=v;t.after(()=>{if(prev===undefined)delete process.env[k];else process.env[k]=prev;});}
 let record:Record<string,unknown>={};let failGuest=true;const recipients:string[]=[];
 const json=(v:unknown)=>new Response(JSON.stringify(v),{headers:{'Content-Type':'application/json'}});
 t.mock.method(globalThis,'fetch',async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=String(input);const body=init?.body?JSON.parse(String(init.body)):{};
  if(url.endsWith('/rpc/claim_enquiry_emails'))return json([record]);
  if(url.includes('api.resend.com')){recipients.push(body.to[0]);if(body.to[0]==='guest@example.com'){assert.match(body.text,/does not reserve a room/);assert.ok(!body.html.includes('<script>'));if(failGuest)return new Response('{}',{status:503});}return json({id:'accepted'});}
  if(url.includes('/enquiries')&&init?.method==='POST'){record={...body};return new Response(null,{status:201});}
  if(url.includes('/enquiries')&&init?.method==='PATCH'){Object.assign(record,body);return new Response(null,{status:204});}
  throw Error('Unexpected request');
 });
 const response=await POST(new Request('http://localhost/api/contact',{method:'POST',body:JSON.stringify({name:'Test <script>',email:'guest@example.com',phone:'123456789',subject:'Room enquiry',message:'Please contact me.'})}));
 assert.equal(response.status,200);assert.equal((await response.json()).emailPending,true);assert.deepEqual(recipients,['guest@example.com','admin@example.com']);assert.equal(record.admin_email_sent,true);assert.ok(record.email_next_attempt_at);
 failGuest=false;recipients.length=0;assert.equal((await processContactEmails(String(record.id))).pending,false);assert.deepEqual(recipients,['guest@example.com']);assert.equal(record.guest_email_sent,true);
});
