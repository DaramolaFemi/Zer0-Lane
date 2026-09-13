import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  // Relative assets also work when the repository or Pages URL changes.
  base: './',
  plugins: command === 'build' ? [{
    name: 'production-security-policy',
    transformIndexHtml() {
      return [{ tag: 'meta', attrs: {
        'http-equiv': 'Content-Security-Policy',
        content: "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; font-src 'self'; base-uri 'self'; form-action 'none'; object-src 'none'"
      }, injectTo: 'head-prepend' }, { tag: 'meta', attrs: { name: 'referrer', content: 'no-referrer' }, injectTo: 'head-prepend' }];
    }
  }] : []
}));
