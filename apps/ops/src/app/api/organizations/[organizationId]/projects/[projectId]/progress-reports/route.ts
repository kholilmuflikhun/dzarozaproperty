import { randomUUID } from "node:crypto";
import { NextRequest,NextResponse } from "next/server";
import { MembershipRole,Prisma,prisma } from "@dzaroza/database";
import { z } from "zod";
import { requireTenantContext,requireTenantRole,toHttpError } from "@/lib/tenant";
const schema=z.object({
 weekStart:z.string().datetime(),weekEnd:z.string().datetime(),
 overallProgress:z.number().int().min(0).max(100),
 completedItems:z.array(z.string().trim().min(1).max(500)).max(50),
 nextWeekPlans:z.array(z.string().trim().min(1).max(500)).max(50),
 blockers:z.string().trim().max(2000).optional(),
 clientDecision:z.string().trim().max(2000).optional(),
 paymentStatus:z.string().trim().max(500).optional(),
}).strict().refine(v=>new Date(v.weekEnd)>=new Date(v.weekStart),{path:["weekEnd"],message:"Akhir periode tidak boleh lebih awal dari awal periode."});
export async function GET(_request:NextRequest,context:{params:Promise<{organizationId:string;projectId:string}>}){
 try{const {organizationId,projectId}=await context.params;await requireTenantContext(organizationId);
 const reports=await prisma.progressReport.findMany({where:{organizationId,projectId},orderBy:{weekStart:"desc"},take:50});
 return NextResponse.json({reports});}catch(error){const r=toHttpError(error);return NextResponse.json({error:r.message},{status:r.status});}
}
export async function POST(request:NextRequest,context:{params:Promise<{organizationId:string;projectId:string}>}){
 try{const {organizationId,projectId}=await context.params;const actor=await requireTenantRole(organizationId,[MembershipRole.OWNER,MembershipRole.ADMIN,MembershipRole.PROJECT_MANAGER,MembershipRole.STAFF]);
 let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:"Payload JSON tidak valid."},{status:400})}
 const parsed=schema.safeParse(body);if(!parsed.success)return NextResponse.json({error:"Data laporan progres tidak valid.",issues:parsed.error.flatten()},{status:400});
 const input=parsed.data;const datePart=input.weekStart.slice(0,10).replaceAll("-","");
 const reportNumber=`LP-${datePart}-${randomUUID().slice(0,6).toUpperCase()}`;
 const report=await prisma.$transaction(async tx=>{
  const project=await tx.project.findFirst({where:{organizationId,id:projectId},select:{id:true,progress:true}});
  if(!project)return null;
  const created=await tx.progressReport.create({data:{
   organizationId,projectId,reportNumber,weekStart:new Date(input.weekStart),weekEnd:new Date(input.weekEnd),
   overallProgress:input.overallProgress,completedItems:input.completedItems as Prisma.InputJsonValue,
   nextWeekPlans:input.nextWeekPlans as Prisma.InputJsonValue,blockers:input.blockers,clientDecision:input.clientDecision,paymentStatus:input.paymentStatus,
  }});
  await tx.project.updateMany({where:{organizationId,id:projectId},data:{progress:input.overallProgress}});
  await tx.auditLog.create({data:{organizationId,actorId:actor.userId,action:"project.progress_report.created",entityType:"ProgressReport",entityId:created.id,beforeState:{progress:project.progress},afterState:{progress:input.overallProgress,reportNumber}}});
  return created;
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
 if(!report)return NextResponse.json({error:"Proyek tidak ditemukan."},{status:404});
 return NextResponse.json({report},{status:201});
 }catch(error){if(typeof error==="object"&&error!==null&&"code"in error&&error.code==="P2034")return NextResponse.json({error:"Perubahan bersamaan terdeteksi."},{status:409});const r=toHttpError(error);return NextResponse.json({error:r.message},{status:r.status});}
}
