# MediaPipe Assets

This directory holds the on-device face landmark model and WASM runtime used by
the gaze & presence analysis feature. These files are **not** committed to git
(they are large binary build artifacts). Run the setup script after `npm install`
to populate this directory.

## License

The MediaPipe Tasks Vision library and face landmark model are distributed by
Google under the **Apache License 2.0**.
See: https://github.com/google-ai-edge/mediapipe

## Files required

| File | Source |
|------|--------|
| `face_landmarker.task` | Downloaded from Google storage (see below) |
| `wasm/vision_wasm_internal.js` | Copied from `node_modules/@mediapipe/tasks-vision/wasm/` |
| `wasm/vision_wasm_internal.wasm` | Copied from `node_modules/@mediapipe/tasks-vision/wasm/` |
| `wasm/vision_wasm_nosimd_internal.js` | Copied from `node_modules/@mediapipe/tasks-vision/wasm/` |
| `wasm/vision_wasm_nosimd_internal.wasm` | Copied from `node_modules/@mediapipe/tasks-vision/wasm/` |

## Setup

From `apps/web/`:

```bash
bash scripts/setup-mediapipe.sh
```

Or manually:

```bash
# Copy WASM runtime
mkdir -p public/mediapipe/wasm
cp node_modules/@mediapipe/tasks-vision/wasm/* public/mediapipe/wasm/

# Download face landmark model (~4 MB, float16, v1)
curl -L \
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task" \
  -o public/mediapipe/face_landmarker.task
```

## When to re-run

Re-run the setup script after:
- `npm install` (in case `@mediapipe/tasks-vision` was updated)
- A fresh clone of the repository
