# Interactive POD delivery overview

The initial view is a procedural, selectable 3D container inspired by NVIDIA DSX POD. It tracks delivery readiness rather than claiming that a machine is physically operating. Ten part groups include compute racks, networking, storage, power, cooling, optics, controls and the enclosure/roof. The existing supplier interface is retained at `/suppliers`; the earlier manufacturing demo remains at `/planning`.

## Shared frontend design

Simon’s frontend provides the theme tokens, typography, rounded panels, Button, Card, Select, Checkbox, Dialog and Sheet controls, light/dark mode and motion for the DSX screens and the existing production planner. Supplier intelligence remains a separate workflow, using the same design template.

See [the supplied design references](DESIGN_REFERENCES.md) for the wireframe and NVIDIA video patterns incorporated into the model and inspection workflow. Search and delivery-state filters affect the displayed parts, not the whole-pod action count.

## From a red marker to a decision

1. Open `/`. Red means the current delivery route is unavailable; amber means delayed or a saved decision needs review. Green means on track; teal is an explicitly delivered seed shipment.
2. Drag to orbit, scroll to zoom, and right-drag or shift-drag to pan. Select a marker or physical component to focus the camera and inspect the part. Use the component inventory for keyboard access. Reset restores the full model. Wireframe exposes structure; 2D gives a fixed schematic and also serves as the no-WebGL fallback.
3. Choose **Open recovery plan**. The URL carries the exact component ID. The page shows the supplier, incident, geographic route map, transport stops, cost, ETA and target buffer. The map supports zoom, pan and location popups. Transport lines connect scenario locations, not calculated road or flight paths.
4. Compare the three qualified alternatives. Closed links cannot be recommended; a route that misses the deadline cannot be confirmed. Missing supplier stock can block every transport alternative.
5. Review and explicitly confirm. The snapshot records route, cost and ETA in versioned browser storage. The overview changes to the chosen route; this does not book a shipment or mark physical delivery.
6. If a new incident changes a saved route, review returns. If the route changes while the confirmation dialog is open, its confirm button is disabled. An unchanged, explicitly reviewed delay that still meets the target clears the action.

The **Cutaway**, **Enclosed** and **Exploded** controls follow the supplied video's assembly sequence: show the internal racks, close the modular white/green shell, or separate the panels and roof cooling deck to explain the layers. These views work with 3D and wireframe. Selecting a part opens the cutaway automatically. The fixed 2D elevation disables enclosure controls.

The labeled **Reset view** button clears the selected component and part filters, switches back to the solid 3D cutaway, and returns the camera to the full-pod home position. It works after orbiting, panning, zooming, changing enclosure views, wireframe or 2D; on devices without WebGL, the selectable 2D fallback remains available.

The original production planner is not silently applied to rack shipments. Its gripper-kit bill of materials is a separate manufacturing scenario.

## Push alert behavior

`GET /api/disruptions` uses Server-Sent Events, a server-to-browser stream. This is real push transport with a simulated incident source. There is no polling timer or manual page refresh. A finite script starts with three incidents, adds one every 15 seconds, then clears one initial incident. Requests carry event IDs, reconnect with a cursor, send keepalives and close after 55 seconds so the browser can resume on bounded hosting connections.

`useDisruptions` shares one connection between overview, details, banners and the feed. Duplicate updates do not replay alerts. Pause closes the connection; resume continues from the cursor. Manual scenario toggles override scripted states until **Reset disruption scenario**. State persists across in-app navigation; a full page load starts the simulated feed again. A banner announces newly received incidents above the model. The incident list and route calculations update together.

This is an in-app feed while the page is open, not background operating-system notifications. No external incident service is connected. Production integration needs an authenticated event source, shared durable event/decision storage and actual transport qualification. The sample stream starts a scripted playback per browser, rather than claiming synchronized global incidents across all users.

## Demo in 90 seconds

Pause the scenario feed for a controlled introduction. Inspect Compute rack A: the Frankfurt cargo route is closed. Open recovery and compare the unavailable Frankfurt lane with the Amsterdam alternative and the slower ocean route. Confirm Amsterdam and return to the overview: one action clears.

Inspect the coolant distribution unit. Flooding delays its road shipment. Confirm the coastal alternative, then activate **North Sea port departure suspended** in Scenario controls. That confirmed route becomes unavailable and needs review; inland rail remains an option. Activate the network fabric allocation hold to demonstrate why transport rerouting cannot solve missing stock. Resume the feed to demonstrate new incidents arriving without a refresh.

## How the 3D interaction works

The browser renders Three.js geometry in a WebGL canvas. The scene is built from distinct named component meshes, rather than a flat image. Raycasting maps a pointer click to its component ID. OrbitControls handles camera movement, and a short camera interpolation focuses on a selected part. DOM buttons project the same part anchors onto the canvas for labelled keyboard-accessible hotspots. Status colors change independently of the camera. The scene disposes renderers, geometry, materials and input listeners on unmount, limits pixel ratio and respects reduced motion.

The model is generated locally from simple geometry; no third-party CAD model or texture download is required. A later approved engineering model can replace the geometry with segmented glTF/GLB assets while retaining the same IDs and interaction contracts. No official NVIDIA geometry is included.

## Sources

- [NVIDIA DSX POD technical overview](https://developer.nvidia.com/blog/achieve-productive-ai-capacity-faster-and-more-predictably-with-nvidia-dsx-pod/) informs the subsystem categories, not fictional supplier claims.
- [Three.js OrbitControls](https://threejs.org/docs/pages/OrbitControls.html) describes orbit, pan and zoom interaction.
- [Three.js Raycaster](https://threejs.org/docs/pages/Raycaster.html) describes picking objects in a 3D scene.
- [Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html) documents the optional future asset format.
- [MDN Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events) describes the browser stream and reconnection mechanism.
