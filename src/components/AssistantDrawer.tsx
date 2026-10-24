import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUp, Check, LoaderCircle, Sparkles, X } from 'lucide-react';
import { duration, money, type Factory, type Order } from '../data/network';
import { type Plan, type PlanId } from '../lib/planner';

type Message = {role:'user'|'assistant';text:string;planId?:PlanId;mode?:'live'|'demo'};
export default function AssistantDrawer({order,plans,factories,selectedPlanId,onSelect,onClose}:{order:Order;plans:Plan[];factories:Factory[];selectedPlanId:PlanId;onSelect:(id:PlanId)=>void;onClose:()=>void}){
  const [messages,setMessages]=useState<Message[]>([]),[input,setInput]=useState(''),[busy,setBusy]=useState(false),[providerLabel,setProviderLabel]=useState('Checking assistant connection…'),[error,setError]=useState('');
  const bottom=useRef<HTMLDivElement>(null),inputRef=useRef<HTMLInputElement>(null),requestStarted=useRef(false);
  useEffect(()=>{inputRef.current?.focus();const controller=new AbortController();fetch('/api/health',{signal:controller.signal}).then(r=>r.ok?r.json():Promise.reject()).then(d=>{if(requestStarted.current)return;setProviderLabel(d.mode==='live'?(d.ready&&d.status==='verified'?'Connected to OpenAI':d.status==='unavailable'?'OpenAI unavailable · demo fallback':'OpenAI configured · connection unverified'):'Demo assistant · no API key configured');}).catch(()=>{if(!controller.signal.aborted&&!requestStarted.current)setProviderLabel('Assistant server unavailable');});return()=>controller.abort();},[]);
  useEffect(()=>{bottom.current?.scrollIntoView({behavior:'smooth'});},[messages,busy]);
  async function send(text:string){
    if(busy||!text.trim())return;requestStarted.current=true;setInput('');setError('');setMessages(m=>[...m,{role:'user',text}]);setBusy(true);
    try{
      const response=await fetch('/api/assistant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text,context:{order,plans,factories,selectedPlanId}}),signal:AbortSignal.timeout(35000)});
      const data=await response.json();if(!response.ok)throw new Error(data.error||'Assistant request failed.');
      // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Validate the API response at the network boundary before displaying its reply; plan IDs are checked against current feasible plans below.
      if(typeof data.reply!=='string'||!['live','demo'].includes(data.mode))throw new Error('The assistant returned an invalid response.');
      const valid=plans.find(p=>p.id===data.suggestedPlanId&&p.feasible);
      setProviderLabel(data.mode==='live'?'Connected to OpenAI':data.reason==='provider_unavailable'?'Demo fallback · OpenAI request unavailable':'Demo assistant · no API key configured');setMessages(m=>[...m,{role:'assistant',text:data.reply,planId:valid?.id,mode:data.mode}]);
    }catch(e){setProviderLabel('Assistant request failed · review connection');setError(e instanceof Error?e.message:'The assistant is unavailable. You can still compare and assign plans manually.');}
    finally{setBusy(false);}
  }
  return <div className="drawer-backdrop" onClick={onClose}><aside className="assistant-drawer" role="dialog" aria-modal="true" aria-labelledby="assistant-title" onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape')onClose();}}>
    <header className="drawer-header"><div className="assistant-symbol"><Sparkles size={20}/></div><div><h2 id="assistant-title">Your planning copilot</h2><p>{providerLabel}</p></div><button className="icon-button" onClick={onClose} aria-label="Close copilot"><X size={20}/></button></header>
    <div className="assistant-order"><span className="live-dot"/><span>Working on <strong>{order.id}</strong> · {order.quantity} kits · deadline {duration(order.dueHours)}</span></div>
    <div className="chat-body">{messages.length===0&&<div className="chat-welcome"><div className="large-spark"><Sparkles size={30}/></div><h3>A clearer path<br/>from part to delivery.</h3><p>Compare the real options in this demo. I can explain the trade-offs and suggest a plan for you to review.</p><div className="suggested-prompts">{['What is the cheapest way to deliver on time?','Which plan gets this order there fastest?','Why can’t every factory print these parts?'].map(q=><button key={q} onClick={()=>send(q)}>{q}<ArrowUp size={16}/></button>)}</div></div>}
    {messages.map((message,i)=><div key={i} className={`chat-message ${message.role}`}>{message.role==='assistant'&&<span className="chat-avatar"><Sparkles size={14}/></span>}<div><p>{message.text}</p>{message.planId&&<button className="chat-plan-button" onClick={()=>onSelect(message.planId!)}>{selectedPlanId===message.planId?<Check size={15}/>:<ArrowRight size={15}/>}Review {plans.find(p=>p.id===message.planId)?.name} · {money(plans.find(p=>p.id===message.planId)!.totalCost)}</button>}{message.mode==='demo'&&<small>Deterministic demo response</small>}</div></div>)}
    {busy&&<div className="assistant-thinking"><LoaderCircle size={17} className="spin"/>Comparing your production options…</div>}{error&&<p className="chat-error" role="alert">{error} You can still select a plan in the dashboard.</p>}<div ref={bottom}/></div>
    <form className="chat-form" onSubmit={e=>{e.preventDefault();send(input);}}><div><input ref={inputRef} aria-label="Ask the planning copilot" placeholder="Ask about this order…" value={input} onChange={e=>setInput(e.target.value)} maxLength={2000}/><button type="submit" aria-label="Send message" disabled={busy||!input.trim()}><ArrowUp size={19}/></button></div><p>Suggestions only. You confirm every production plan.</p></form>
  </aside></div>;
}
