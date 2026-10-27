# FORMA — two-minute demo

## Prepare before presenting

Open `/` and `/planning?component=optics`. Use the NVIDIA MMA4Z00-NS400 offer from DELTA. Check its displayed observation time and seller page; refresh incident reports and calculate routes before walking on stage. The warehouse location is known at city precision, and NTT Berlin 1 is an example destination, not a customer order. Use **Use planning timing** for an editable six-hour planning target and handling allowance, or enter your own inputs.

Keep the original route and at least one alternative loaded. If a previous rehearsal left the decision green, click **Reopen for review** on the saved-decision banner before returning to the model. This keeps the route and inputs but restores the red action state. Older saved decisions automatically require one explicit application. Current provider reports change; read the values visible in the app. Never promise a particular new alert during the two minutes. Product/transport assumptions remain available in **Basis and evidence** and the cost/timing disclosure. No purchase or carrier booking occurs.

## Exact recording clicks

1. Open `/` in dark mode at a desktop width. Select the red **Optical interconnects** marker, then **Plan this delivery**. Colors describe review work: red needs review, amber needs a plan, green has a reviewed decision.
2. Keep the DELTA **NVIDIA MMA4Z00-NS400** offer selected. The published price is shown with its source. The default dispatch is Glinde and the example destination is NTT Berlin 1; no coordinates need to be entered.
3. Under **Define the journey**, click **Use planning timing**, then **Calculate road routes**. To demonstrate another address later, type it into **Find a city, address or facility**, click **Search**, then select the result.
4. Click **Fit all routes**. Wait until the basemap has loaded before starting the recording. Read one current A24 report beneath the map; do not promise a particular report or delay value.
5. Click **Avoid reported area** on that report. Scroll to **04 / DECISION** and show the before/after comparison. If the alternative still overlaps the reported road section, the app retains its reported delay.
6. Choose **Original road route** if it remains faster and cheaper, or the better alternative if current results support it. Click **Apply route decision** (or **Apply updated decision** when reviewing a previous plan).
7. Click **Back to this part**. The component marker is green after review. Relevant changed evidence or inputs bring the decision back for review. This saves a planning record; it does not buy a part or book a carrier.

**Recording setup:** rehearse and load the map/route once, then return to the model. Keep the same browser so calculated routes are retained. Record at 1440px or wider; use one presenter, no developer tools and no setup during the two minutes. Do not clear incidents. The script below is about 240 spoken words.

## Stage script

| Time | Action | Say |
| --- | --- | --- |
| 0:00–0:20 | Show the model, select **Optical interconnects**, click **Plan this delivery**. | “FORMA connects the physical parts of an AI data center to the decisions required to deliver them. This optical module links our compute racks to the network. Selecting it opens the product, sourcing and delivery workflow.” |
| 0:20–0:40 | Show the DELTA exact-SKU offer, observed price and origin. | “Here is the exact NVIDIA part and a published seller offer. We carry its price and source into the plan. This example starts from the seller's warehouse city near Hamburg and goes to a Berlin data center.” |
| 0:40–1:05 | Show the calculated road route and its current A24 report. | “The platform receives real incident reports automatically. It checks the road section and direction against this journey. We can inspect the original report and see which parts of the delivery decision it affects.” |
| 1:05–1:35 | Choose **Avoid reported area** or select a preloaded alternative. Show the comparison. | “An alternative is calculated on the road network. We compare distance, travel time, reported delay, transport cost and emissions. Every number has a source or a planning input. This makes the cost of changing the plan visible before anybody books transport.” |
| 1:35–2:00 | Choose the best route for the displayed objective and **Apply route decision**. | “Today, the original route is still faster and cheaper than the full detour. We keep it and avoid an unnecessary change. The decision is saved with its evidence; relevant new reports or changed inputs bring it back for review. That is the loop: part, evidence, decision and measurable consequences.” |

Approximately 240 spoken words plus clicks. If the current evidence favors a detour, replace the final paragraph with the actual improvement shown on screen. Do not reuse yesterday's numbers.

## Verified example, 24 October 2026 at 13:10 UTC

These are observations from that check, not guaranteed current results:

| Option | Road distance | Driving + relevant reported delay | Net transport estimate | Operating emissions estimate |
| --- | ---: | ---: | ---: | ---: |
| Original route | 267.43 km | 168.15 + 20 min | €371 | 46.17 kg CO₂e |
| Short detour | 274.67 km | 187.04 + 20 min | €379 | 47.42 kg CO₂e |
| Longer avoidance | 293.31 km | 225.70 + 0 min | €401 | 50.64 kg CO₂e |

The longer avoidance removed aligned queue exposure but added about 38 minutes, €30 and 4.47 kg estimated emissions. The short detour still overlapped the queue: merely avoiding its start marker was insufficient. These calculations use Valhalla road geometry/speeds, the largest overlapping current direction-aligned Autobahn delay, HanseSprint's published tariff and the UK 2026 diesel-car emissions benchmark. They are forecasts, not measured delivery outcomes.

## What earns its place

- **3D model:** selects the physical dependency and keeps the sourcing decision attached to it.
- **Offer and evidence:** show the exact item, price basis, source and missing-data assumptions.
- **Road map and report overlay:** explain why an incident is relevant to this journey.
- **Action color and direct link:** point to the next review, calculation or decision.
- **Comparison:** shows the price of time or reduced exposure, including when changing nothing is better.
- **Saved decision and live updates:** preserve what was chosen and reopen it when relevant evidence changes.

Leave extra model modes, other components and broad incident filters for questions. No scripted alert injection or pause/reset-feed control is part of this demo.
