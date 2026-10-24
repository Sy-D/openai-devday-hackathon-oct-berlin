import { useState } from 'react';
import { ArrowUpRight, Box, Layers3, MapPin, Minus, Plus, Route, X } from 'lucide-react';
import { factories, parts, type Factory } from '../data/network';
import { compatibility, siteById, type Plan } from '../lib/planner';

// Intentionally simplified geographic outlines. Transit times come from the demo data,
// not these schematic paths. No map service or API key is needed to run the demo.
const countries = [
  {name:'FRANCE',label:[2.3,47.3],points:[[-4.8,48.5],[-1.7,48.7],[-1.9,49.7],[.2,49.7],[1.6,50.9],[2.6,50.7],[4.2,49.9],[5.9,49.5],[6.5,49],[8.2,48.9],[7.5,47.6],[6.8,47.5],[6,46.2],[7,45.9],[6.6,45.1],[7.7,44.2],[7.4,43.7],[5.5,43.2],[3.2,43.3],[2.9,42.5],[.7,42.8],[-1.8,43.3],[-1.4,46.3],[-2.4,47.5],[-4.8,48.5]]},
  {name:'GERMANY',label:[9.4,51.3],points:[[6.1,50.1],[6.2,51.8],[7.1,52.3],[7.1,53.4],[8.5,53.6],[8.6,54.9],[9.9,54.8],[10.9,54.3],[11.4,54.4],[12.4,54.5],[13.9,54.1],[14.2,53.9],[14.6,52.8],[14.8,51.8],[15,51],[14.3,50.9],[13.5,50.5],[12.2,50.3],[12.1,49.8],[13.6,48.6],[12.8,48.1],[13,47.5],[11.8,47.6],[10.5,47.3],[9.6,47.5],[8.6,47.6],[7.5,47.6],[8.2,48.9],[6.5,49],[6.1,50.1]]},
  {name:'POLAND',label:[19.2,52.9],points:[[14.2,53.9],[16.3,54.2],[18.3,54.8],[19.7,54.4],[22.7,54.4],[23.5,53.5],[23.8,52.5],[23.6,51.5],[24.2,50.8],[22.7,49.1],[20.9,49.4],[19.8,49.2],[18.9,49.6],[17.7,50.3],[16.6,50.2],[15,51],[14.8,51.8],[14.6,52.8],[14.2,53.9]]},
  {name:'CZECHIA',label:[15.8,50.1],points:[[12.2,50.3],[13.5,50.5],[14.3,50.9],[15,51],[16.6,50.2],[17.7,50.3],[18.9,49.6],[17.7,48.8],[16.9,48.6],[15,49],[14.7,48.6],[13.8,48.6],[13.6,48.6],[12.1,49.8],[12.2,50.3]]},
  {name:'AUSTRIA',label:[13.8,47.5],points:[[9.6,47.5],[10.5,47.3],[11.8,47.6],[13,47.5],[12.8,48.1],[13.6,48.6],[14.7,48.6],[15,49],[16.9,48.6],[17.1,48],[16.5,47.7],[16.4,46.9],[14.5,46.5],[13.5,46.6],[12.2,46.7],[10.5,46.8],[9.6,47.5]]},
  {name:'SWITZERLAND',label:[8.1,46.6],points:[[6,46.2],[6.8,47.5],[7.5,47.6],[8.6,47.6],[9.6,47.5],[10.5,46.8],[10,46.3],[9.3,46.5],[9,45.8],[8.4,46.4],[7.1,45.8],[6,46.2]]},
  {name:'NETHERLANDS',label:[4.6,53.0],points:[[3.4,51.4],[4.2,51.4],[4.9,51.5],[5.9,50.8],[6.1,51.8],[7.1,52.3],[7.1,53.4],[6.5,53.6],[5.2,53.4],[4.6,52.9],[3.4,51.4]]},
  {name:'BELGIUM',label:[3.7,50.4],points:[[2.6,50.7],[3.4,51.4],[4.2,51.4],[4.9,51.5],[5.9,50.8],[6.1,50.1],[5.9,49.5],[4.2,49.9],[2.6,50.7]]},
  {name:'ITALY',label:[11.9,45.0],points:[[6.6,45.1],[7,45.9],[7.1,45.8],[8.4,46.4],[9,45.8],[9.3,46.5],[10,46.3],[10.5,46.8],[12.2,46.7],[13.5,46.6],[13.7,45.7],[12.3,45.5],[12.3,44.6],[13.1,43.8],[15,42],[14.5,41.5],[12,42.7],[10.2,44],[8.8,44.4],[7.7,44.2],[6.6,45.1]]},
  {name:'SLOVAKIA',label:[19.8,48.7],points:[[16.9,48.6],[17.7,48.8],[18.9,49.6],[19.8,49.2],[20.9,49.4],[22.7,49.1],[22.2,48.4],[20.5,48.6],[19,48],[17.1,48],[16.9,48.6]]},
  {name:'HUNGARY',label:[19.7,46.9],points:[[17.1,48],[19,48],[20.5,48.6],[22.2,48.4],[22.8,47.7],[21.1,46.3],[20.3,46.1],[18.4,45.8],[16.4,46.9],[16.5,47.7],[17.1,48]]},
  {name:'DENMARK',label:[9.8,55.5],points:[[8.6,54.9],[8.2,55.6],[8.6,56.6],[9.9,57.7],[10.6,57.1],[10.3,56.4],[10.8,55.9],[9.9,55.7],[9.9,54.8],[8.6,54.9]]},
];
const xy = ([lon,lat]:number[]) => [lon*33.2,(55.5-lat)*49];
const labelOffsets:Record<string,[number,number]>={eindhoven:[-18,26],dresden:[24,6],munich:[-8,27],poznan:[12,-16],vienna:[15,21],lyon:[12,23],leipzig:[-78,-16],prague:[-70,5],brno:[18,0],berlin:[14,-15]};
const curve = (from:Factory,to:Factory,index:number) => {const [x1,y1]=xy(from.coordinates),[x2,y2]=xy(to.coordinates);return `M ${x1} ${y1} Q ${(x1+x2)/2+(index%2?28:-22)} ${(y1+y2)/2-32} ${x2} ${y2}`;};

export default function NetworkMap({plan,orderQuantity,onInspect,disrupted}:{plan:Plan;orderQuantity:number;onInspect?:(factory:Factory)=>void;disrupted:boolean}){
  const [zoom,setZoom]=useState(1),[inspected,setInspected]=useState<string|null>(null);
  const active=new Set([...plan.legs.map(l=>l.factoryId),plan.assemblyId,'berlin']);
  const selected=inspected?siteById(inspected):null;
  const inspect=(factory:Factory)=>{setInspected(factory.id);onInspect?.(factory);};
  return <div className="network-map">
    <div className="map-caption"><span className="live-dot"/> European production network <span className="map-caption-count">10 locations</span></div>
    <svg className="map-svg" viewBox="0 0 800 510" role="img" aria-label={`European production network showing the ${plan.name} route to Berlin`}>
      <defs><pattern id="water" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".6" fill="#d9e3df"/></pattern><filter id="nodeShadow"><feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#263f38" floodOpacity=".13"/></filter></defs>
      <rect width="800" height="510" fill="#edf2ee"/><rect width="800" height="510" fill="url(#water)"/>
      <g transform={`translate(${400*(1-zoom)} ${255*(1-zoom)}) scale(${zoom})`}>
        {countries.map(c=><g key={c.name}><path d={c.points.map((p,i)=>`${i?'L':'M'} ${xy(p).join(' ')}`).join(' ')+' Z'} fill={c.name==='GERMANY'?'#f8faf6':'#f4f6f1'} stroke="#d5ded5" strokeWidth="1.25"/>
          <text x={xy(c.label)[0]} y={xy(c.label)[1]} className="country-label">{c.name}</text></g>)}
        {plan.legs.map((leg,i)=><g key={leg.partId}><path d={curve(siteById(leg.factoryId),siteById(plan.assemblyId),i)} fill="none" stroke="#fff" strokeWidth="6"/><path d={curve(siteById(leg.factoryId),siteById(plan.assemblyId),i)} fill="none" stroke={leg.partId==='actuator'?'#b28f62':'#398b76'} strokeWidth="2.5" strokeDasharray={leg.partId==='actuator'?'5 6':undefined} className="route-path"/></g>)}
        <path d={curve(siteById(plan.assemblyId),siteById('berlin'),0)} fill="none" stroke="white" strokeWidth="7"/>
        <path d={curve(siteById(plan.assemblyId),siteById('berlin'),0)} fill="none" stroke="#213f35" strokeWidth="3.5" className="route-path"/>
        {factories.map(factory=>{const [x,y]=xy(factory.coordinates),[dx,dy]=labelOffsets[factory.id],isActive=active.has(factory.id);return <g key={factory.id} role="button" tabIndex={0} aria-label={`Inspect ${factory.name}, ${factory.city}`} onClick={()=>inspect(factory)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();inspect(factory);}}} className={`map-node ${isActive?'active':'inactive'}`}>
          {isActive&&<circle cx={x} cy={y} r={factory.kind==='customer'?20:17} fill={factory.kind==='customer'?'#213f3510':'#2e8e7615'}/>}
          {factory.kind==='assembly'?<rect x={x-9} y={y-9} width="18" height="18" rx="5" fill={isActive?'#fff':'#e2e8df'} stroke={isActive?'#43846e':'#b5c4b6'} strokeWidth="2.5" transform={`rotate(45 ${x} ${y})`}/>:<circle cx={x} cy={y} r={factory.kind==='customer'?10:8} fill={factory.kind==='customer'?'#213f35':factory.kind==='supplier'?'#b18d60':isActive?'#3b8c76':'#bac9bd'} stroke="white" strokeWidth="3" filter="url(#nodeShadow)"/>}
          {factory.id==='dresden'&&disrupted&&<circle cx={x+8} cy={y-8} r="5" fill="#d47c35" stroke="white" strokeWidth="2"/>}
          <text x={x+dx} y={y+dy} className={`city-label ${factory.kind==='customer'?'destination-label':''}`}>{factory.city}</text>
          {factory.kind==='customer'&&<text x={x+dx} y={y+dy+15} className="destination-sub">CUSTOMER</text>}
        </g>;})}
      </g>
    </svg>
    <div className="map-legend"><span><i className="legend-dot"/> Print center</span><span><i className="legend-diamond"/> Assembly</span><span><i className="legend-dot supplier"/> Supplier</span></div>
    <div className="map-controls"><button aria-label="Zoom in" onClick={()=>setZoom(z=>Math.min(1.7,+(z+.2).toFixed(1)))} disabled={zoom>=1.7}><Plus size={16}/></button><button aria-label="Zoom out" onClick={()=>setZoom(z=>Math.max(1,+(z-.2).toFixed(1)))} disabled={zoom<=1}><Minus size={16}/></button></div>
    <div className="map-attribution">Illustrative routes · synthetic transit data</div>
    {selected&&<div className="facility-popover" role="dialog" aria-label={`${selected.name} details`}>
      <button className="icon-button popover-close" aria-label="Close facility details" onClick={()=>setInspected(null)}><X size={15}/></button>
      <div className="eyebrow">{selected.kind==='print'?'PRINT CENTER':selected.kind.toUpperCase()}</div><h3>{selected.name}</h3><p><MapPin size={13}/>{selected.city}, {selected.country}</p>
      {selected.kind==='print'?<><div className="tag-row">{selected.processes.map(p=><span className="tag" key={p}>{p}</span>)}{selected.materials.map(m=><span className="tag neutral" key={m}>{m}</span>)}</div><div className="facility-stats"><span><b>{selected.capacity}</b> parts / batch</span><span><b>{selected.queueHours+(selected.id==='dresden'&&disrupted?24:0)}h</b> queue</span></div><div className="compatibility-note">{parts.filter(p=>compatibility(selected,p,orderQuantity*p.perKit).length===0).length? <><Box size={14}/> Qualified for {parts.filter(p=>compatibility(selected,p,orderQuantity*p.perKit).length===0).map(p=>p.name.toLowerCase()).join(', ')}</>:<><X size={14}/> No compatible parts in this order</>}</div></>:<div className="compatibility-note">{selected.kind==='assembly'?<><Layers3 size={14}/> All components meet here before delivery</>:selected.kind==='supplier'?<><Box size={14}/> Purchased actuator · 12h preparation</>:<><ArrowUpRight size={14}/> Final destination for this order</>}</div>}
    </div>}
    <div className="map-summary"><Route size={17}/><div><strong>{plan.distanceKm.toLocaleString()} km</strong><span>combined route distance</span></div><div className="summary-separator"/><div><strong>{plan.legs.length+1} legs</strong><span>door to door</span></div></div>
  </div>;
}
