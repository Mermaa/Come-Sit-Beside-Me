# Come Sit Beside Me · Memory / Light

A fictional web artwork about visiting a woman who lives with dementia. Darkness holds her things; the visitor's attention is a light. When an object comes close, she speaks a fragment of memory beside it. Her words drift, change and disappear.

## Run

Run `python3 -m http.server 8081 --bind 127.0.0.1` in this directory, then open http://127.0.0.1:8081/. Keep the server running. `Start Afterglow.command` is the existing macOS launcher.

## Interaction

- The doorway and optional camera-permission choice are unchanged. Choosing Come in keeps the approved camera feed locally for mask-only body segmentation after entry. Choosing without the camera never requests a feed. Nothing is recorded or uploaded; tracks stop on page exit or segmentation failure.
- Move slowly with a pointer or touch; arrow keys move attention. A half-second stay on an object brings it forward. Space pauses drifting; reduced motion disables drifting, parallax and sway.
- Four distant objects are drawn with a low-resolution renderer at approximately 15fps, with blur and dim illumination. Only one object can be in front. The foreground has a 0.3px blur and stays beneath the original radial black veil; words and grain are above it.
- Words begin only after the selected object approaches. They appear at 22 characters per second, hold for four seconds, then spread, blur and fade over 2.6 seconds. Moving away starts their dispersal early. Reduced motion keeps only a short opacity fade.
- Desktop speech sits to one side; mobile speech sits below the object. No paper, age label, floating text echo or contact-shadow surfaces remain.
- Existing sound remains off by default. No new sound functionality was added; obsolete paper rustle code was removed with the paper presentation.
- Help and Sound are the only toolbar controls. Leave a memory appears only in the ending invitation. Visitor messages remain in localStorage on this device; they are not mixed into her eight fictional memories or shared online.
- The existing ending starts after six different memories have fully spoken, or four minutes of exploration. Age 83 is reserved for the ending. After the teacup invitation, confirmed sitting or the Sit beside her button triggers “You’re here.” If no response arrives within 18 seconds, she says “The tea has gone cold.” Both paths lead to the leave-a-memory invitation.

## Confusion clock

`confusion` starts at zero after entering darkness and initially reaches one in approximately 240 seconds. After the silhouette appears, the remaining distance to one takes approximately 180 seconds. It pauses while a dialog is open or the page is hidden. Clarity covers its expression without reducing the clock.

Each visit samples stable error rolls; increasing confusion increases their probability without per-frame rerolling. Thresholds are strict: language above 0.2, partial noise dissolution above 0.3, a distant wrong-era silhouette above 0.45, another object's words above 0.55, and a two-second point-scatter transformation above 0.7. Transformation also switches speech to the new object's memory; age 83 is excluded from all error targets. At zero there are no errors. Reduced motion omits point scattering and uses a gradual dissolution between objects.

Clarity keeps the original blink (0.25s close, 0.3s black, 0.8s open), restores the original complete object and correct words, and fades back into the underlying confusion over three seconds. Existing sound behavior is unchanged.

## Visitor silhouette

The first complete 36-year memory stays correct so its infant reference precedes her noticing the visitor. After its speech completes and begins to disperse, the silhouette fades in nearby. If it has not been found after 90 seconds in darkness, that object drifts into the current light. The no-camera route uses a generic dark, faceless outline.

With camera permission only, `visitor-silhouette.js` dynamically loads ml5 **1.2.1** from jsDelivr and uses `bodySegmentation('SelfieSegmentation', {modelType:'general', maskType:'person'})`. It awaits model readiness and calls the documented one-shot `detect(canvas)` on a 320×240 input, at most 12 times per second with only one inference in flight. The person display mask is inverted and downsampled to 160×120; only mask frames are held in a bounded, in-memory half-second delay buffer. No camera pixels are drawn to the artwork, recorded, persisted or sent over the network. CDN/model downloads still require an internet connection. Unsupported/denied cameras and model failures use the generic outline. Hidden pages suspend inference; leaving the page stops tracks.

The blurred dark silhouette sits at CSS depth −240 under the unchanged black light veil and follows scene parallax. Mask movement increases blur and fragmentation. Speech uses the same reveal, four-second hold, dispersal and live announcement as object memories. The first address recalls the infant (“There you are, my little one.”), unless she has already reached silence; subsequent phrases change at confusion 0.4 / 0.65 / 0.85; the last stage is silent. A new phrase requires another light entry and a minimum 20-second pause after the last utterance. Clarity temporarily uses “There you are.” without rewinding confusion. Standing/sitting diagnostics are described below; no new sound features were added.

Official API reference: https://docs.ml5js.org/#/reference/body-segmentation (plain Markdown: https://docs.ml5js.org/reference/body-segmentation.md). Pinned source: https://cdn.jsdelivr.net/gh/ml5js/ml5-next-gen@v1.2.1/src/BodySegmentation/index.js.

## Standing / sitting diagnostics

`visitor-posture.js` uses the same approved camera and pinned ml5 1.2.1 library: `bodyPose('MoveNet', {modelType:'SINGLEPOSE_LIGHTNING', enableSmoothing:true})`, awaited readiness and one-shot `detect(canvas)`. There is no extra camera request. Pose estimation is serialized with segmentation on the same 320×240 canvas, capped at 5 Hz; slow pose calls reduce it to 3 Hz and allow segmentation to fall to 8 Hz. A pose-model failure leaves segmentation running. Hidden pages skip both. Only ephemeral landmark numbers are retained; no images or poses are saved or uploaded.

For each confident visible side, the score is `(kneeY - hipY) / distance(shoulder, hip)`. Valid sides are averaged. This ratio is unchanged by uniform image scaling and translation, so moving farther away alone does not classify sitting. Default threshold is 0.45, with a ±0.08 hysteresis band; a new candidate must remain for 1.5 seconds. Weak confidence, cropped knees, inconsistent sides and long sample gaps cancel confirmation. Lost tracking becomes unknown rather than sitting. The camera should include shoulders, hips and knees.

The debug-only “模拟坐下” button feeds synthetic landmark coordinates through the same persistence test; its output is explicitly marked simulation. Press again to restore real-camera diagnostics. The threshold slider does not alter confusion. A simulated sitting result can exercise the ending while debug mode is enabled.

Official reference: https://docs.ml5js.org/#/reference/bodypose and https://github.com/ml5js/ml5-next-gen/blob/main/src/BodyPose/index.js.

## Files

- `COME-SIT-BESIDE-ME.md`: project rules; read before each step.
- `index.html`: doorway, speech surface, controls, dialogs and ending invitation.
- `script.js`: exploration, speech lifecycle, memory corruption, existing audio and ending.
- `visitor-posture.js`: local MoveNet posture diagnostics, normalized landmark classifier, confirmation and simulation.
- `visitor-silhouette.js`: local camera masks, half-second delay, faceless fallback and medium-depth rendering.
- `memory-object3d.js`: per-age fixed angles / relative sizes, sequential loading, low-resolution background and foreground rendering. Edit the `models` table at the top to tune presentation.
- `style.css`: interface, light veil, words, grain, accessibility and doorway.
- `assets/models/`: compressed objects plus provenance metadata.
- `assets/vendor/`: Meshopt decoder 0.22.0 and its license.

## Memory objects

| Age | Asset | Supplied source |
| --- | --- | --- |
| 06 | obj-06-kids-cycle.glb | fbx.glb (Kids Cycle) |
| 11 | obj-11-autograph-book.glb | leather_book.glb |
| 17 | obj-17-cassette.glb | boombox_dirty_low_poly.glb (a whole boombox) |
| 24 | obj-24-key.glb | rust_key.zip |
| 36 | old-duck-toy.glb | allduckchick.fbx; confirmed duck toy |
| 52 | obj-52-glasses.glb | round_spectacles_4k.blend.zip |
| 68 | obj-68-ring.glb | fbx.zip / Ring1Lvl1.fbx |
| 83 | obj-83-teacup.glb | teacup_plate_mesh.fbx; ending only |


Three.js / GLTFLoader remain pinned to 0.170.0. Models use Meshopt and WebP textures up to 1024px. All eight files are below 2 MB; total payload is 3,956,084 bytes (about 84% smaller than the uncompressed project copies). Models load sequentially and are reused; age 83 is never used in the exploration background. Missing tooth/diary/radio/sock assets use the existing corresponding models, as permitted by the brief.

## Debug

Open `?debug` to inspect state, confusion level, current errors, clarity, ending and individual ages. The slider directly sets and holds `confusion` (0–1); reload resumes its automatic clock. A selector forces one error at a time for testing. The model status includes the number of distant objects. Body detection and the current visitor-address stage are shown; Immediately show silhouette reveals it for testing. The posture diagnostics show standing / sitting / unknown, landmark Y values, confidence, a scale-normalized ratio, a threshold slider and a reversible simulated sitting input. Ordinary clarity keeps its original timing; debug clarity lasts 30 seconds for inspection.

Use a local server for testing 3D. Browser WebGL / CDN availability and real-device performance remain platform dependent.
