# MOLT — Memory Ecology Lab

MOLT is a small, local-first simulation lab for exploring one tightly bounded question: in a synthetic organism, how does the placement of a learned cue trace affect behaviour after tissue loss, regrowth, and a change in the world?

The project combines a seeded paired experiment, a shared-resource toy ecology, a searchable run ledger, and local JSON/CSV exports. Its organisms, cells, memories, cues, food, and hazards are all model variables. MOLT does not simulate an actual animal or establish a biological result.

## Start the app

MOLT is plain HTML, CSS, and browser JavaScript. It has no package-install step or remote service dependency. Python is only used to serve the local files so the browser can load ES modules.

```powershell
Set-Location "C:\path\to\MOLT-Lab"
python -m http.server 8000 --bind 127.0.0.1
```

Open <http://127.0.0.1:8000>. The dashboard first computes a deterministic demonstration run. Keep the server process open while using the app.

## Run a study

1. Choose a training schedule: **Paired**, **Unpaired**, or **Reversed**.
2. Choose **Head regrowth**, **Cell turnover**, **Yoked-twin graft**, or **Sham**.
3. Set cue stability, the base seed, and the number of matched seed pairs.
4. Select **Lock protocol & run**. The settings are disabled while the study runs.
5. Review the paired results and searchable per-seed ledger. Export the selected run as JSON or the session ledger as CSV.

Each seed creates two arms with the same cue sequence, world mapping, intervention-position order, cohort order, and choice-noise draws. Each arm contains six synthetic organisms and starts with its own identically stocked food pool. The pools can diverge as different choices consume resources, so a policy can affect its cohort's later access to food.

| Arm | Trace placement | Effect of head-regrowth intervention |
| --- | --- | --- |
| Head-locked | Three synthetic head cells | Clears those three carriers; regrown cells start blank |
| Distributed | Nine synthetic body cells | Leaves the body carriers intact |

The fixed controller, cell count, event schedule, and environment rules are shared. The app offers additional interventions and training controls for comparisons; their existence does not mean that every condition has been evaluated or validated.

## Example run

The reference run generated with simulator version `0.1.0` used protocol `MOLT-9DAA74B6`: seed `82417`, 24 paired seed values, paired training, head regrowth, 100% cue stability, and the default noise setting of `0.05`. It simulated 288 synthetic organisms.

| Measure | Reference result |
| --- | ---: |
| Head-locked choice accuracy | 47.9% |
| Distributed choice accuracy | 90.4% |
| Distributed minus head-locked choice accuracy | +42.5 percentage points |
| 95% paired bootstrap interval for choice difference | +40.7 to +44.3 percentage points |
| Trace retention, head-locked / distributed | 0% / 100% |
| Distributed-arm survival at end | 90% |
| Distributed minus head-locked survival | +67.4 percentage points |

These values are reproducible outputs of the specified toy model, not measurements from organisms. The confidence interval resamples simulated seed pairs and is descriptive; it is not a biological confidence interval or a confirmatory significance test. See the [paper](docs/paper.md) for methods, interpretation, and limitations.

## What the model measures

- **Trace retention** compares an arm's post-intervention cue trace with its pre-intervention trace. It is undefined for unpaired training because that schedule does not establish a cue association.
- **Choice accuracy** is computed within each seed and arm, then compared as distributed minus head-locked accuracy across matched seeds.
- **Survival** is the fraction of synthetic organisms that remain above the model's energy threshold after 24 test exposures.
- **Forecast Brier score** summarizes the squared error between the toy controller's predicted success probability and its realized choices. It is an internal model diagnostic.
- **Food finds** count units consumed from a finite, replenishing pool. This couples agent behaviour to a simple group outcome; it is not a calibrated ecosystem.

The test-world fidelity parameter controls how often cue meaning follows its trained mapping. Lower fidelity introduces misleading cues. A retained trace can therefore help or hurt depending on the model's world schedule.

## Reproducibility and exports

The simulation is seeded and deterministic for a fixed simulator version and normalized configuration. Replicate seeds follow `base seed + 104729 × replicate index` with 32-bit state. The displayed protocol ID is a short non-cryptographic settings fingerprint; it is not a content hash or tamper-proof signature.

The JSON export contains the selected run's configuration, summary, seed-by-arm results, exposure aggregates, simulator version, and interpretation boundary. The CSV export contains the browser session's ledger rows. The exports do not include complete event-by-event histories for every synthetic organism, so they are not full raw-data receipts. Runs remain in the browser session until exported.

## Scientific context and scope

MOLT takes inspiration from research questions about behavior after planarian head regeneration and from separate work on persistent regenerative patterning. Those are distinct biological topics. MOLT implements neither mechanism and is not a replication of either study. See the [paper](docs/paper.md) for the primary references and the limits of this analogy.

The design is a new synthesis for this project; this repository does not claim that the underlying scientific question or every component is unprecedented. The [influence map](docs/influence-map.md) distinguishes project inspirations from implemented mechanisms.

## Project files

```text
index.html             Local experiment dashboard
styles.css             Responsive visual design
src/engine.js          Seeded paired-cohort simulation and summaries
src/app.js             Controls, rendering, ledger, and exports
docs/protocol.md       Hypotheses, exact protocol, and analysis plan
docs/influence-map.md  Project inspirations and implementation boundaries
docs/paper.md          Methods-and-results software paper
```

## License

Original MOLT code is released under the MIT License. Linked repositories are cited as conceptual influences; their code, weights, data, and assets are not bundled here.
