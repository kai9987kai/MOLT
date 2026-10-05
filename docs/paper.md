# MOLT: A Synthetic Paired-Ecology Laboratory for Cue Traces Across Tissue Loss and Regrowth

**Manuscript type:** exploratory computational software note  
**Simulator version:** 0.1.0  
**Status:** prototype description; not peer reviewed

## Abstract

Questions about information retained across biological remodeling arise in two different research areas: behavioral memory after brain regeneration and persistent patterning states that guide future regeneration. MOLT (Memory Ecology Lab) is a local, deterministic browser simulation that places a deliberately abstract version of such questions inside a paired, resource-limited toy ecology. For each seed, it compares a head-locked cue trace with a body-distributed trace under matched schedules, interventions, and choice noise. A simple controller converts the surviving trace into choices; choices then affect access to finite food and simulated survival. The dashboard records per-seed results, paired differences, a percentile bootstrap interval, and exportable summaries.

An illustrative version 0.1.0 run (base seed 82417; 24 paired seeds; paired training; head regrowth; 100% cue stability) produced 47.9% head-locked and 90.4% distributed choice accuracy. The mean paired difference was +42.5 percentage points (95% paired bootstrap interval +40.7 to +44.3). Distributed trace retention was 100%, versus 0% in the head-locked arm; distributed-arm survival was 90%. These are deterministic outputs of rules that encode the memory-placement contrast. They are not biological observations, evidence for a biological mechanism, or evidence of consciousness. MOLT is useful as an inspectable hypothesis-generation sandbox and as a starting point for stronger software experiments, not as a validated organism model.

**Keywords:** deterministic simulation; paired design; memory placement; regeneration; toy ecology; reproducibility

## 1. Introduction

Planarians offer a biological setting in which nervous-system regeneration and learned behavior can be studied in the same organism. Shomrat and Levin reported an automated environmental-familiarization protocol in which trained planarians showed evidence of memory retrieval in a savings paradigm after head regeneration [1]. A separate line of work concerns regenerative patterning: Durant and colleagues reported that transient manipulation of endogenous bioelectric signaling could produce stable changes in later regenerative anatomy in *Dugesia japonica* [2]. Behavioral cue memory and pattern memory are different phenomena. Neither study is reproduced by MOLT.

MOLT asks a narrower computational question: **if** a synthetic cue association is stored in three head cells or in nine body cells, how do those placements behave under a specified tissue intervention and test-world schedule? The simulator makes this assumption explicit and follows its consequences from trace retention to choices and access to shared resources. The purpose is to expose the causal assumptions in a small, reproducible system, not to claim that actual memory is stored in these locations or that biological tissues use the simulated update rule.

This manuscript documents the current implementation and one deterministic example run. It is a software note, not a preregistered experiment, a systematic review, or a biological study. The project does not claim that the broader research question or the component ideas are unprecedented.

## 2. Software and model

MOLT is implemented in browser JavaScript, HTML, CSS, and Canvas. It has no runtime package dependencies or remote service calls. The deterministic engine is in `src/engine.js`; `src/app.js` renders the controls and results, draws the synthetic ecology, and handles the session ledger and exports. The browser includes a demonstration run on opening the page; a locked run uses the same engine with the configuration selected in the interface.

### 2.1 Synthetic organism and memory representation

Each organism consists of twelve abstract cells: three designated head cells and nine body cells. The head-locked arm writes each cue trace to the three head cells. The distributed arm writes to the nine body cells. The controller is otherwise identical between arms. There is no neural network, gene-regulatory network, cell division, morphogen field, electrical coupling, developmental process, anatomy, or measured tissue in this model.

Training consists of 24 events with twelve presentations of each of two cues. In paired training, cue 0 maps to approach/resource (+1) and cue 1 maps to avoid/hazard (−1). Reversed training swaps the mappings. In unpaired training, each cue receives six positive and six negative outcomes, so the schedule contains no predictive cue mapping by construction. Each carrier cell stores outcome sums and counts. Its trace for a cue is the regularized average

\[
T_{i,c} = \frac{S_{i,c}}{N_{i,c}+2},
\]

where \(S_{i,c}\) and \(N_{i,c}\) are the stored outcome sum and count for cell \(i\) and cue \(c\). The arm-level cue trace averages the active carrier-cell traces, adds matched bounded noise, and clips the result to [−1, 1]. This is a software rule chosen for the prototype, not a proposed cellular memory mechanism.

### 2.2 Interventions

The current interface exposes four interventions:

- **Head regrowth:** replace the first three cells with blank, alive cells in both arms. In the head-locked arm these are all memory carriers; in the distributed arm the nine body carriers remain.
- **Cell turnover:** replace three randomly ordered cell positions with blank cells.
- **Yoked-twin graft:** replace 40% of an arm's memory-carrier positions, rounded up, with traces from a matched twin trained on opposite outcomes.
- **Sham:** preserve the cell state.

The reference run uses head regrowth. The intervention labels resemble biological operations but map only to array changes in this simulator.

### 2.3 Test controller and shared-resource ecology

Testing presents 24 balanced cue events. On each event, the cue's world mapping follows its trained mapping with the configured fidelity; otherwise, it is inverted. The controller converts the trace's alignment with the trained direction into confidence:

\[
q = 0.5 + 0.42\tanh(2.4a),
\]

where \(a\) is clipped trace alignment. Its probability of choosing correctly is \(q\) when the current mapping agrees with training and \(1-q\) when it does not. The controller does not learn a new mapping during the test.

For each seed, both arms share the cue and world schedule, intervention-position order, cohort order, and matched random draws for choices and trace noise. Each arm starts six organisms and an independent food pool initialized to the same stock. The pools can diverge as the arms' choices differ. Each pool starts at 2.4 units, has capacity 3.2, and replenishes by 0.55 units on resource events or 0.2 on hazard events. A correct resource choice consumes one available unit and adds 0.12 energy; an incorrect hazard choice removes 0.12 energy. Every event costs 0.006 energy, energy is bounded to [0, 1], and an organism is counted as dead when energy falls below 0.065. These values define a simple feedback mechanism; they are not calibrated ecological or physiological quantities.

### 2.4 Randomness, seeds, and summaries

The engine uses an explicit seeded pseudorandom-number generator. Replicate seed \(r\) is

\[
s_r = (s_0 + 104729r)\bmod 2^{32},
\]

where \(s_0\) is the base seed and \(r\) begins at zero. For each replicate and arm, accuracy and survival are averaged over six organisms. The primary choice contrast is the mean of the seed-level paired differences,

\[
\Delta_{choice} = \frac{1}{R}\sum_{r=1}^{R}(A_{distributed,r}-A_{head,r}).
\]

The interface reports a 95% percentile bootstrap interval based on 1,600 resamples of the \(R\) paired seed differences. The bootstrap generator is seeded deterministically from the base seed. The seed pair is the resampling unit; the six organisms within an arm share the same schedule and resource pool and are not treated as independent replicates. This interval describes variation across the selected simulated seeds under this specific model. It does not include uncertainty about the model rules and is not an inferential interval for a biological population.

Additional outputs include trace retention, survival, food finds, forecast Brier score, and choice accuracy by test exposure. Retention is undefined for unpaired training because no predictive association is trained. The Brier score measures the squared difference between the controller's forecast probability and its realized choice; it is not a measure of sentience, consciousness, or selfhood.

## 3. Reference run

The dashboard's locked reference run used simulator version 0.1.0 and protocol ID `MOLT-9DAA74B6`:

| Setting | Value |
| --- | --- |
| Base seed | 82417 |
| Matched seed pairs | 24 |
| Training | Paired |
| Intervention | Head regrowth |
| Cue stability | 100% |
| Choice/trace noise setting | 0.05 |
| Synthetic organisms | 288 (24 seeds × 2 arms × 6 organisms) |

| Outcome | Head-locked | Distributed |
| --- | ---: | ---: |
| Choice accuracy | 47.9% | 90.4% |
| Cue-trace retention | 0% | 100% |
| Survival at end | — | 90% |

The distributed-minus-head-locked choice-accuracy difference was **+42.5 percentage points**, with a deterministic 95% paired bootstrap interval of **+40.7 to +44.3 percentage points**. The distributed-minus-head-locked survival difference was +67.4 percentage points. The displayed values are rounded. The 100% fidelity setting means that this reference run has no cue-mapping flips during test; it does not test robustness to a changed or unstable world.

The run illustrates the specified implementation: head removal clears all three head-locked carriers and leaves the distributed arm's body carriers intact. Consequently, the retention contrast is built directly into the intervention and placement rules. The downstream choice and survival differences are outcomes of the controller and finite-pool rules. Their appearance is not an independent discovery about biological tissue.

## 4. Interpretation and limitations

The reference run supports only a conditional statement: **under simulator version 0.1.0, this configuration and these seeds produced the displayed outputs.** Because head regrowth is coded to erase the head carriers and spare the body carriers, high distributed retention is expected by design. The associated behavior follows from the controller's rule. A change in the storage, intervention, noise, or ecology assumptions can change the result.

Several boundaries are important:

1. **No biological implementation.** Cells, tissues, memory traces, feeding, hazards, and survival are symbolic state variables. MOLT does not model planarian anatomy, bioelectricity, neurons, gene expression, stem cells, or regeneration.
2. **No biological validation.** There are no organisms, laboratory measurements, human participants, or observations in the dataset. The application does not predict clinical or ecological outcomes.
3. **Restricted controller.** There is no online relearning during test, developmental controller, evolved policy, sensory system, or neural architecture. Choice probabilities are hand-coded.
4. **One reference condition.** The reported run uses 100% cue stability, paired training, and head regrowth. It does not answer how outcomes change under cue reversal, cell turnover, grafting, sham intervention, or environmental drift.
5. **Model-conditioned interval.** The bootstrap varies seed pairs while holding equations and parameters fixed. It does not quantify structural model uncertainty or validate the selected seed set as representative.
6. **Incomplete event log.** The JSON/CSV exports contain seed-level summaries and exposure aggregates, not complete event-by-event trajectories for every organism. The protocol ID is a short settings fingerprint, not a cryptographic integrity check.
7. **No preregistration or independent replication.** The interface locks settings before a run, but it does not create an externally timestamped preregistration. The results have not been checked against an independent reimplementation.

The biological literature motivates a careful distinction between acquired behavioral associations and persistent regenerative pattern states [1, 2]. MOLT currently represents only a hand-coded cue association. It should not be used to infer where biological memory resides, whether a biological memory survives regeneration, or what memory means for personal identity.

## 5. Reproducibility and next steps

To reproduce the reference condition, serve the project locally, select paired training, head regrowth, 100% cue stability, base seed 82417, and 24 matched seeds, then lock and run. With the same engine version and normalized settings, the simulation and bootstrap are deterministic. The protocol ID is computed from the normalized configuration and is not a file hash.

The next useful work is methodological rather than biological: export event-level traces and resource transitions; add an independent engine that reproduces exact outputs for frozen seeds; record machine-readable protocol manifests; predeclare tests across training, intervention, and cue-fidelity conditions; and run sensitivity analyses over controller, noise, energy, and pool parameters. Only after those steps could one make robust claims about behavior of this simulation. Biological claims would additionally require operationally matched experiments and empirical validation.

## 6. Data and code availability

The application and model code are in this project directory. JSON exports contain the selected run's settings, summary, seed-level rows, exposure aggregates, and interpretation boundary. CSV exports contain the session ledger. Runs are held in browser memory until exported; refreshing the page resets the session. Neither export is a complete event-level raw-data archive.

## References

1. Shomrat, T., & Levin, M. (2013). [An automated training paradigm reveals long-term memory in planarians and its persistence through head regeneration](https://journals.biologists.com/jeb/article/216/20/3799/11714/An-automated-training-paradigm-reveals-long-term). *Journal of Experimental Biology, 216*(20), 3799–3810. https://doi.org/10.1242/jeb.087809.
2. Durant, F., Morokuma, J., Fields, C., Williams, K., Adams, D. S., & Levin, M. (2017). [Long-term, stochastic editing of regenerative anatomy via targeting endogenous bioelectric gradients](https://pmc.ncbi.nlm.nih.gov/articles/PMC5443973/). *Biophysical Journal, 112*(10), 2231–2243. https://doi.org/10.1016/j.bpj.2017.04.011.
