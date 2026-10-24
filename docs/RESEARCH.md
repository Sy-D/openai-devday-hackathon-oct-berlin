# FORMA: research and modelling assumptions

Checked 24 October 2026. Primary sources only. This is a hackathon product hypothesis, not a validated factory operating model.

## What the sources establish

| Evidence | Product implication |
| --- | --- |
| Siemens describes additive manufacturing process management as tracking materials, printer utilisation and the complete order-to-shipment process, with scheduling, execution and monitoring. [Siemens process management](https://www.siemens.com/en-us/products/nx-manufacturing/additive-manufacturing/am-process-management/) | Show the whole production journey. A printer map alone cannot explain an order's delivery date. |
| Siemens' 2021 Schaeffler announcement describes connecting design engineers with the AM Fab Shop, guiding part qualification, and improving shop-floor and machine utilisation. [Siemens/Schaeffler announcement](https://news.siemens.com/en-us/siemens-additive-value-chain-schaeffler/) | Represent a factory's capability and a part's approval requirements before comparing route costs. This is evidence of an existing industry problem and existing solutions, not evidence that Schaeffler or Siemens currently lacks a solution. |
| NIST describes AM qualification challenges involving surface geometry, internal defects and mechanical properties. It also notes that post-process treatments, including heat treatment and machining, can affect those measurements. [NIST part qualification](https://www.nist.gov/programs-projects/additive-manufacturing-part-qualification) | Printing is not the final production stage. Include finishing and inspection time; do not treat a matching material as sufficient proof of qualification. The strongest qualification claims in the source concern critical applications. |
| NIST's 2023 publication describes isolated AM software, missed data reuse and integration needs across product, material and machine information. [NIST data integration](https://www.nist.gov/publications/additive-manufacturing-data-integration-and-recommended-practice) | Keep component requirements, capacity, transport and order status in one model so a changed queue affects the complete plan. |
| Siemens announced an order-to-delivery AM supplier network in 2019, including collaboration, cost analysis, production tracking and scheduling. [Siemens AM Network launch](https://news.siemens.com/en-us/siemens-opens-additive-manufacturing-network/) | The broad platform category already exists. The demo's proposed distinction is a clear decision workflow for assembling mixed printed and purchased parts after a disruption. That distinction still needs customer validation. |

## The demo's product hypothesis

When a supplier's queue changes, a planner should be able to answer: **Which feasible combination of production sites, assembly hub and transport can still meet this order's deadline, and what will that choice cost?**

The initial scenario is an order for twelve robotic gripper kits delivered to Berlin. A kit contains an SLS PA12 housing, LPBF AlSi10Mg fingers and a purchased pneumatic actuator. SLS and LPBF are different powder-bed printing processes; the demo treats their materials and factory approvals as explicit requirements. This part selection is illustrative, not an engineering approval or a claim that these materials suit a particular real gripper.

## Rules the interface should preserve

1. **Check eligibility before ranking.** A factory must support the part's process and material and meet the modelled qualification and capacity constraints. Show why an option is excluded.
2. **Keep purchased parts in the same schedule.** A non-printable component has inventory or supplier lead time and transport, not a fictional print job.
3. **Model parallel work and the assembly join.** For each component: queue + production + finishing/inspection + transport gives its arrival at assembly. Assembly starts after the latest component arrives and an assembly slot is available. Then add assembly, final QA and final transport.
4. **Compare full-order costs.** Include every component's production or purchase cost, all transport legs and assembly. A cheaper print quote can create a more expensive or slower complete order.
5. **Keep forecast and history distinct.** Historical on-time delivery is delivered-on-time orders divided by delivered orders. An active order's deadline buffer is due time minus forecast arrival time. A synthetic confidence score is not a calibrated probability or a delivery guarantee.
6. **Require a visible plan confirmation.** An assistant may explain and recommend an existing plan. It must not silently place orders, reserve real capacity or change the selected production plan.

## Deliberate simplifications

All factories, supplier relationships, orders, capacity numbers, prices, transport times and confidence scores are synthetic. The demo uses pre-approved part requirements; it does not infer printability from a CAD file. Routes are a planning illustration, not navigation instructions. It does not simulate build nesting, machine failures, material lots, working calendars, customs, real carrier prices, real reservations or certification records. Any emissions figure must also be labelled synthetic unless a documented calculation is added.

## Questions to validate after the hackathon

- Who owns the final routing decision: central planning, the AM service bureau, procurement or assembly operations?
- Which constraint usually invalidates the cheapest option: qualification, geometry, material availability, machine queue, post-processing or transport?
- Does assembly wait for one batch of all components, or can partial batches ship separately?
- Which live system can supply a reliable capacity and completion-time forecast?
- What historical data would calibrate delivery risk and make a recommendation trustworthy?

Do not present the hackathon dataset as Siemens or Schaeffler operating data, or claim that either company's current supply chain is failing. The sources establish the category and constraints, not those stronger claims.
