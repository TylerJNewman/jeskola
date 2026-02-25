# The 80/20 of Jeskola Buzz's Sound Engine

## 1. Executive summary

Jeskola Buzz's disproportionate creative power came from **one architectural insight no other tool replicated**: the fusion of a free-form modular signal graph with per-machine tracker-pattern sequencing inside a single lightweight environment. Generators (sources) and Effects (processors) connected as nodes in a directed acyclic graph, while each machine owned independent patterns of arbitrary length — enabling polymetric, polyrhythmic composition that traditional trackers and DAWs couldn't match. The **Tick()/Work() dual-phase processing model** separated control-rate parameter updates from audio-rate sample processing, mirroring analog modular's kr/ar split at near-zero complexity. Peer machines (dedicated control nodes) could modulate any parameter of any other machine, creating a universal modulation bus without hardcoded automation lanes. The plugin API was deliberately minimal (~200 lines of header), spawning hundreds of community-built machines. DSP-wise, **state variable filters, simple oscillators, delay lines, and ADSR envelopes** covered ~80% of all sonic output. Artists like The Field built entire careers on Buzz's pattern-loop workflow, layering micro-sampled fragments into hypnotic textures. The 80/20 lesson: **graph routing + per-machine patterns + a handful of well-implemented DSP primitives** produce almost all of Buzz's creative output. Everything else is amplification.

---

## 2. The high-leverage core

| Rank | Feature | Why it mattered | Impl. difficulty | Priority (1–10) |
|------|---------|----------------|-----------------|-----------------|
| 1 | **Directed graph audio routing (DAG)** | Enabled arbitrary signal chains — parallel processing, sends, splits, merges. Buzz's #1 architectural differentiator vs. linear-chain DAWs and global-pattern trackers. Topological sort guaranteed correct processing order. | High | **10** |
| 2 | **Per-machine pattern sequencer** | Each machine owned independent patterns of variable length. A 4-tick hi-hat loop, 64-tick bass line, and 128-tick ambient pad ran simultaneously. This created the polymetric layering essential to techno/ambient. No other tracker did this. | High | **10** |
| 3 | **ADSR envelope generator** | Transformed continuous oscillator drones into musical notes. Controlled both amplitude and filter cutoff. Every Buzz generator had envelopes built in; in a modular system this must be explicit. | Medium | **9** |
| 4 | **LFO / modulation source** | PeerLFO was called "obligatory" by the community. Modulating filter cutoff with an LFO is the single cheapest way to add movement. Without it, sounds are static. Buzz's peer system made any parameter a modulation target. | Low | **9** |
| 5 | **Tick/Work dual-phase processing** | Tick() updated parameters at control rate (once per musical tick); Work() processed audio buffers up to 256 samples. This separation enabled efficient parameter automation, smooth interpolation, and tick-synced effects. | Medium | **9** |
| 6 | **NoValue sparse parameter model** | Pattern cells used a sentinel value (0xFF/0xFFFF) meaning "no change." Only modified parameters consumed pattern space. This made patterns readable, compact, and fast to edit — the backbone of tracker workflow speed. | Low | **8** |
| 7 | **Parameter interpolation (inertia)** | Without per-sample interpolation between tick-boundary parameter changes, filter sweeps click audibly. Buzz machines that sounded good all implemented internal smoothing. Critical for audio quality. | Medium | **8** |
| 8 | **Distortion / waveshaping** | Extremely high impact-to-effort ratio. A single `tanh(gain * x)` transforms bland oscillators into harmonically rich timbres. Joachims Mars 2 and Cheapo Amp were among the most-used Buzz machines. | Low | **8** |
| 9 | **Sequence editor (pattern arrangement)** | Arranged named patterns on a per-machine timeline. Keyboard-driven: type a letter to place a pattern, Enter to dive in/out. Users called this workflow "unbeatable" — the speed from idea to arrangement was seconds. | Medium | **8** |
| 10 | **Sample playback module** | Matilde Tracker was the single most-used Buzz machine. Sample playback covers drums, vocals, textures — everything synthesis alone cannot. The Field's entire micro-sampling technique depended on this. | Medium–Hard | **7** |
| 11 | **Generator/Effect/Master taxonomy** | Strict machine types guided users: generators produce audio (blue), effects process it (red), Master is the terminal sink. Simpler than pure-modular's "anything goes" while more flexible than DAW channel strips. | Low | **7** |
| 12 | **Reverb (Schroeder/Freeverb)** | Spatial depth was essential for polished output. Freeverb's 8 parallel comb filters → 4 series allpass filters was the standard. "Raverb" and "HALYverb" appeared in nearly every Buzz project. | Medium–Hard | **7** |
| 13 | **Per-connection gain control** | Every wire in the graph had an adjustable amplitude (−∞ dB to +12 dB). This eliminated the need for dedicated gain modules on every connection and made mixing intuitive within the routing view. | Low | **6** |
| 14 | **Shared wavetable system** | Numbered sample slots accessible by any machine. Load a sample once, trigger it from multiple generators. Elegant resource sharing that simplified multi-machine compositions. | Medium | **5** |
| 15 | **Peer machine system** | Dedicated control machines (MIF_CONTROL_MACHINE) that called ControlChange() on target machines. PeerLFO, PeerCtrl, PeerADSR, PeerState — a universal modulation framework without hardcoded automation. | High | **5** |

### Priority tiers at a glance

- **Absolutely essential for replication** (rows 1–5): DAG routing, per-machine patterns, ADSR, LFO, Tick/Work processing. These five features account for the vast majority of Buzz's creative identity. Without any one of them, the system feels fundamentally incomplete.
- **Strongly recommended** (rows 6–12): NoValue model, parameter interpolation, distortion, sequence editor, sample playback, machine taxonomy, reverb. These convert a "tech demo" into a usable creative tool.
- **Nice but not critical** (rows 13–15): Per-connection gain, shared wavetable, full peer machine system. These refine the experience but can be simulated with workarounds or added incrementally.

---

## 3. DSP fundamentals worth researching deeply

**Filters — the most impactful single DSP category in Buzz's ecosystem:**

- **Chamberlin State Variable Filter (SVF):** The workhorse topology. Simultaneously outputs LP, HP, BP, and notch from ~6 multiplies per sample. Becomes unstable above ~fs/6; the double-sampled variant (process the filter twice per audio sample) extends the stable range. This was the filter inside Jeskola Filter, Automation 2-pole, FSM Infector, and dozens of other machines. Research the Chamberlin formulation specifically — it's the 80/20 filter.

- **Moog ladder filter (4-pole, 24 dB/oct):** Used in Zephod MoogFiltah, Oomek Aggressor 303, and TB-303 emulations. The Stilson/Smith simplified model cascades four one-pole sections with a global feedback path. Produces self-oscillation at high resonance and the characteristic "fat" bass. Costs ~8 multiplies per sample. Study the Huovilainen improved model for better behavior at high cutoff frequencies.

- **Parameter smoothing (exponential one-pole):** `current += alpha * (target - current)` where `alpha = 1 - exp(-2π * smoothingHz / sampleRate)`. Apply this to every parameter that can be automated — filter cutoff, gain, delay time — to eliminate zipper noise. This is the single most important quality-of-life DSP technique.

**Oscillators — simpler than expected:**

- **Naive waveforms with anti-aliasing:** Most Buzz oscillators used direct computation (phase accumulator → waveform function). Modern implementations should use **PolyBLEP** (Polynomial Band-Limited Step): ~4 multiplies per sample, applies polynomial correction near waveform discontinuities. Research Välimäki et al.'s work. For a saw wave: compute naive saw, then subtract `polyBLEP(phase, phaseIncrement)` at the discontinuity.

- **Wavetable with mip-mapping:** Pre-compute band-limited versions of waveforms at different octave ranges. Select the appropriate table based on playback frequency. Buzz's built-in oscillator tables used 11 mip-map levels (2048 down to 2 samples per cycle). This approach is used in virtually all commercial wavetable synths.

**Delay-based effects — maximum versatility from one primitive:**

- **Delay line with fractional-sample interpolation:** A circular buffer with a read pointer that can be modulated. Linear interpolation is adequate for most effects; cubic (Hermite) interpolation is better for chorus/flanger where the read pointer moves continuously. From this single primitive you get: echo (fixed delay + feedback), chorus (short modulated delay, 10–30 ms, mixed with dry), flanger (very short modulated delay, 1–10 ms, with feedback), comb filter (delay + feedback, no dry mix), and the building block for all algorithmic reverbs.

- **Freeverb algorithm:** 8 parallel filtered-feedback comb filters → 4 series allpass diffusers. Comb filters use a one-pole lowpass in the feedback path for frequency-dependent decay (damping). Stereo spread by offsetting right-channel delay lengths by +23 samples. The specific delay lengths (1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617 for combs; 556, 441, 341, 225 for allpass) are tuned to avoid metallic resonances. Total cost: ~50 operations per stereo sample. The Freeverb source is public domain.

**Distortion — highest ratio of sonic impact to implementation cost:**

- **Soft clipping via `tanh()`:** `output = tanh(drive * input)`. Produces smooth saturation with odd harmonics. Use a fast rational approximation: `x * (27 + x²) / (27 + 9x²)`. For more aggressive character, try foldback distortion: `while (|x| > threshold) x = 2*threshold - x`.

- **Oversampling for distortion:** Waveshaping generates harmonics that alias. Upsample 2× or 4× before the waveshaper, then downsample with a half-band filter after. This eliminates the harsh, inharmonic artifacts of aliased distortion.

**Envelopes and LFOs — the minimum viable modulation stack:**

- **Exponential ADSR:** Linear envelopes sound unnatural. Use `level *= decayCoefficient` for decay/release stages (where coefficient = `exp(-1 / (time_seconds * sampleRate))`). The attack stage can use `level += (1.0 - level) * attackCoeff` for a concave curve that overshoots slightly, mimicking analog capacitor charging.

- **Tempo-synced LFO:** Rate expressed as a note division (1/4, 1/8, 1/16, dotted, triplet). Convert to Hz: `lfoHz = (BPM / 60) * divisor`. Phase accumulator + waveform lookup (sine, triangle, saw, square, sample-and-hold). The ability to sync LFO rate to tempo was a defining feature of Buzz's PeerLFO.

**Sample playback — the other half of Buzz's sound:**

- **Variable-rate playback with interpolation:** The core of every sampler. Read position advances by `playbackRate = noteFrequency / rootFrequency` per sample. Linear interpolation: `output = buffer[i] * (1-frac) + buffer[i+1] * frac`. Cubic Hermite interpolation uses 4 points and sounds significantly better for pitched content. Matilde Tracker was "the single most important machine" in the Buzz ecosystem.

---

## 4. Architectural insights

### The directed acyclic graph is the foundation

Buzz's entire identity rests on its **machine graph** — a directed acyclic graph where nodes are audio-processing modules and edges are audio connections carrying stereo float buffers. The engine performs a topological sort to determine processing order: generators first, then effects in dependency order, Master last. Each edge has an adjustable gain (−∞ to +12 dB). When multiple edges converge on one node, their signals are summed before processing.

The critical implementation details: **fan-out** (one generator feeding multiple parallel effect chains) and **fan-in** (multiple sources mixing into one effect or the Master) must both work seamlessly. Buzz disallowed cycles in the graph to prevent infinite feedback, though some users worked around this with single-tick-delay feedback machines. For your implementation, either enforce acyclicity or insert an automatic one-buffer delay on any feedback edge.

The Work() function's boolean return value was architecturally important: returning `false` meant "I produced silence." The engine used this for **lazy evaluation** — if all inputs to an effect were silent, it could skip processing that effect entirely. This optimization allowed Buzz to run dozens of machines simultaneously on 1990s hardware.

### Tick/Work separation mirrors control-rate vs. audio-rate

Every machine implemented two core methods. **`Tick()`** was called once per musical tick with new parameter values from the pattern editor. **`Work(float* buffer, int numSamples, int mode)`** was called to fill audio buffers (up to 256 samples at a time, multiple calls per tick). This cleanly separates the "what changed musically" question from the "generate audio" question.

At 125 BPM with 4 ticks per beat, one tick equals ~5,292 samples (~120 ms). Parameters set in Tick() remain constant until the next Tick() call unless the machine internally interpolates. This is why parameter smoothing matters — a filter cutoff that jumps from 200 Hz to 8,000 Hz in a single sample will click. Well-implemented machines stored the target value from Tick() and smoothed toward it sample-by-sample inside Work().

The **SubTick system** (added later) subdivided ticks for finer control resolution. Control machines could call `ControlChangeImmediate()` to update parameters between tick boundaries, enabling near-sample-accurate modulation. For your implementation, start with basic tick-level updates and add subtick interpolation as a refinement.

### Per-machine patterns are the sequencing breakthrough

In traditional trackers (ProTracker, FastTracker, Renoise), all channels share one global pattern. Change the drum pattern and you must duplicate the entire pattern including all other instruments. Buzz inverted this: **each machine owns its own patterns**, independently named and variably sized. The sequence editor arranges these per-machine patterns on a shared timeline.

This means a kick drum can loop a 16-tick pattern while a synth pad plays through a 128-tick pattern simultaneously. The patterns phase against each other naturally, creating the polymetric layering that defines minimal techno. The Field's signature sound — hypnotic, subtly evolving micro-sample loops — is this architecture made audible.

Patterns used a **sparse representation**: each cell either contained a value or `NoValue` (0xFF for byte parameters, 0xFFFF for word parameters). The NoValue sentinel meant "leave this parameter unchanged." Only rows with actual changes needed to be written. This made patterns fast to read, fast to edit, and memory-efficient.

Parameters were split into **global** (affecting the entire machine — filter cutoff, resonance, LFO rate) and **track** (per-voice — note, velocity, instrument number). Adding a "track" to a machine in the pattern editor added another column of track parameters, giving built-in polyphony. This global/track split is architecturally elegant and worth replicating.

### The plugin API succeeded through radical simplicity

Buzz's machine API (`CMachineInterface`) was ~200 lines of C++ header. A machine declared its parameters as static structs, implemented `Init()`, `Tick()`, `Work()`, and optionally `Save()`/`Stop()`. The host populated `GlobalVals` and `TrackVals` pointers before each `Tick()` call — no getter/setter boilerplate. This simplicity spawned hundreds of community machines: the barrier to creating a new synth or effect was a single afternoon of C++ coding.

The `CMICallbacks` interface gave machines access to host services: reading other machines' parameters (`GetMachineInfo`), controlling other machines (`ControlChange`), accessing the shared wavetable (`GetWave`, `GetWaveLevel`), and querying timing (`pMasterInfo->BeatsPerMin`). Peer/control machines used these callbacks to build a universal modulation layer on top of the base architecture.

If you plan to support user-extensible modules, design your module interface to be similarly minimal: parameter declaration, init, tick (parameter update), work (audio process), and a callback object for host services.

---

## 5. If I only implement 5 more things, they should be

You currently have: Oscillator, Filter, Delay, Gain. Here are the five additions that will close the largest gap between "tech demo" and "creative instrument," ranked by impact:

**1. ADSR Envelope Generator → makes notes possible**

Without envelopes, your oscillator drones continuously. An ADSR is what turns a waveform into a playable instrument. It should output a 0–1 control signal routable to your Gain module (amplitude envelope) and your Filter module (timbral envelope). Implement exponential curves for natural-sounding decay and release: `level *= exp(-1 / (time * sampleRate))`. The attack stage should use a concave curve for analog feel. This is the single highest-impact module you're missing — it transforms static sound into dynamic music. **Implementation: Medium. A few days of work.**

**2. LFO module → makes sound move**

A low-frequency oscillator with sine, triangle, saw, square, and sample-and-hold waveforms, outputting a bipolar control signal routable to any parameter. Rate should support both free-running (Hz) and tempo-synced (note divisions) modes. Modulating filter cutoff with a sine LFO is the single most common sound design move in electronic music. PeerLFO was called "obligatory" by the Buzz community — the tool that made static patches come alive. **Implementation: Low. An afternoon, architecturally identical to your existing Oscillator but operating at control rate.**

**3. Flexible signal routing graph → makes it Buzz**

This is where your application diverges from a linear effects chain into a true Buzz-inspired environment. Implement a directed acyclic graph where any module output can connect to any module input. You need: topological sort for processing order, fan-out (one source → multiple destinations via signal copying), fan-in (multiple sources → one destination via sample-wise summing), and per-connection gain. Add a Master/output node as the terminal sink. Visually, render the graph as draggable boxes with connectable ports — Buzz's Machine View was consistently cited as the #1 reason users stayed with the software for 15+ years. **Implementation: High. This is an architectural commitment — likely 2–4 weeks — but it is the defining feature.**

**4. Pattern sequencer with per-step parameter automation → makes composition possible**

Implement a minimal tracker-style pattern editor: a 2D grid where rows are ticks and columns are parameters (note, velocity, filter cutoff, etc.). Each module should own its own patterns with independently variable lengths. Use a NoValue sentinel for empty cells. Then implement a sequence editor that arranges named patterns on a per-module timeline. Support BPM and ticks-per-beat as global timing parameters. The per-machine pattern model is Buzz's other defining innovation — it naturally creates the polymetric layering that powers minimal techno and ambient. Users described this workflow as "unbeatable" for speed. **Implementation: High. The pattern editor alone is substantial; the sequence arranger adds more. Budget 2–4 weeks.**

**5. Distortion/waveshaping module → most sound per line of code**

A `tanh(drive * input)` soft clipper with input gain, output gain, and dry/wet mix. Optionally add foldback distortion and hard clipping modes. This is the highest-impact module per line of implementation code: it transforms bland oscillator tones into rich, harmonically complex timbres. In Buzz, distortion before a resonant filter was the foundation of acid bass, aggressive leads, and warm pads alike. Cheapo Amp and Joachims Mars 2 appeared in nearly every Buzz project. For quality, add 2× oversampling (upsample → waveshape → downsample with half-band filter) to prevent aliasing. **Implementation: Low. A single function plus optional oversampling. One day of work.**

### What this gives you

With these five additions, your signal chain becomes: **Oscillator → Distortion → Filter → [ADSR on Filter + Gain] → Delay → Master**, with LFO modulating any parameter and the pattern sequencer driving everything. Routed through a flexible graph, this is the core of Buzz's sound. You can make subtractive synth patches, evolving ambient textures, rhythmic sequences, and layered compositions. The remaining gaps (reverb, sample playback, mixer/bus) are important but secondary — they refine rather than enable.

---

## 6. Research roadmap

### Phase 1 — Immediate (supports your next 5 implementations)

**DSP implementation references:**
- **"The Art of VA Filter Design" by Vadim Zavalishin (free PDF from Native Instruments):** The definitive resource on digital filter design for audio. Covers SVF, ladder filters, nonlinear modeling, and zero-delay feedback topologies. Chapter 3 (the SVF) and Chapter 6 (nonlinear filters) are directly applicable.
- **Julius O. Smith's online textbook "Physical Audio Signal Processing" (ccrma.stanford.edu/~jos):** Free. Covers delay lines, comb filters, allpass filters, and reverb algorithms with mathematical rigor. Essential for understanding your delay module and future reverb.
- **musicdsp.org source code archive:** Community-curated DSP algorithm snippets. Search for "state variable filter," "polyBLEP oscillator," "envelope generator," "soft clipping." These are often Buzz-era implementations.

**Architecture references:**
- **Buzz's `MachineInterface.h` header file (available on jeskola.net and GitHub buzzmachines repo):** Read the actual API. The ~200-line header reveals every architectural decision. Focus on CMachineInterface, CMachineParameter, CMasterInfo, and CMICallbacks.
- **ReBuzz open-source project (github.com/wasteddesign/ReBuzz):** A modern C# rewrite of Buzz. Study its graph processing, tick/work separation, and machine hosting code for a clean reference implementation.

### Phase 2 — Near-term (enriching your DSP toolkit)

**Synthesis deep dives:**
- **"Designing Sound" by Andy Farnell:** Practical sound design with Pure Data. Teaches how to build sounds from DSP primitives — directly applicable to designing your module library.
- **Wavetable synthesis and mip-mapping:** Study how Serum and Vital implement wavetable oscillators. The key concept is band-limiting via FFT: compute the spectrum, zero harmonics above Nyquist for the current pitch, inverse-FFT back to time domain, store as mip-map levels.
- **FM synthesis fundamentals:** Chowning's original paper "The Synthesis of Complex Audio Spectra by Means of Frequency Modulation" (1973). FM is extremely CPU-cheap and generates complex timbres from simple oscillators — high leverage for a minimal system.

**Sequencing and timing:**
- **Tracker sequencing models:** Study Renoise's pattern matrix and OpenMPT's pattern/order system to understand the tradeoffs between global and per-machine patterns. Renoise chose global patterns (simpler implementation) while Buzz chose per-machine (more creative power).
- **Ableton Live's clip launching model:** Conceptually similar to Buzz's per-machine patterns. Study how clips of different lengths interact on the timeline and how quantization handles synchronization.

### Phase 3 — Longer-term (advanced capabilities)

**Modulation architecture:**
- **Study SuperCollider's control-rate/audio-rate bus system:** Buses carry either audio or control signals; any UGen output can write to a bus, any input can read from one. This is the generalized version of Buzz's peer machine system.
- **VCV Rack's CV/Gate paradigm:** Every output is a continuous signal. Modulation is just "connect any output to any input." Study how VCV Rack normalizes signal ranges and handles polyphony.
- **Modulation matrix design patterns:** How Vital, Serum, and Bitwig handle arbitrary source→destination modulation with per-route depth and curve controls.

**Sample playback and granular:**
- **Granular synthesis:** Curtis Roads' "Microsound" is the theoretical foundation. For implementation, study the Clouds module in VCV Rack (based on Mutable Instruments Clouds) — it turns sample playback into ambient texture generation, directly relevant to The Field's aesthetic.
- **Karplus-Strong string synthesis:** A single delay line with a lowpass filter in the feedback loop. Generates realistic plucked-string sounds from ~10 lines of code. The highest-leverage physical model.

**Real-time audio programming:**
- **"Designing Audio Effect Plugins in C++" by Will Pirkle:** Covers the practical engineering of audio plugins — buffer management, parameter smoothing, thread safety, GUI integration. Directly applicable to building your module system.
- **The Audio Programmer community (YouTube/Discord):** Active community focused on JUCE, Web Audio API, and Rust audio development. Practical implementation guidance.

### The meta-lesson from Buzz

Buzz proved that **a small number of well-composed DSP primitives, connected through a flexible graph and driven by a fast sequencing workflow, produces more music than any amount of sophisticated individual components**. The community consistently valued workflow speed, routing flexibility, and modulation capability over DSP fidelity. Your implementation roadmap should follow the same priority: get the graph routing and sequencer working first, then iteratively improve DSP quality. A mediocre filter that you can modulate and sequence is infinitely more useful than a perfect filter you can only set statically.