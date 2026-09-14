# Inference-Budget Efficiency Analysis

This document tracks how effectively MIND.LANDSCAPES converts a constrained consumer AI budget into retained software capability.

The analysis uses five observable dimensions:

- tagged release cadence
- repository change volume and character
- approximate human development time
- OpenAI agentic-usage analytics
- direct monetary cost

MIND.LANDSCAPES is a generative system rather than a fixed authored scene. User-provided images and text, procedural seeds, and persisted state can change the resulting world. This increases the relevance of generalized behavior: a feature is useful only to the extent that it continues to work across varying generated worlds.

The analysis is intentionally based on existing artifacts rather than a manually maintained work diary.

---

## Measurement Scope

Project start date: **2026-09-03**

Release coverage in this revision: **through `v1.0.0-alpha.7` (2026-09-14)**

OpenAI Analytics coverage in this revision: **through `v1.0.0-alpha.6` only**. Tag 7 activity is not yet reflected in the supplied analytics.

### Data sources

| Source | What it measures | Precision / limitation |
|---|---|---|
| Git tags and commit diffs | release dates, files changed, additions, deletions, affected subsystems | exact for the referenced commits |
| OpenAI Analytics screenshot | Work/Codex agentic activity over the documented project period through alpha.6 | aggregate; not a per-release ledger |
| Human-time estimate | active development time | approximate phase-level estimate |
| Purchase / subscription record | direct cash expenditure | direct spend is exact for the documented period; does not represent the full value of inference consumed |
| Reset / promotional usage record | non-cash inference capacity available during the documented period | records one official OpenAI reset and three additional free weekly reset credits; reset capacity is separate from direct cash expenditure |

The OpenAI Analytics data is not a per-release ledger. It therefore cannot be used to calculate exact credits, turns, or plugin calls per release.

Regular Chat usage is not included in the Work/Codex usage view. This `INFERENCE_EFFICIENCY.md` analysis was itself developed through regular Chat, so the conversational reasoning used to interpret the repository, screenshots, and efficiency data is not represented in the Work/Codex analytics totals.

OpenAI also describes credits as usage/billing units rather than a direct record of dollar spend.

For cost analysis, direct cash expenditure and non-cash inference capacity are tracked separately. During the documented period, the project used a promotional $0 Plus month, one $10 purchased-credit top-up, one official OpenAI reset, and three additional free weekly reset credits.

---

## Tagged Releases

| Release | Date | Commit | Diff basis |
|---|---|---|---|
| `v1.0.0-alpha.1` | 2026-09-03 | `3b5b200` | parent commit `04f6477` |
| `v1.0.0-alpha.2` | 2026-09-04 | `9cb6107` | `alpha.1` |
| `v1.0.0-alpha.3` | 2026-09-06 | `cd2dc93` | `alpha.2` |
| `v1.0.0-alpha.4` | 2026-09-08 | `9189efc` | `alpha.3` |
| `v1.0.0-alpha.5` | 2026-09-10 | `d89f9b7` | `alpha.4` |
| `v1.0.0-alpha.6` | 2026-09-12 | `0872443` | `alpha.5` |
| `v1.0.0-alpha.7` | 2026-09-14 | `fca39fa` | `alpha.6` |

Release intervals:

```text
alpha.1 -> alpha.2: 1 elapsed day
alpha.2 -> alpha.3: 2 elapsed days
alpha.3 -> alpha.4: 2 elapsed days
alpha.4 -> alpha.5: 2 elapsed days
alpha.5 -> alpha.6: 2 elapsed days
alpha.6 -> alpha.7: 2 elapsed days
```

From alpha.1 to alpha.7, **11 elapsed days** separate the first and seventh release points.

---

## Repository Change Volume

| Release | Files changed | Additions | Deletions | Net |
|---|---:|---:|---:|---:|
| `alpha.1` | 31 | 5,241 | 1 | +5,240 |
| `alpha.2` | 44 | 3,165 | 761 | +2,404 |
| `alpha.3` | 64 | 2,831 | 497 | +2,334 |
| `alpha.4` | 48 | 1,081 | 1,177 | -96 |
| `alpha.5` | 24 | 456 | 138 | +318 |
| `alpha.6` | 31 | 1434 | 45 | +1389 |
| `alpha.7` | 31 | 1250 | 263 | +987 |

For the six consecutive post-alpha.1 deltas:

```text
sum of per-release "files changed" counts: 242
additions:                           10,217
deletions:                            2,881
```

The value 242 is not a count of unique files. The same file can be changed in more than one release.

These statistics describe the scale and character of repository activity; they are not treated as productivity scores by themselves.

---

## Functional Progression

### `v1.0.0-alpha.1`

Foundation / bootstrap work included:

- core Three.js / WebGL rendering architecture
- modular GLSL structure
- procedural world and spatial systems
- configuration and UI infrastructure
- world-state handling
- initial automated tests

### `v1.0.0-alpha.2`

The next one-day release interval added or expanded:

- vegetation and rendering systems
- modular procedural materials
- adaptive quality behavior
- browser-based test execution
- lifecycle / rendering harnesses
- tests for materials, quality, spatial randomization, and vegetation shaders

### `v1.0.0-alpha.3`

The following two-day interval added or expanded:

- IndexedDB persistence
- compact, versioned maze recipes
- deterministic reconstruction of maze structures from saved generation data
- branching procedural interiors and directed portals
- media-dependent maze generation
- user-art import and storage
- deterministic personal-art placement
- art-atlas rendering
- broader tests and browser harnesses for architecture, controls, maze behavior, spatial systems, art, lifecycle, optimization, and water

### `v1.0.0-alpha.4`

The following two-day interval included:

- shader and material refinement
- flower and indoor-courtyard rendering
- maze and spatial-layout refinement
- expanded rendering and browser harnesses
- performance-comparison infrastructure
- continued quality, vegetation, water, material, and optimization work

### `v1.0.0-alpha.5`

The following two-day interval concentrated heavily on rendering consistency, architectural GLSL, vegetation, and verification.

Primary implementation changes visible in the diff:

- major expansion and revision of `architecture.glsl.js` (+170/-approximately 40 lines), indicating substantial architectural rendering work rather than a minor shader tweak
- substantial lighting-system revision in `lighting.glsl.js`
- major rewrite of grass geometry and further foliage-shader refinement
- expanded flower and indoor-courtyard materials
- smaller coordinated updates across maze rendering, world configuration, landscape rendering, material configuration/catalog behavior, and procedural world layout
- new spatial-layout logic
- new `stair-render-sync.test.js`, explicitly adding verification for stair/render synchronization
- expanded architecture-morph, material-catalog, spatial-layout, and vegetation-shader tests


### `v1.0.0-alpha.6`

The next two-day release interval formalized the inference-efficiency record and refreshed the tagged presentation state.

Repository-visible changes in the tagged snapshot include:

- introduction of `INFERENCE_EFFICIENCY.md` as the detailed challenge/efficiency record, replacing the README's previous link to the shorter `CHALLENGE.md`
- new alpha.6 screenshots documenting the release state
- retention of the generalized rendering and persistence architecture already established by alpha.5, including adaptive quality, deterministic maze reconstruction, personal art, architectural morphing, vegetation detail scaling, and bounded maze/collision data structures
- a documented 55 × 55 RGBA maze-connectivity texture of about 12 KB for the then-current single-network representation, rebuilt only on structure-cell transitions or world-setting changes

### `v1.0.0-alpha.7`

The following two-day interval adds a new persistent cultivation progression and expands underground procedural structure.

Tagged behavior includes:

- collectible seed bags for three base species: Moonbells, Ribbon ferns, and Ember thistles
- persistent seed inventory and a dedicated **Seeds** interface
- stable per-visit seed-bag placement inside generated buildings, with a new saved visit generation on re-entry
- outdoor planting pockets and interaction-driven planting
- persistent plant growth over the day/night cycle with navigation beacons
- two-plant plots and pair-dependent hybrid unlocks
- ten named hybrid species forming a branching progression from the three base species
- mature-species rendering with close-detail geometry/material treatment and simplified distant silhouettes
- expansion of interiors from one procedural maze network to **two independently generated 7 × 7 underground floors**
- floor-preserving portal arrivals and a second stair flight chosen from traversable first-floor space
- expansion of the nearby maze-connectivity texture from the alpha.6 55 × 55 representation to a **77 × 154 byte RGBA texture (about 47 KB)** covering the two-floor state
- continued bounded CPU collision caches and synchronized geometry/connectivity updates

---

---

## Software Complexity Context

Inference-budget efficiency should be interpreted in relation to the type of software being produced.

MIND.LANDSCAPES combines tightly coupled systems including:

- realtime WebGL / Three.js rendering
- GLSL shader development
- procedural world generation
- spatial and navigation logic
- deterministic reconstruction
- persistent state
- adaptive quality and performance behavior
- arbitrary user-provided image and text inputs
- automated and browser-based verification
- persistent gameplay/progression state spanning generated interiors and exterior cultivation

Changes in one subsystem can affect several others. For example, world-generation changes can affect rendering, navigation, persistence, and performance, while shader or material changes can affect both visual correctness and runtime cost.

This makes the workload materially different from lower-coupling software such as static sites, simple CRUD applications, or isolated utility code.

No numerical complexity multiplier is assigned. Software class is recorded only as context for interpreting release velocity, human effort, and inference usage.

---

## OpenAI Agentic-Usage Snapshot

The cumulative Analytics record for the documented project period through alpha.6 is:

| Dashboard metric | Value |
|---|---:|
| Model turns | 310 |
| Plugin calls | 554 |
| Credits spent | 251.7 |
| Skills used | 15 |

Aggregate ratios:

```text
plugin calls / model turns = 554 / 310 = 1.79
credits / model turns      = 251.7 / 310 = 0.81
```

These are **project-period aggregate ratios**, not a mapping of individual plugin calls or credits to specific model turns.

In particular:

- `1.79` does not mean every turn executed 1.79 tools
- `0.81` is not a dollar cost per turn
- tag 7 activity is not yet included
- the available analytics do not expose a complete token ledger for this analysis

The analytics are therefore best used as an inference-activity baseline, not as exact token accounting.

---

## Human Development Time

Approximate active development time:

| Phase | Estimated active time |
|---|---:|
| Initial phase, through roughly the first two tagged releases | 8-10 hours/day |
| Later phase | 5-7 hours/day |

Using the midpoints of those ranges:

```text
initial midpoint: 9 hours/day
later midpoint:   6 hours/day
change:           ~33% lower
```

This is evidence of a lower reported human-time band after the bootstrap phase.

It should **not** be converted directly into a productivity multiplier because release scope is not normalized to a single output unit. The useful longitudinal question is whether the lower human-time band persists while comparable or greater generalized capability continues to ship.

---

## Implementation Authorship

Approximately **99.9% of the implementation code in the observed project period was generated through LLM-assisted workflows rather than manually authored by the developer**.

This is an estimated proportion, not a repository-derived measurement. The estimate refers to **implementation code**, not repository artifacts such as screenshots or documentation. Direct manual code edits were limited primarily to minor parameter/value adjustments, such as small GLSL float changes.

Human involvement was concentrated on:

- specifying requirements and desired behavior
- directing architectural and feature development
- evaluating visual and functional output
- testing and identifying failures
- accepting, rejecting, or redirecting generated changes
- making occasional minor value-level adjustments

This distinction is relevant because the repository is not primarily the result of conventional manual coding supplemented by AI. Nearly all direct implementation was delegated to LLM workflows, while the human role was primarily supervisory, evaluative, and architectural.

---

## Direct Cost

Direct AI-related cash expenditure through the baseline period:

| Cost source | Amount |
|---|---:|
| ChatGPT Plus subscription | $0 promotional first month |
| Purchased credits | $10 |
| Official OpenAI reset | $0 out-of-pocket |
| Three free weekly reset credits used | $0 out-of-pocket |
| **Direct out-of-pocket spend** | **$10** |

This measures cash expenditure, not the full economic value or nominal retail value of the inference consumed.

The documented period therefore includes both paid and non-cash inference capacity:

- one $10 purchased-credit top-up
- a promotional $0 Plus month
- one official OpenAI reset
- three additional free weekly reset credits

---

## Interpreting Generalization

A useful conceptual description of the system is:

```text
F(text, images, seed, state) -> interactive world
```

The output is not one fixed landscape. Tagged code includes mechanisms whose behavior varies with user media, procedural state, persistence, and, by alpha.7, persistent cultivation/progression state.

That makes generalization relevant to efficiency analysis: a change that works across many generated worlds represents broader retained capability than a change tailored to one fixed scene.

However, this analysis does **not** assign a numerical multiplier to generalization and does not claim that every possible input combination has been validated.

---

## Efficiency Interpretation

The current evidence is consistent with effective inference-budget use because several signals move in a favorable direction at the same time:

- substantial tagged changes were delivered at 1-2 day intervals after alpha.1
- alpha.5, alpha.6, and alpha.7 each continued the two-day release cadence
- the system progressed from bootstrap architecture into persistence, deterministic generation, generalized media handling, verification, performance work, continued GLSL/render synchronization refinement, and persistent cultivation/progression with a two-floor procedural interior model
- the reported human-time band fell after the initial phase
- direct cash expenditure remained at $10 during the observed period
- available inference capacity was supplemented by a promotional $0 Plus month, one official OpenAI reset, and three additional free weekly reset credits
- later development includes substantial deletion, rewriting, and consolidation rather than only code accumulation
- test and browser-harness coverage expanded alongside feature development
- nearly all direct implementation was delegated to LLM-assisted workflows
- the cumulative Analytics record through alpha.6 shows 310 model turns, 554 plugin calls, and 251.7 credits spent
- alpha.7 inference usage is not yet included

The strongest defensible conclusion is:

> **During the observed early development period, MIND.LANDSCAPES shows evidence of efficient conversion of a constrained consumer AI budget into retained, increasingly generalized software capability with near-total direct implementation delegated to LLM workflows.**

This is a case-study conclusion, not a population benchmark.

---

## What the Data Does Not Establish

The current record does **not** establish:

- an exact percentile among AI-assisted developers
- exact raw-token efficiency
- exact per-release credits or turns from the Analytics record
- exact tag 7 inference usage before the next analytics update
- a causal productivity multiplier
- a controlled comparison with conventional development
- long-term maintainability
- long-term efficiency after substantially greater project complexity
- robustness across every possible image/text input or generated cultivation state
- an exact machine-verified percentage of LLM-authored code

Those questions require either more granular telemetry, external comparison data, provenance instrumentation, or a longer observation period.
