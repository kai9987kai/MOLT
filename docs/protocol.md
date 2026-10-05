# MOLT v0.1 — protocol notes

## Research question

In a synthetic organism that learns a cue-to-outcome association, does putting the trace across body cells preserve useful behaviour after head loss and regrowth better than putting the same trace only in the head? Does any behavioural difference matter when organisms share a finite resource pool and cue meaning can change?

This is a computational design question. “Memory,” “cell,” “head,” “regrowth,” “food,” and “hazard” refer only to variables in this toy simulator.

## Hypotheses and controls

- **H1, trace persistence:** following head regrowth, the distributed arm retains more of its pre-intervention cue trace than the head-locked arm.
- **H2, behaviour:** with paired training and stable cue meaning, the distributed arm will choose the currently useful action more often after head regrowth.
- **H3, ecological consequence:** if choices change, shared food and survival may change too. This is downstream of the same toy-world rules and is not independent biological evidence.
- **Acquisition control:** the unpaired schedule gives each cue equal counts of positive and negative outcomes. It should not create a systematic cue mapping.
- **Sign control:** reversed training swaps the trained action for each cue.
- **Intervention controls:** cell turnover, yoked-twin graft, and sham can be run with the same seed design to test whether outcomes depend on head loss specifically.
- **Environmental shift:** cue fidelity ranges from 0% to 100%. A retained trace can be harmful when cue meaning flips.

These are proposed hypotheses, not preregistered claims. The interface lock records settings immediately before a run, but the page also loads a visible demonstration and does not publish a timestamped preregistration. Formal confirmatory work needs an external, time-stamped protocol and an independent implementation review.

## One replicate

Each seed creates two matched arms. Each arm starts six twelve-cell organisms. Three cells are labelled as head; the other nine form the body. The current version assigns the body layout directly; it does not simulate cell division, a gene-regulatory network, morphogen gradients, or real anatomy.

1. **Condition:** 24 exposures contain twelve examples of each cue. Paired training maps cue A to approach and cue B to avoid; reversed training swaps that mapping. In the unpaired control, each cue receives six positive and six negative outcomes.
2. **Write:** each cue outcome is written to either the three head cells or the nine body cells. Each cell's trace is a regularized average of its stored outcomes.
3. **Intervene:** head-regrowth clears the first three cells; turnover replaces three matched positions with blank cells; a graft replaces 40% of the memory carriers with a yoked twin's oppositely trained state; sham keeps the tissue state.
4. **Rewild:** the cohort encounters 24 balanced cue presentations. On each presentation the world's cue mapping follows training with the configured fidelity and flips otherwise. Agents share a food pool with a 3.2-unit capacity; it replenishes by 0.55 units on resource presentations and 0.2 on hazard presentations. Correct foraging can consume food; choosing into a hazard drains energy.
5. **Record:** MOLT stores arm summaries for trace retention, choice accuracy, survival, food finds, final energy, and forecast Brier score. It aggregates choice accuracy by exposure over surviving organisms.

For a given seed, both arms share cue order, outcomes, cue-world changes, test-choice uniforms, intervention ordering, and cell noise. Their food pools evolve separately after actions diverge. Replicate seeds are `base seed + 104729 × replicate index`, using 32-bit PRNG state.

## Analysis

The headline contrast is the mean across seeds of `distributed accuracy − head-locked accuracy`, where each accuracy is first calculated inside a replicate arm. A percentile bootstrap resamples those paired seed differences 1,600 times and reports the 2.5th and 97.5th percentiles. The interval is descriptive and is not a replacement for a confirmatory analysis plan.

The same paired calculation is available for trace retention and survival. Retention is undefined in unpaired training because there is no trained association. Organisms within a seed share the schedule and food pool; the seed pair, not each individual organism, is the resampling unit.

## Reproduction and interpretation

The protocol ID is derived from the normalized settings with a short FNV-1a-style hash. It is a convenience label, not a cryptographic hash. Exports include the simulation version, settings, seed-by-arm summaries, and exposure aggregates. They currently omit per-organism event streams, so they are not complete raw-data receipts.

The demo and user runs are generated in the browser. No network data, real-world measurements, biological tissue, trained model, or quantum device enters the computation. Changes to `src/engine.js` can change results; the version string must be advanced when simulation semantics change.

## Next confirmatory steps

1. Freeze the equations, outcome definitions, seed list, and analysis before a confirmatory run.
2. Export individual action, food-pool, energy, tissue-state, and intervention events for every seed and arm.
3. Run an independent implementation and compare exact receipts on held-out seeds.
4. Add mechanistic development only after specifying and validating its rules; do not infer biological fidelity from richer visuals.
5. Evaluate cue drift with predeclared timing and paired calibration controls, including extinction and relearning.
