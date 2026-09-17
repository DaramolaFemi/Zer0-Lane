# Zer0 Lane

An endless night-driving game with custom SVG artwork, keyboard and touch controls, and a local personal best.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

Open the address printed by Vite. To create a deployable static site, run `npm run build`; the output is in `dist/`. `npm run preview` serves that build locally.

## Controls

- Left / right arrows or A / D: steer. Hold to move, release to stop moving sideways.
- Up arrow, W or Space: boost while energy remains.
- Down arrow or S: brake.
- Escape or P: pause / resume.
- On-screen controls support simultaneous touch input.

Dodge coral barriers. A collision ends a normal run. Collect violet cells for boost energy and bonus points; close passes earn 100 points. Practice mode allows collisions and never updates your personal best. Switching tabs or leaving the window automatically pauses the game. Sound starts with your first drive and can be muted using the header control. Your preference is saved. A reusable Web Audio engine supplies driving and tyre sounds; short crash, pickup, and near-miss effects use capped voices that disconnect after playback. Driving audio fades out on pause or game over. Particles are capped at 40 and respect reduced-motion settings.

## Checks

`npm test` checks steering, timing, collisions, practice, energy, pickups, and long-running object limits. `npm run build` checks production bundling. With the dev server running and Google Chrome installed, `node scripts/browser-check.mjs` runs desktop and mobile interaction checks and saves screenshots in `/tmp`.

The UI uses HTML/CSS and SVG. The canvas renderer is separate from the fixed-timestep game logic in `engine.js`. Road coordinates stay consistent across screen sizes. No external font or image services are required. Scores are stored under the existing `zer0lane_highscore` key; blocked storage does not prevent play.

## Publishing

Source: https://github.com/DaramolaFemi/Zer0-Lane

Site: https://neo-game-omega.vercel.app/

The Vercel deployment tracks the production branch. Pull requests continue to run the repository checks before merge.

`npm run security` checks the production policy and shipped source after a build. See [SECURITY.md](SECURITY.md) for scope and hosting limitations. CI runs the layout checks in Chromium, Firefox, and WebKit. Browser checks cover 320 px phones, standard phones, tablets, landscape, and desktop viewports; they are not a guarantee for every browser or physical device.

Designed by Daramola Femi.
