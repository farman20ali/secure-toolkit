# Secure Toolkit

Privacy-first security utilities that run entirely in your browser. No backend, no analytics on generated secrets.

**Live site:** `https://farman20ali.github.io/secure-toolkit/`

## Tools

| Tool | Status |
|------|--------|
| Password Generator | Live |
| UUID Generator | Coming soon |
| Base64 Encode / Decode | Coming soon |
| JSON Beautify | Coming soon |

## Password generator

- Length 8–128 (default 20)
- Uppercase, lowercase, digits, symbols
- Optional exclusion of ambiguous characters (`0`, `O`, `1`, `l`, `I`)
- At least one character from each enabled set
- Entropy estimate and strength label
- Copy, regenerate, show/hide

Randomness uses the Web Crypto API (`crypto.getRandomValues()`). Passwords are not stored in `localStorage` or sent over the network.

## Local development

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`).

## Tests

```bash
npm run test
```

## Production build

```bash
npm run build
npm run preview
```

The production build uses base path `/secure-toolkit/` for GitHub project Pages. After building, `404.html` is copied from `index.html` so client-side routes work on refresh.

<!-- trigger: redeploy to GitHub Pages -->
 
If you rename the GitHub repository, update `repoName` in [`vite.config.ts`](vite.config.ts) and the footer link in [`src/layout/Layout.tsx`](src/layout/Layout.tsx).

## Deploy to GitHub Pages

1. Create a public GitHub repository named **secure-toolkit** (or match the name in `vite.config.ts`).
2. Push this project to the `main` branch.
3. In the repo: **Settings → Pages → Build and deployment → Source** → select **GitHub Actions**.
4. The [deploy workflow](.github/workflows/deploy-pages.yml) runs on every push to `main`.

Replace `YOUR_USERNAME` in the site footer with your GitHub username before publishing.

## Threat model (short)

You trust the JavaScript served from GitHub Pages matches this repository. Verify deployments via commit history and, optionally, Subresource Integrity if you add a CDN later. Generated values exist only in your browser memory unless you copy them elsewhere.

## License

MIT (add a `LICENSE` file if you publish publicly).
