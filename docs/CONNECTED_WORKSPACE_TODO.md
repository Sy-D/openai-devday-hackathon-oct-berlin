# Connected procurement workspace

User objective: one two-minute path from a selectable real product to a sourced offer, current incident exposure, alternate delivery routes and a quantified decision.

## Plan and verification

- [ ] **In progress — Product and transport evidence:** verify exact SKU offers, price/VAT/availability wording, timestamp and ordering links for all ten categories; distinguish verified dispatch or pickup sites from company addresses. Use quote-required states wherever no public price is available. Check sources directly.
- [ ] **Pending — Routing and impact:** connect a live road-routing service, retain actual geometry and compute incident proximity plus validity windows. Show route distance/driving time, deadline buffer and cost/emissions only from explicit inputs and cited factors. Test geometry, units, stale sources and unavailable-provider behavior.
- [ ] **Pending — Connected interface:** model → offer → delivery inputs → incident evidence → alternatives → saved decision and measured change. Preserve the selected part across pages; live updates reopen affected decisions. Keep the old simulated planner clearly separated. Verify the path in a browser on desktop and mobile.
- [ ] **Pending — Test and publish:** run unit/API checks, production build, lint, relevant browser flows and a live source/routing smoke. Refresh localhost, commit/push/PR/merge after checks. Update Page, Notion and Excalidraw after implementation.

## Boundaries

No purchasing or carrier booking. Seller listings do not prove reserved inventory, and company addresses do not prove shipment origins. Calculated routes are plans; driving-time models and emissions factors are estimates, not observed shipment outcomes. Real arrival guarantees and freight prices require a carrier quote. Missing evidence stays unknown.

Destination/deadline clarification requested; Berlin is the proposed editable default destination. Do not invent a required arrival time.
