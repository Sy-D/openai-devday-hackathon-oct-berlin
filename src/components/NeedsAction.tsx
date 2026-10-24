import { useState } from 'react';
import { ArrowRight, CheckCheck, ChevronDown, TriangleAlert } from 'lucide-react';
import type { OrderAction } from '../lib/actions';

export default function NeedsAction({ actions, onOpen }: { actions: OrderAction[]; onOpen: (action: OrderAction) => void }) {
  const [expanded, setExpanded] = useState(false);
  return <section className={`needs-action ${actions.length ? '' : 'all-clear'}`} aria-labelledby="needs-action-title">
    <div className="action-heading">
      <span className="action-heading-icon">{actions.length ? <TriangleAlert size={18}/> : <CheckCheck size={18}/>}</span>
      <div><h2 id="needs-action-title">{actions.length ? 'Needs action' : 'No actions required'} {actions.length > 0 && <span>{actions.length}</span>}</h2>
        <p>{actions.length ? 'Start here. These orders need a decision to stay on track.' : 'Every order has an on-time plan or is progressing on track in this demo.'}</p></div>
      {actions.length > 0 && <span className="action-live-label">Updated with your scenario</span>}
    </div>
    {actions.length > 0 && <div className="action-grid" id="needs-action-orders">{(expanded ? actions : actions.slice(0, 3)).map(action => <article className="order-action" key={action.order.id} data-testid={`action-${action.order.id}`}>
      <div className="action-order"><strong>{action.order.id}</strong><span>{action.order.priority === 'Critical' ? 'Priority order' : 'Review required'}</span></div>
      <h3>{action.reason}</h3><p>{action.detail}</p>
      <button onClick={() => onOpen(action)} aria-label={`${action.nextStep} for ${action.order.id}`}>{action.nextStep}<ArrowRight size={15}/></button>
    </article>)}</div>}
    {actions.length > 3 && <button className="action-expand" type="button" aria-expanded={expanded} aria-controls="needs-action-orders" onClick={() => setExpanded(!expanded)}>{expanded ? 'Show fewer orders' : `Show all ${actions.length} orders`}<ChevronDown size={14} style={{transform: expanded ? 'rotate(180deg)' : undefined}}/></button>}
  </section>;
}
