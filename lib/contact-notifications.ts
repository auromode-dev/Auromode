import { database } from "@/lib/server";
import { email } from "@/lib/notifications";
export async function processContactEmails(id?: string) {
 const db=database();
 if(!db || !process.env.RESEND_API_KEY || !process.env.NOTIFICATION_FROM_EMAIL || !process.env.ADMIN_NOTIFICATION_EMAIL)return {accepted:0,failed:0,pending:true};
 const {data,error}=await db.rpc("claim_enquiry_emails",{p_id:id||null});
 if(error)return {accepted:0,failed:0,pending:true};
 let accepted=0,failed=0;
 for(const enquiry of data||[]) {
  let retry=false;
  for(const recipient of ["guest","admin"] as const){
   const column=recipient+"_email_sent";
   if(enquiry[column])continue;
   try {
    const text=recipient==="guest"
     ? `Hello ${enquiry.name},\n\nThank you for contacting Auromode. We have received your enquiry about ${enquiry.subject}. Reception will be in touch.\n\nThis acknowledgement does not reserve a room or confirm a booking.\n\nFor assistance: avapart@gmail.com or +91 413 262 22 24.\nAuromode Guesthouse`
     : `New enquiry received\n\nName: ${enquiry.name}\nEmail: ${enquiry.email}\nPhone: ${enquiry.phone || "Not provided"}\nSubject: ${enquiry.subject}\n\n${enquiry.message}`;
    await email(recipient==="guest"?enquiry.email:process.env.ADMIN_NOTIFICATION_EMAIL!,recipient==="guest"?"Auromode - enquiry received":"Auromode - new enquiry",text,enquiry.id+"-contact-"+recipient);
    const saved=await db.from("enquiries").update({[column]:true}).eq("id",enquiry.id);if(saved.error)throw saved.error;accepted++;
   }catch{retry=true;failed++;}
  }
  const saved=await db.from("enquiries").update({email_locked_until:null,...(retry?{email_next_attempt_at:new Date(Date.now()+300000).toISOString()}: {})}).eq("id",enquiry.id);
  if(saved.error)failed++;
 }
 return {accepted,failed,pending:failed>0};
}
