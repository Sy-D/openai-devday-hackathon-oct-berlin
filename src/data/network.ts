export type Process = 'SLS' | 'LPBF' | 'FDM' | 'Purchased';
export type SiteKind = 'print' | 'assembly' | 'supplier' | 'customer';
export type Factory = {
  id: string; name: string; city: string; country: string; kind: SiteKind;
  coordinates: [number, number]; processes: Process[]; materials: string[];
  capacity: number; utilization: number; queueHours: number; productionHours: number;
  unitCost: number; reliability: number; qualification: string;
};
export const factories: Factory[] = [
  { id:'eindhoven', name:'Layerworks', city:'Eindhoven', country:'Netherlands', kind:'print', coordinates:[5.48,51.44], processes:['SLS'],materials:['PA12'],capacity:120,utilization:64,queueHours:4,productionHours:18,unitCost:32,reliability:.98,qualification:'ISO 9001' },
  { id:'dresden', name:'Elbe Additive', city:'Dresden', country:'Germany', kind:'print',coordinates:[13.74,51.05],processes:['LPBF'],materials:['AlSi10Mg'],capacity:80,utilization:78,queueHours:8,productionHours:26,unitCost:71,reliability:.96,qualification:'ISO 9001' },
  { id:'munich', name:'Precision Hub', city:'Munich', country:'Germany',kind:'print',coordinates:[11.58,48.14],processes:['LPBF'],materials:['AlSi10Mg','316L'],capacity:96,utilization:42,queueHours:0,productionHours:18,unitCost:96,reliability:.99,qualification:'ISO 9001' },
  { id:'poznan', name:'Forma Polska', city:'Poznań', country:'Poland',kind:'print',coordinates:[16.93,52.4],processes:['SLS'],materials:['PA12'],capacity:160,utilization:88,queueHours:16,productionHours:20,unitCost:24,reliability:.94,qualification:'ISO 9001' },
  { id:'vienna',name:'Danube Metal',city:'Vienna',country:'Austria',kind:'print',coordinates:[16.37,48.21],processes:['LPBF'],materials:['AlSi10Mg'],capacity:64,utilization:92,queueHours:18,productionHours:26,unitCost:53,reliability:.92,qualification:'ISO 9001' },
  { id:'lyon',name:'Atelier 3D',city:'Lyon',country:'France',kind:'print',coordinates:[4.83,45.76],processes:['FDM'],materials:['PETG'],capacity:100,utilization:54,queueHours:6,productionHours:20,unitCost:20,reliability:.95,qualification:'ISO 9001' },
  { id:'leipzig',name:'Central Assembly',city:'Leipzig',country:'Germany',kind:'assembly',coordinates:[12.37,51.34],processes:[],materials:[],capacity:48,utilization:62,queueHours:0,productionHours:8,unitCost:19,reliability:.99,qualification:'ISO 9001' },
  { id:'prague',name:'Bohemia Assembly',city:'Prague',country:'Czechia',kind:'assembly',coordinates:[14.44,50.08],processes:[],materials:[],capacity:60,utilization:73,queueHours:0,productionHours:10,unitCost:15,reliability:.97,qualification:'ISO 9001' },
  { id:'brno',name:'Motion Components',city:'Brno',country:'Czechia',kind:'supplier',coordinates:[16.61,49.2],processes:['Purchased'],materials:['Pneumatic actuator'],capacity:200,utilization:30,queueHours:0,productionHours:12,unitCost:38,reliability:.99,qualification:'ISO 9001' },
  { id:'berlin',name:'Nordwerk Robotics',city:'Berlin',country:'Germany',kind:'customer',coordinates:[13.4,52.52],processes:[],materials:[],capacity:0,utilization:0,queueHours:0,productionHours:0,unitCost:0,reliability:1,qualification:'' },
];
export type Part = { id:string; name:string; description:string; process:Process; material:string; perKit:number; qualification:string; };
export const parts: Part[] = [
  {id:'housing',name:'Gripper housing',description:'Polymer enclosure',process:'SLS',material:'PA12',perKit:1,qualification:'ISO 9001'},
  {id:'fingers',name:'Gripper fingers',description:'Precision metal pair',process:'LPBF',material:'AlSi10Mg',perKit:2,qualification:'ISO 9001'},
  {id:'actuator',name:'Pneumatic actuator',description:'Purchased component',process:'Purchased',material:'Pneumatic actuator',perKit:1,qualification:'ISO 9001'},
];
export type Order = { id:string; name:string; customer:string; quantity:number; dueHours:number; state:'action'|'production'|'transit'|'planned'; priority:'Critical'|'Standard'; baselineEta:number; value:number; };
const names = ['Robotic gripper kit','Compact gripper kit','Fixture gripper kit','Inspection gripper kit','Conveyor gripper kit','Automation gripper kit'];
const customers = ['Nordwerk Robotics','Atlas Automation','Kraft Systems','Nexa Industrial','Vector Motion','Feldwerk'];
export const orders:Order[] = Array.from({length:24},(_,i)=>({
  id:`FM-${2048-i}`, name:names[i%names.length],customer:customers[i%customers.length],
  quantity:[12,24,8,16,20,10][i%6],dueHours:i===0?60:[72,48,96,80,120][(i-1+5)%5],
  state:i===0||i===7||i===16?'action':i%5===3?'transit':'production',
  priority:i===0||i===7?'Critical':'Standard',baselineEta:i===0?72:i===7?85:i===16?105:36+(i%4)*8,value:[6800,9240,3800,7600,8200,4300][i%6],
})).map(order=>({...order,baselineEta:order.state==='action'?order.baselineEta:Math.min(order.baselineEta,order.dueHours-6)})) as Order[];
export const demoStart = new Date('2026-10-27T08:00:00+01:00');
export const money = (n:number) => new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n);
export const arrivalLabel = (hours:number) => new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Berlin'}).format(new Date(demoStart.getTime()+hours*3600000));
export const duration = (hours:number) => hours>=24 ? `${Math.floor(hours/24)}d ${hours%24}h` : `${hours}h`;
