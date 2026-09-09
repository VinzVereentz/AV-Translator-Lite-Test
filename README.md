# AV Translator Fixed

GitHub Pages package. No API key/backend required.

Fixes the 100% model-loading hang by explicitly initializing WebGPU and falling back to WASM/CPU when WebGPU initialization fails.
