# Design references incorporated on 24 October 2026

Carl supplied two recent Downloads files during implementation:

- `Bildschirmfoto 2026-10-24 um 11.34.23.png`: a procurement workspace with a light technical wireframe, searchable parts, filter controls, selectable markers and a part-inspection panel.
- `1024.mp4`: a 61-second NVIDIA DSX presentation showing a single rack, a long modular pod with repeated racks, roof framing and cable runs, then a larger installation.

These are visual references, not editable application source or a CAD/GLB model. Local working copies are in the ignored `work/design-references/` directory. The application does not embed the screenshot's people, customer identity or procurement records.

## Applied to FORMA

- A light drafting view with blue structural edges and translucent surfaces makes wireframe inspection readable.
- Repeated roof framing and cable details refine the procedural pod geometry.
- Find a part or supplier, then filter by delivery state. Matching markers and inventory rows stay synchronized; the global action count still covers the whole pod.
- The inspection panel shows the exact supplier, shipment, forecast, incident and recovery decision. Its action opens that component's recovery workflow.
- Reset view clears the filters and selected part, restores solid 3D and frames the whole pod.
- Simon's shared theme, controls, typography, motion and light/dark support remain the application's design system.

Delivery states remain derived from the simulated route dataset. The reference's procurement stages, owners and awards are not fabricated as operational data in this demo.
