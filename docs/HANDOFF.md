# FORMA: team alignment handoff

Status checked 24 October 2026. This is a first implementation for review, not an agreed final product specification.

## Current direction

Carl first asked for research, an Excalidraw sketch and a visually polished mock-data application for a six-hour hackathon. He then explicitly asked for the dashboard and live assistant to be built in parallel. In the coordinating chat, Carl subsequently prioritised putting the full context and plan in the shared Space so several people can align before extending the build.

This repository preserves the first version. New feature scope is paused for team alignment. The coordinating chat owns the [Planning Supply Chain Tool Page](https://chatgpt.com/space/page_d8c7928de5848191a983913da6ed1e4c). Do not overwrite that Page from this code task.

## Start here

- Run `npm run dev` and open `http://127.0.0.1:5173`.
- Local branch: `codex/hackathon-work`.
- Origin: `https://github.com/Sy-D/openai-devday-hackathon-oct-berlin.git`.
- No remote push has been made. The connected account reported read-only access during initial setup; verify current access before publication.
- Read `README.md` for startup and the source map, `docs/DEMO.md` for the pitch, and `docs/RESEARCH.md` for problem evidence.

## First demo story

Order FM-2048 contains 12 robotic gripper kits delivered to Berlin: 12 polymer housings, 24 metal fingers and 12 purchased actuators. Assembly waits for the last arriving component.

| Plan | Cost | Arrival from demo start | Deadline buffer | Assembly |
| --- | ---: | ---: | ---: | --- |
| Lowest cost | €2,596 | 72h | 12h late | Prague |
| Balanced | €3,222 | 49h | 11h early | Leipzig |
| Fastest | €4,423 | 34h | 26h early | Leipzig |

A simulated 24-hour Dresden delay changes Balanced from 49h to 73h, missing the 60h target. Fastest uses Munich for the metal fingers and remains available. Confirming an on-time plan clears that order's action state; a late plan requires explicit acknowledgement and remains flagged.

## What the current code implements

The dashboard has order and volume metrics, on-time forecast, actionable orders, an interactive map, a three-plan comparison, component routing, a delivery timeline, confirmation and cost breakdown, order search/filters, network capabilities, activity history, JSON export and browser-local persistence. All inputs and forecasts are mock data.

The assistant server exposes `POST /api/assistant` and `GET /api/health` on loopback port 8789. The frontend uses Vite's `/api` proxy. It supports the OpenAI Responses API with server-side credentials, validates the current plan context and suggestion ID, and cannot assign orders. Missing credentials or provider failures produce disclosed demo advice. There is no OpenAI API key configured in this run, so no real model response has been verified.

## Verification and limits

- Production build checks frontend and server TypeScript.
- 18 planner/API tests cover capability exclusions, batch limits, assembly joins, purchased parts, route selection, changed queues, output validation and API failure handling.
- Five browser tests cover recovery, persistence, a second recovery after disruption, late-plan acknowledgement, copilot through the actual local API, capability inspection, search, timeline and narrow-screen overflow.
- Desktop and mobile screenshots are in `outputs/`.
- The Excalidraw connector created private scene `5fLHSSwDGK8`, **FORMA · Production network and demo journey**. The scene was rendered and visually checked. An editable `.excalidraw` export and PNG preview are in `outputs/`.

The prototype is local only. No hosted multiuser state, authentication, real bookings, CAD printability analysis, calibrated delivery probabilities, live carrier quotes or deployment are implemented. The three options are predefined alternatives, not a global optimisation algorithm. Working calendars, independent finishing/QA steps and assembly slot queues remain simplified. Emissions are illustrative scenario constants.

## Team decisions still open

1. Confirm the target operator and the exact judging story.
2. Agree which capabilities and assembly constraints need to be visible in this six-hour demo.
3. Choose the live assistant credentials/model and verify one real response.
4. Decide who owns UI, planning logic, assistant and deployment without overlapping edits.
5. Resolve repository write access and choose the shared development and deployment workflow.

FORMA, the robotic-gripper example, the factory network and the visual direction are implementation choices proposed by this chat. Carl has not approved them as the final team concept. Research supports the problem category; it does not prove the proposed distinction is commercially unique.
