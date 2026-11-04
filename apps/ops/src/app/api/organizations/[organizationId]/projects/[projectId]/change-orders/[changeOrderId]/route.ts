import { NextRequest,NextResponse } from "next/server";
import { MembershipRole,Prisma,prisma } from "@dzaroza/database";
import { z } from "zod";
import { requireTenantRole,toHttpError } from "@/lib/tenant";
const schema=z.object({status:z.enum(["APPROVED","REJECTED"])}).strict();
export async function PATCH(request:NextRequest,context:{params:Promise<{organizationId:string;projectId:string;changeOrderId:string}>}){
 try{
  const {organizationId,projectId,changeOrderId}=await context.params;
  const actor=await requireTenantRole(organizationId,[MembershipRole.OWNER,MembershipRole.ADMIN,MembershipRole.PROJECT_MANAGER]);
  let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:"Payload JSON tidak valid."},{status:400})}
  const parsed=schema.safeParse(body);if(!parsed.success)return NextResponse.json({error:"Status perubahan tidak valid."},{status:400});
  const result=await prisma.$transaction(async tx=>{
   const order=await tx.changeOrder.findFirst({where:{organizationId,projectId,id:changeOrderId}});
   if(!order)return {kind:"not-found" as const};
   if(order.status!=="DRAFT")return {kind:"conflict" as const,status:order.status};
   await tx.changeOrder.updateMany({where:{organizationId,projectId,id:changeOrderId,status:"DRAFT"},data:{status:parsed.data.status,agreedAt:parsed.data.status==="APPROVED"?new Date():null}});
   if(parsed.data.status==="APPROVED"){
    const project=await tx.project.findFirst({where:{organizationId,id:projectId},select:{contractValue:true}});
    if(!project)return {kind:"not-found" as const};
    const approved=await tx.changeOrder.findMany({where:{organizationId,projectId,status:{in:["APPROVED","AGREED"]}} ,select:{netTotal:true}});
    const finalValue=approved.reduce((sum,row)=>sum.plus(row.netTotal),new Prisma.Decimal(project.contractValue)).toDecimalPlaces(2);
    const terms=await tx.paymentTerm.findMany({where:{organizationId,projectId},select:{id:true,percentage:true}});
    for(const term of terms){
      const amount=finalValue.mul(term.percentage).div(100).toDecimalPlaces(2);
      await tx.paymentTerm.updateMany({where:{organizationId,id:term.id,projectId},data:{amount}});
    }
   }
   await tx.auditLog.create({data:{organizationId,actorId:actor.userId,action:`project.change_order.${parsed.data.status.toLowerCase()}`,entityType:"ChangeOrder",entityId:changeOrderId,beforeState:{status:order.status},afterState:{status:parsed.data.status}}});
   return {kind:"updated" as const,status:parsed.data.status};
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  if(result.kind==="not-found")return NextResponse.json({error:"Berita acara tidak ditemukan."},{status:404});
  if(result.kind==="conflict")return NextResponse.json({error:`Perubahan tidak dapat diproses dari status ${result.status}.`},{status:409});
  return NextResponse.json({changeOrder:{id:changeOrderId,status:result.status}});
 }catch(error){if(typeof error==="object"&&error!==null&&"code"in error&&error.code==="P2034")return NextResponse.json({error:"Perubahan bersamaan terdeteksi."},{status:409});const r=toHttpError(error);return NextResponse.json({error:r.message},{status:r.status});}
}
