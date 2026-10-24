import { factories, orders, parts, type Factory, type Order, type Part } from '../data/network';
import { scenarioChanged, validScenario } from './scenario';

export type PlanId = 'economy'|'balanced'|'express';
export type Leg = { partId:string; factoryId:string; destinationId:string; quantity:number; readyHours:number; transportHours:number; arrivalHours:number; cost:number; transportCost:number; distanceKm:number; };
export type Plan = { id:PlanId;name:string;description:string;assemblyId:string;legs:Leg[];finalTransportHours:number;assemblyHours:number;assemblyStart:number;totalCost:number;productionCost:number;transportCost:number;assemblyCost:number;etaHours:number;deadlineHours:number;bufferHours:number;confidence:number;co2Kg:number;distanceKm:number;feasible:boolean;issues:string[]; };
const configurations = {
  economy: { name:'Lowest cost',description:'Consolidated ground transport',sources:['poznan','vienna','brno'],assembly:'prague',shipping:[9,7,3],shippingCosts:[110,100,45],assemblyHours:10,finalHours:11,finalCost:145,co2:31 },
  balanced: { name:'Balanced',description:'A little more room to deliver',sources:['eindhoven','dresden','brno'],assembly:'leipzig',shipping:[8,3,5],shippingCosts:[190,75,90],assemblyHours:8,finalHours:4,finalCost:95,co2:42 },
  express: { name:'Fastest',description:'Priority production · direct courier',sources:['eindhoven','munich','brno'],assembly:'leipzig',shipping:[4,4,3],shippingCosts:[330,290,160],assemblyHours:6,finalHours:2,finalCost:180,co2:68 },
};
export const siteById = (id:string) => { const site=factories.find(f=>f.id===id);if(!site)throw new Error(`Unknown site: ${id}`);return site; };
export function compatibility(factory:Factory,part:Part,quantity:number):string[] {
  const issues:string[]=[];
  if(!factory.processes.includes(part.process))issues.push(`${part.process} process unavailable`);
  if(!factory.materials.includes(part.material))issues.push(`${part.material} material unavailable`);
  if(factory.qualification!==part.qualification)issues.push('Required qualification unavailable');
  if(quantity>factory.capacity)issues.push(`Capacity ${factory.capacity} below required ${quantity}`);
  return issues;
}
export function distance(a:Factory,b:Factory) {
  const r=Math.PI/180,[x1,y1]=a.coordinates,[x2,y2]=b.coordinates;
  const h=Math.sin((y2-y1)*r/2)**2+Math.cos(y1*r)*Math.cos(y2*r)*Math.sin((x2-x1)*r/2)**2;
  return Math.round(6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h))*1.2);
}
export function createPlans(order:Order,disrupted=false):Plan[] {
  if(!validScenario(order))throw new RangeError('Order quantity and deadline must be whole numbers within the simulated scenario limits.');
  return (Object.keys(configurations) as PlanId[]).map(id=>{
    const config=configurations[id],assembly=siteById(config.assembly),issues:string[]=[];
    const legs=parts.map((part,i)=>{
      const factory=siteById(config.sources[i]),quantity=order.quantity*part.perKit;
      issues.push(...compatibility(factory,part,quantity).map(issue=>`${factory.city}: ${issue}`));
      const readyHours=factory.queueHours+factory.productionHours+(disrupted&&factory.id==='dresden'?24:0);
      return {partId:part.id,factoryId:factory.id,destinationId:assembly.id,quantity,readyHours,transportHours:config.shipping[i],arrivalHours:readyHours+config.shipping[i],cost:factory.unitCost*quantity,transportCost:config.shippingCosts[i],distanceKm:distance(factory,assembly)};
    });
    if(order.quantity>assembly.capacity)issues.push(`${assembly.city}: insufficient assembly capacity`);
    // Printing is one capacity-limited batch; hands-on assembly scales from a 12-kit reference order.
    const assemblyHours=Math.max(1,Math.ceil(config.assemblyHours*order.quantity/12));
    const assemblyStart=Math.max(...legs.map(l=>l.arrivalHours)),etaHours=assemblyStart+assemblyHours+config.finalHours;
    const productionCost=legs.reduce((s,l)=>s+l.cost,0),transportCost=legs.reduce((s,l)=>s+l.transportCost,config.finalCost);
    const assemblyCost=order.quantity*assembly.unitCost*(id==='express'?1.4:1);
    const bufferHours=order.dueHours-etaHours;
    const confidence=Math.round(100*legs.reduce((p,l)=>p*siteById(l.factoryId).reliability,assembly.reliability)*(bufferHours<0?.66:bufferHours<6?.93:1));
    return {id,name:config.name,description:config.description,assemblyId:assembly.id,legs,finalTransportHours:config.finalHours,assemblyHours,assemblyStart,totalCost:Math.round(productionCost+transportCost+assemblyCost),productionCost,transportCost,assemblyCost:Math.round(assemblyCost),etaHours,deadlineHours:order.dueHours,bufferHours,confidence,co2Kg:config.co2,distanceKm:legs.reduce((s,l)=>s+l.distanceKm,distance(assembly,siteById('berlin'))),feasible:issues.length===0,issues};
  });
}
export function recommendedPlan(plans:Plan[]):Plan|undefined {
  return [...plans].filter(p=>p.feasible&&p.bufferHours>=0).sort((a,b)=>a.totalCost-b.totalCost)[0];
}
export type Assignment = {orderId:string;planId:PlanId;cost:number;etaHours:number;assignedAt:string;quantity?:number;dueHours?:number;};
export function assignmentReview(order:Order,assigned:Assignment,disrupted=false):string[] {
  const plan=createPlans(order,disrupted).find(p=>p.id===assigned.planId)!;
  const original=orders.find(item=>item.id===order.id);
  const reasons:string[]=[];
  if(!plan.feasible)reasons.push(`The confirmed ${plan.name} plan is no longer feasible. ${plan.issues.join('. ')}.`);
  else if(plan.bufferHours<0)reasons.push(`The confirmed ${plan.name} plan misses the current deadline by ${-plan.bufferHours}h.`);
  if(order.quantity!==(assigned.quantity??original?.quantity)||order.dueHours!==(assigned.dueHours??original?.dueHours))reasons.push('Order inputs changed since confirmation. Review the new costs and reconfirm a plan.');
  else if(!reasons.length&&(plan.totalCost!==assigned.cost||plan.etaHours!==assigned.etaHours))reasons.push('Production estimates changed since confirmation. Review and reconfirm the updated plan.');
  return reasons;
}
export function orderStatus(order:Order,assignments:Record<string,Assignment>,disrupted=false):Order['state'] {
  const assigned=assignments[order.id];
  if(!assigned)return scenarioChanged(order)?'action':order.state;
  return assignmentReview(order,assigned,disrupted).length?'action':'planned';
}
