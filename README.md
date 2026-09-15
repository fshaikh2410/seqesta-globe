# Seqesta - living world globe (reference)

A small, self-contained 3D "living world" globe — procedural terrain, a
digital tree, a companion character, ambient fireflies — built as a reference

It's plain ES modules on top of [Three.js](https://threejs.org)
r180 (vendored locally in `vendor/`, MIT licensed — see `vendor/THREE-LICENSE.txt`).
Because it's framework-agnostic, it should drop into React, Vue, Svelte, plain HTML,
or anything else with a `<script type="module">` and a container element.

## What's in here

- **`globe-only/`** — the globe, isolated. The minimal way to see and lift the
  3D component on its own, without any surrounding app UI.
- **`full-app/`** — the whole Seqesta prototype (steps, tree progress, rewards, nav)
  so you can see the globe in its intended product context.

Both folders are self-contained (each has its own copy of `globe.js` and the
`vendor/` Three.js files), so you can grab either one independently.

## Running it

Needs to be served over HTTP (ES module imports don't work from `file://`). From
either folder:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Using the globe in your own app

The whole component is one class, `LivingWorld`, exported from `globe.js`:

```js
import { LivingWorld } from './globe.js';

const container = document.getElementById('world'); // any element with a size
const world = new LivingWorld(container, {
  onSelect: (type) => {},   // fires when the user taps the tree or the companion ('tree' | 'companion')
  onFocus: (focused) => {}, // fires when the camera zooms in/out of "focused" mode
  onError: () => {},        // fires if WebGL isn't available / context is lost
});
```

Useful methods on the instance:

- `world.grow(steps)` — grows the tree based on a step count
- `world.decorate(['daisies', 'wildflowers', 'grove'])` — adds unlocked decorations
- `world.zoom(factor)`, `world.rotate(radians)`, `world.reset()`, `world.focus()` — camera controls
- `world.setLight('day' | 'dusk' | 'blue')` — changes the ambient lighting mood

The container just needs a defined size (width/height via CSS); the globe resizes
itself via a `ResizeObserver`.

## Notes

- Rendering pauses automatically when the tab is backgrounded (`document.hidden`) —
  this is intentional (battery-saving), not a bug, if you see a blank canvas in an
  automated/background browser context.
- This is a prototype reference, not a production package — no bundler config, no
  tests, no versioning. Treat it as a starting point to adapt into your own stack.
