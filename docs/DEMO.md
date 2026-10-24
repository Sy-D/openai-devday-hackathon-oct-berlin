# FORMA: three-minute demonstration

## Promise

"FORMA helps a planner recover an urgent order by choosing where its parts are made, where they come together, and how the complete product reaches the customer."

## Story

An urgent order needs twelve robotic gripper kits in Berlin. Each kit combines two printed components with a purchased actuator. A production queue has slipped. The fastest individual printer is not necessarily the fastest complete delivery, because assembly must wait for every component.

## Demonstration sequence

| Time | Action | What the audience should understand |
| --- | --- | --- |
| 0:00–0:25 | Show the dashboard and the order requiring action. | The planner sees order volume and delivery risk, then has a concrete next action. |
| 0:25–0:55 | Open the urgent order and inspect its components and factory capabilities. | A polymer printer cannot manufacture the metal part, and the purchased actuator still belongs in the schedule. |
| 0:55–1:35 | Compare cost, balanced and fast alternatives on the map. | The route includes production, transport to assembly, assembly and final delivery. Cost and deadline buffer update together. |
| 1:35–2:10 | Ask the assistant: "Which plan meets the deadline at the lowest cost, and why?" | The assistant explains the existing feasible options from the same data used by the interface. Its suggestion does not assign a plan. |
| 2:10–2:40 | Select a suitable plan and confirm it. | An operational decision changes the order's plan and the dashboard's action state. |
| 2:40–3:00 | Show the updated route and metrics. | The result is an explainable recovery action with a visible cost and delivery trade-off. |

Use the values shown by the running application rather than memorising illustrative prices or hours from a sketch. The app's dataset and planning calculation are the authoritative demo values.

## Useful assistant prompts

- "Which plan meets the deadline at the lowest cost, and why?"
- "Why can't we send every part to the nearest factory?"
- "Which component controls the assembly start time?"
- "What extra cost buys the biggest delivery buffer?"

When no OpenAI API key is configured, the interface must label the assistant's deterministic responses as demo mode. Do not describe those responses as a live model call.

## What is real in this prototype

The interface, route comparisons, eligibility rules, schedule calculations, state changes and confirmation path are implemented product behaviour. The operational inputs are synthetic. There are no real factory bookings or carrier reservations.

## Drawing

Excalidraw private scene: `5fLHSSwDGK8`, named **FORMA · Production network and demo journey**. The editable export is `outputs/forma-production-workflow.excalidraw`; the verified preview is `outputs/forma-production-workflow.png`.

The diagram shows parallel component jobs converging at assembly. Its central rule is:

```text
delivery ETA = latest component arrival + assembly and QA + final transport
```

If an assembly queue is modelled, also wait for that assembly slot. The sketch uses a 60-hour deadline solely to communicate the scenario. No live supplier data or engineering approval is implied.

## Before presenting

- Run the application and exercise the entire confirmation path once.
- Reset to the at-risk scenario so the audience sees the before/after change.
- Check whether the assistant is in live or demo mode.
- Keep the local demo available if venue connectivity fails.
- Use the research notes for problem framing; do not claim the prototype replaces an existing industrial platform.
