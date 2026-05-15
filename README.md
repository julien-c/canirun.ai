# canirun-ai.js

A readable rewrite of the browser-side hardware-detection module used by
[canirun.ai](https://www.canirun.ai/) — the site that tells you which local
AI models your machine can run.

The original module ships minified as `hardware-ui.<hash>.js`. This is the same
code with descriptive names, sectioning, JSDoc, and named constants in place of
magic numbers. Behavior, thresholds, shaders, and spec tables are unchanged.

## What it does

1. **Reads** what the browser will disclose:
   - WebGL `WEBGL_debug_renderer_info` → GPU vendor + renderer string
   - WebGPU `adapter.info` → device + architecture (when available)
   - `navigator.deviceMemory`, `navigator.hardwareConcurrency`, User-Agent
2. **Benchmarks** on-device:
   - CPU: a ~30ms `sqrt + sin + cos` loop
   - GPU compute (WebGPU): FMA loop → estimated GPU cores
   - GPU memory bandwidth: WebGPU buffer copy, with WebGL texture-sampling fallback
3. **Falls back** to spec-sheet lookup tables when APIs are blocked or vague
   (Apple GPUs report only "Apple GPU"; iOS hides everything; mobile vendors
   refuse to expose adapter info). Includes tables for desktop discrete GPUs,
   Apple Silicon, mobile SoC GPUs, and SBCs.
4. **Scores** model fit: classifies a model as `can-run`, `can-run-slow`,
   `tight`, `cannot-run`, or `unknown`, estimates tokens/sec, computes a 0–100
   score and a letter grade S–F.

All detection runs locally in the browser — no network calls.

## Usage

It's an ES module:

```js
import { detectHardware, scoreModel, describeDevice } from "./canirun-ai.js";

const hw = await detectHardware();
console.log(describeDevice(hw), hw);

// Score a 7B model that needs ~4.5 GB of memory
const result = scoreModel(4.5, hw, 4.5);
console.log(result); // { status, toksPerSec, memPct, score, grade }
```

## Credits

Original by [midudev](https://midu.dev). This repo is a code-clarity rewrite
for educational purposes; the methodology, heuristics, and spec tables are
his work.
