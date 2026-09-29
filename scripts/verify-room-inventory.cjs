const fs = require('node:fs');
const assert = require('node:assert/strict');
require('@next/env').loadEnvConfig(process.cwd());
const {createClient} = require('@supabase/supabase-js');
async function main(){
 const expected=JSON.parse(fs.readFileSync('data/room-inventory.json','utf8').replace(/^\uFEFF/,''));
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})}});
 const {data:rooms,error}=await db.from('rooms').select('id,room_number,category,capacity,season_rate,non_season_rate,nightly_rate,active,image_urls,image_url');
 if(error)throw new Error('Inventory read failed: '+error.code);
 for(const row of expected){const live=rooms.find(r=>r.room_number===row.room_number);assert.ok(live,'Missing room '+row.room_number);for(const key of ['category','capacity','season_rate','non_season_rate'])assert.equal(live[key],row[key],'Room '+row.room_number+': '+key);assert.equal(live.nightly_rate,row.non_season_rate,'Live rate for room '+row.room_number);assert.equal(live.active,true,'Active room '+row.room_number);assert.ok(live.image_urls.length>0,'Gallery for room '+row.room_number);assert.equal(live.image_url,live.image_urls[0],'Cover for room '+row.room_number);}
 assert.equal(rooms.filter(r=>r.active).length,34,'Active room total');
 console.log('PASS: all 34 active rooms match approved categories, bed counts and both price lists; non-season rates are live; galleries and covers are present.');
 console.log('Preserved inactive records: '+rooms.filter(r=>!r.active).length);
 const checkin=new Date(Date.now()+7*86400000).toISOString().slice(0,10),checkout=new Date(Date.now()+9*86400000).toISOString().slice(0,10);
 for(const [category,capacity] of [['studio',1],['twin',2],['triple',3],['family',4]]){
 const {data,error}=await db.rpc('available_rooms',{p_category:category,p_checkin:checkin,p_checkout:checkout,p_guests:capacity});
 if(error)throw new Error('Availability failed for '+category+': '+error.code);
 for(const r of data){const live=rooms.find(x=>x.id===r.id);assert.ok(live?.active&&live.category===category);assert.equal(r.nightly_rate,live.non_season_rate);}
 console.log(category+': '+rooms.filter(r=>r.active&&r.category===category).length+' active; '+data.length+' available for '+checkin+' to '+checkout);
 }
 console.log('PASS: all four live availability queries succeeded. No records changed.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
