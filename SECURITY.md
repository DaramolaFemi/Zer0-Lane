# Security

Zer0 Lane is a static browser game. It has no accounts, backend, analytics, third-party runtime scripts, or network-based sound effects. Best scores and sound preferences stay in browser storage and are not authoritative competitive scores.

Production builds restrict scripts and styles to the same origin with a Content Security Policy. Connections, plugins, and form submissions are disabled. SVG data images are allowed for bundled artwork. The development server binds to localhost; its live-reload tools are excluded from production.

Before deployment, CI runs the dependency audit, game tests, production build, source security checks, and browser checks. Actions are pinned to full commit hashes, deployment permissions are limited to the deployment job, and Dependabot checks npm and action updates weekly. The source pattern scan is a basic safeguard, not a comprehensive secret scanner or penetration test.

GitHub Pages supplies HTTPS and hosting response headers. A meta CSP cannot enforce `frame-ancestors`; custom HTTP security headers require a host or proxy that supports them. No claim of universal device compatibility or complete security is made.

Report a vulnerability through the repository's private vulnerability reporting feature if available. Do not include credentials or exploitable sensitive details in a public issue.
