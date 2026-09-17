# Security

Zer0 Lane runs entirely in the browser. There is no account system, backend, analytics service or payment flow.

The only user data stored by the game is the personal best and sound preference, which stay in browser storage.

The production build uses a Content Security Policy and does not rely on third-party runtime scripts. The project also runs dependency, test, build and source checks before deployment.

`npm run security` is a basic project check. It is not a replacement for a full security review or penetration test.

The live site is deployed on Vercel over HTTPS.

If you find a security issue, use GitHub's private vulnerability reporting feature when available. Please do not post sensitive exploit details or credentials in a public issue.
