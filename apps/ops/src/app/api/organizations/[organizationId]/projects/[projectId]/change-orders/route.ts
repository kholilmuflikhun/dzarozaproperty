import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { MembershipRole, Prisma, prisma } from "@dzaroza/database";
import { z } from "zod";
import { requireTenantContext, requireTenantRole, toHttpError } from "@/lib/tenant";

const itemSchema=z.object({kind:z.enum(["ADD","DEDUCT"]),description:z.string().trim().min(2).max(500),quantity:z.number().finite().positive().max(1_000_000),unit:z.string().trim().min(1).max(24),unitPrice:z.number().finite().min(0).max(999_999_999_999)});
const schema=z.object({reason:z.string().trim().max(500).optional(),notes:z.string().trim().max(4000).optional(),items:z.array(itemSchema).min(1).max(100)}).strict();

export async function GET(_request:NextRequest,context:{params:Promise<{organizationId:string;projectId:string}>}){
 try{const {organizationId,projectId}=await context.params;await requireTenantContext(organizationId);
 const rows=await prisma.changeOrder.findMany({where:{organizationId,projectId},include:{items:{orderBy:{sortOrder:"asc"}}},orderBy:{createdAt:"desc"}});
 return NextResponse.json({changeOrders:rows});}catch(error){const r=toHttpError(error);return NextResponse.json({error:r.message},{status:r.status});}
}
export async function POST(request:NextRequest,context:{params:Promise<{organizationId:string;projectId:string}>}){
 try{const {organizationId,projectId}=await context.params;const actor=await requireTenantRole(organizationId,[MembershipRole.OWNER,MembershipRole.ADMIN,MembershipRole.PROJECT_MANAGER]);
 let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:"Payload JSON tidak valid."},{status:400})}
 const parsed=schema.safeParse(body);if(!parsed.success)return NextResponse.json({error:"Data perubahan pekerjaan tidak valid.",issues:parsed.error.flatten()},{status:400});
 const items=parsed.data.items.map((item,index)=>{const amount=new Prisma.Decimal(item.quantity).mul(item.unitPrice).toDecimalPlaces(2);return {...item,quantity:new Prisma.Decimal(item.quantity),unitPrice:new Prisma.Decimal(item.unitPrice),lineTotal:amount,sortOrder:index}});
 const added=items.filter(i=>i.kind==="ADD").reduce((s,i)=>s.plus(i.lineTotal),new Prisma.Decimal(0));
 const deducted=items.filter(i=>i.kind==="DEDUCT").reduce((s,i)=>s.plus(i.lineTotal),new Prisma.Decimal(0));
 const net=added.minus(deducted).toDecimalPlaces(2);
 const number=`BA-KT-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${randomUUID().slice(0,6).toUpperCase()}`;
 const result=await prisma.$transaction(async tx=>{
  const project=await tx.project.findFirst({where:{organizationId,id:projectId},select:{id:true}});
  if(!project)return null;
  const order=await tx.changeOrder.create({data:{organizationId,projectId,number,reason:parsed.data.reason,notes:parsed.data.notes,addedTotal:added,deductedTotal:deducted,netTotal:net,items:{create:items}} ,include:{items:true}});
  await tx.auditLog.create({data:{organizationId,actorId:actor.userId,action:"project.change_order.created",entityType:"ChangeOrder",entityId:order.id,afterState:{number,addedTotal:added.toString(),deductedTotal:deducted.toString(),netTotal:net.toString(),status:"DRAFT"}}});
  return order;
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
 if(!result)return NextResponse.json({error:"Proyek tidak ditemukan."},{status:404});
 return NextResponse.json({changeOrder:result},{status:201});
 }catch(error){if(typeof error==="object"&&error!==null&&"code"in error&&error.code==="P2034")return NextResponse.json({error:"Perubahan bersamaan terdeteksi."},{status:409});const r=toHttpError(error);return NextResponse.json({error:r.message},{status:r.status});}
}
