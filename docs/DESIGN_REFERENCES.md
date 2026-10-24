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

## Video analysis and second visual pass

The 61-second clip was sampled across its full duration, then the assembly and cooling shots were inspected individually:

| Approximate time | Visible design cue | Application change |
| --- | --- | --- |
| 0–5 seconds | Dark rack faces with dense, warm gold cable runs | More distinct cable detail against the dark rack surfaces |
| 6–14 seconds | Open structural frame, overhead services and enclosure pieces moving into position | User-controlled Cutaway, Enclosed and Exploded views with a short transition |
| 15–22 seconds | White modular outer panels and a green band along the base | Repeated panel seams, pale shell material and green lower trim |
| 24–30 seconds | Separate cooling deck with circular fans above the container | A roof cooling layer that lifts away in the exploded view |
| 33–52 seconds | Repeated pods expanding to a campus | Kept as a future scale reference; the current dataset tracks one pod |
| 55–60 seconds | Final assembly view separates roof and enclosure layers | Clear layer separation with full-model camera framing |

The layer views explain how the enclosure surrounds the tracked components. Selecting a part returns to the cutaway so the physical part is visible. Reset view also restores the cutaway. The controls are unavailable in the fixed 2D elevation. Reduced-motion preferences remove the animated transition.

The clip is treated as a visual reference. Its hardware specifications and performance claims are not copied into the simulated delivery dataset, and the model is not an engineering reconstruction.
