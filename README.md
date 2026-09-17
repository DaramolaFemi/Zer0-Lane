# Zer0 Lane

Zer0 Lane is an endless night-driving arcade game I built for quick runs on desktop and mobile. The goal is simple: avoid barriers, collect energy, use your boost well, and keep pushing your score.

**Play it here:** https://neo-game-omega.vercel.app/

## Run locally

You need Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

Vite will print the local address in your terminal.

## Controls

- Left / right arrows or A / D: steer
- Up arrow, W or Space: boost
- Down arrow or S: brake
- Escape or P: pause and resume
- Mobile controls support touch input

## Gameplay

A collision ends a normal run. Violet cells refill boost energy and add points. Close passes earn bonus points.

Practice mode lets you keep driving after collisions and does not update your personal best. The game also pauses when you leave the tab so a run is not lost in the background.

## Built with

HTML, CSS, JavaScript, Canvas, SVG, Web Audio and Vite.

The game saves your personal best and sound preference in the browser.

## Checks

Run the main checks with:

```sh
npm test
npm run build
npm run security
```

There is also a browser check for desktop and mobile interaction:

```sh
node scripts/browser-check.mjs
```

## Links

Live site: https://neo-game-omega.vercel.app/

Source: https://github.com/DaramolaFemi/Zer0-Lane

Designed and built by Daramola Femi.
