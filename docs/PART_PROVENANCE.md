# Hardware references and manufacturing evidence

Research date: **24 October 2026**. Authoritative application data: [`src/data/part-catalog.ts`](../src/data/part-catalog.ts).

Every component in the visual workspace now has a real product reference supported by a manufacturer's public documentation. This is a research catalog, not an approved NVIDIA DSX bill of materials, a procurement record, or an engineering design. The diagram's geometry, quantities, suppliers, route origins, inventory, delivery state and recovery costs do not become real because a real product is shown beside them.

## References used in the workspace

| Workspace component       | Real reference                                                | Evidence and verified scope                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compute rack A            | Supermicro SuperServer SRS-GB300-NVL72                        | [Supermicro product page](https://www.supermicro.com/en/products/rack/srs-gb300-nvl72): liquid-cooled GB300 NVL72 system, 72 B300 GPUs, 36 Grace CPUs, 18 compute nodes and a 48U rack.                                                                                                                                                                                     |
| Compute rack B            | NVIDIA GB300 NVL72 by HPE                                     | [HPE QuickSpecs](https://www.hpe.com/us/en/collaterals/collateral.a50009244enw.html): 72 Blackwell Ultra GPUs, 36 Grace CPUs, 18 trays and fifth-generation NVLink. This is another vendor reference, not proof of a qualified mixed-vendor deployment.                                                                                                                     |
| Network fabric            | NVIDIA Spectrum-4 SN5600                                      | [NVIDIA hardware manual](https://networking-docs.nvidia.com/sn5000hw/introduction): 2U Ethernet switch with 64 800GbE OSFP ports and 51.2 Tb/s maximum throughput.                                                                                                                                                                                                          |
| Storage array             | NetApp AFF A1K                                                | [NetApp specifications](https://docs.netapp.com/us-en/ontap-systems/a1k/overview.html) and [installation requirements](https://docs.netapp.com/us-en/ontap-systems/a1k/install-prepare.html): a high-availability controller pair uses two 2U chassis; supported protocols include NFS, SMB, S3 and NVMe/TCP. Capacity and shelves still need sizing.                       |
| Power distribution        | HPE S6E21A power-capacitance shelf kit                        | [HPE QuickSpecs](https://www.hpe.com/us/en/collaterals/collateral.a50009244enw.html): 1U, 33 kW, 50 V DC, air-cooled left shelf kit. HPE's complete rack uses eight power shelves. This is not the entire facility power system.                                                                                                                                            |
| Coolant distribution unit | Vertiv CoolChip CDU 600                                       | [Vertiv product specifications](https://www.vertiv.com/en-us/products-catalog/thermal-management/high-density-solutions/vertiv-coolchip-cdu-600/): liquid-to-liquid CDU; 600 kW at a 4°C approach temperature difference; redundant variable-speed pumps and filtration.                                                                                                    |
| Cooling manifold          | nVent HOFFMAN RackChiller RCM42001                            | [nVent specification PDF](https://www.nvent.com/sites/default/files/dam/rackchiller-rack-manifold-spec-01500.pdf) and [model manual](https://www.nvent.com/sites/default/files/acquiadam/assets/89216863.pdf): stainless-steel supply/return pair; standard configuration uses jumper hoses to the cold plates.                                                             |
| Optical interconnects     | NVIDIA LinkX MMA4Z00-NS400                                    | [NVIDIA transceiver manual](https://docs.nvidia.com/mma4z00-ns400-400gb-s-single-port-osfp-400gb-s-multimode-sr4-50m-transceiver.pdf): 400 Gb/s single-port OSFP SR4 multimode transceiver, up to 50 m. This reference does not establish a compatible 800 Gb/s GPU link.                                                                                                   |
| Controls and sensors      | Schneider Electric / APC NetBotz Rack Monitor 250A, NBRK0250A | [Schneider Electric product page](https://shop.se.com/pro/us/en/product/rack-mount-security-and-environmental-appliance-netbotz-250a/): 1U environmental and access-monitoring appliance. [Firmware advisory](https://www.se.com/us/en/faqs/FAQ000281400/): multiple rope leak sensors need supported 3.3.x or later firmware. FORMA has no connection to a real appliance. |
| Container and roof        | Vertiv SmartMod enclosure family                              | [Vertiv product page](https://www.vertiv.com/en-us/products-catalog/facilities-enclosures-and-racks/integrated-solutions/vertiv-smartmod-solutions/): prefabricated modular enclosure with configurable power, cooling and monitoring. The visual model is not SmartMod CAD or an NVIDIA-certified container design.                                                        |

## What is known about origin

No reviewed evidence establishes the manufacturing or dispatch origin of a unit allocated to this project. There are no purchase orders or serial-number records. Manufacturer names identify the product's brand or system vendor; they do not establish every upstream manufacturer.

Three references have useful **company-level** manufacturing evidence:

- **Supermicro:** its [2024 Sustainability Report](https://www.supermicro.com/GreenComputing/Supermicro-ESG-Report-2024.pdf) describes manufacturing in the United States, Taiwan, Malaysia and the Netherlands. It does not identify where a particular SRS-GB300-NVL72 order would be built or dispatched.
- **HPE:** a [2022 announcement](https://www.hpe.com/us/en/newsroom/press-release/2022/05/hewlett-packard-enterprise-strengthens-europes-supercomputer-supply-chain-with-new-factory-in-czech-republic.html) documents an existing server/storage manufacturing site in Kutná Hora, Czechia, beside a then-planned HPC site. This is dated company evidence, not a current GB300 factory allocation. It also does not establish the origin of the S6E21A shelf kit.
- **nVent:** its [September 2025 announcement](https://investors.nvent.com/press-releases/press-release-details/2025/nVent-Expands-Data-Center-Solutions-Manufacturing-with-New-U-S--Production-Facility/default.aspx) describes expansion at the Anoka, Minnesota, production facility and plans for additional space in Blaine. Only Anoka is retained as a documented company manufacturing location; no origin is assigned to RCM42001, and the planned site's opening is not assumed.

For NVIDIA switches and optics, NetApp storage, HPE's power shelf, Vertiv cooling/enclosures and Schneider Electric controls, the catalog marks product origin **unverified**. Headquarters, contact addresses, offices, product certifications and a manufacturer's unrelated factories are not used as shipment origins.

The NVIDIA optical-transceiver manual illustrates a country-of-origin label and separately lists alternative site codes. The manual explicitly says labels are illustrative. Neither the illustration nor the site-code legend proves the origin of an actual unit, so the catalog intentionally does not select a country from them.

## How to use this in the demo

1. Select a component in the container view. Explain the component's role, then show the named product reference.
2. Open its manufacturer source to substantiate the specification. Keep the candidate label visible.
3. Explain the origin status. A documented company site is context for investigation, not a starting point for a real shipment route.
4. If a live incident appears near a possible manufacturing region, investigate exposure. Do not call the component blocked without a confirmed facility, order or shipment match.
5. Enter the recovery workflow as an explicitly illustrative scenario until the procurement and transport records below exist.

## Evidence needed for a real workspace

- A confirmed bill of materials and selected vendor SKUs, with engineering approval for rack, cooling, power and network compatibility.
- Purchase-order lines and supplier acknowledgements linking the chosen parts to quantities and dates.
- A supplier-confirmed manufacturing site and dispatch facility for each order; a serial/lot record or country-of-origin document when required.
- Carrier tracking or transport-management events tying a shipment to real ports, airports, routes and milestones.
- Sensor/asset connections if hardware health is shown. NetBotz's published features do not constitute live telemetry.

These records should be stored separately from research references. Replacing a reference must never silently change an order or assert that a shipment exists. Actual delivery status should come from operational records, with source timestamps and history.

## Integration contract

`partCatalog` is a typed record keyed by the ten existing DSX component IDs. `getPartReference(componentId)` returns a `PartReference` or `undefined`. Unknown IDs, including prototype-property names, do not return a reference.

`PartProvenance` accepts `componentId: string` and optional `compact: boolean`. It displays product identity, candidate/procurement status and origin limits. The compact version keeps those limits visible and puts specifications and source links in a native expandable section. Both variants show the research date. It uses the shared design tokens and its own scoped stylesheet, with no supplier-risk backend dependency.

All current entries use `referenceStatus: "reference-candidate"` and `procurementStatus: "not-confirmed"`. `origin.status` is `company-footprint` for the three cases above and `unknown` elsewhere. The `product-verified` value is reserved for future, explicit product-level evidence; it is not used to infer order or dispatch provenance.
