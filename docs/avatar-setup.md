# 3D Avatar Setup

The behavioral interview uses a 3D avatar with lip-sync. You need a GLB avatar file with **viseme blend shapes** (morph targets) and **ARKit blend shapes** for facial animations.

## Option A: Avaturn (recommended)

[Avaturn](https://avaturn.me/) creates realistic 3D avatars from a selfie with viseme and ARKit blend shapes included out of the box.

1. **Create an account** at [avaturn.me](https://avaturn.me/) (free tier available)

2. **Create your avatar:**
   - Click **"Create Avatar"**
   - Upload a selfie or use one of the preset options
   - Customize appearance (face, hair, outfit, etc.)
   - Choose **Half-body** for the interview video-call layout

3. **Export as GLB:**
   - Once your avatar is ready, click the **Export** / **Download** button
   - Select **GLB** format
   - Make sure **ARKit blend shapes** and **Visemes** are enabled in export settings
   - Download the file

4. **Place the file in the project:**
   ```bash
   mv ~/Downloads/avatar.glb apps/web/public/avatars/interviewer.glb
   ```

## Option B: Sketchfab (pre-made models)

You can find free avatars with blend shapes on [Sketchfab](https://sketchfab.com/tags/blendshapes):

1. Search for avatars tagged with **"blendshapes"** or **"viseme"**
2. Filter by **Downloadable** and **Free**
3. Download in **GLB** format
4. Place as `apps/web/public/avatars/interviewer.glb`

> Make sure the model includes Oculus/ARKit viseme morph targets (see table below).

## Option C: Custom avatar (Blender)

If you have a custom model, you can add viseme blend shapes in [Blender](https://www.blender.org/) using the [CATS Blender Plugin](https://github.com/teamneoneko/Cats-Blender-Plugin):

1. Import your model into Blender
2. Install CATS plugin → use **Viseme** panel to auto-generate viseme shape keys
3. Export as GLB with morph targets enabled

## Required morph targets

The app uses these morph targets for lip-sync and idle animations:

| Morph Target | Purpose |
|---|---|
| `viseme_sil` | Silence / mouth closed |
| `viseme_aa` | "ah" sound |
| `viseme_E` | "eh" sound |
| `viseme_I` | "ee" sound |
| `viseme_O` | "oh" sound |
| `viseme_U` | "oo" sound |
| `viseme_FF` | "f" / "v" sounds |
| `viseme_TH` | "th" sound |
| `viseme_PP` | "p" / "b" / "m" sounds |
| `viseme_SS` | "s" / "z" sounds |
| `viseme_CH` | "sh" / "ch" sounds |
| `viseme_nn` | "n" / "ng" sounds |
| `viseme_RR` | "r" sound |
| `viseme_DD` | "d" / "t" sounds |
| `viseme_kk` | "k" / "g" sounds |
| `eyeBlinkLeft` | Left eye blink (idle animation) |
| `eyeBlinkRight` | Right eye blink (idle animation) |
| `mouthSmile` | Smile (idle animation) |

## Verifying morph targets

Inspect your GLB file at [gltf-viewer.donmccurdy.com](https://gltf-viewer.donmccurdy.com/) — drag your file in and check the **Morph Targets** section to confirm viseme blend shapes are present.

The app expects the avatar at **`apps/web/public/avatars/interviewer.glb`**.
