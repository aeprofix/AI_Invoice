# AI Invoice PWA Deploy Guide

## What was added
- `manifest.webmanifest` for installable PWA support.
- `service-worker.js` for app shell caching and offline fallback.
- `offline.html` fallback page.
- `js/pwa.js` for service worker registration and install button.
- `icons/` with 192px, 512px, and maskable icons.
- deploy configs for Netlify, Vercel, Firebase Hosting, and Cloudflare Pages.

## Required structure
Keep these files at your site root:

```txt
index.html
manifest.webmanifest
service-worker.js
offline.html
icons/
css/
js/
```

`service-worker.js` must be at root, not inside `js/`, so the PWA scope can cover the full app.

## Local test
Use any static server. Do not open with `file://` because service workers require HTTPS or localhost.

```bash
npx serve .
```

Open the localhost URL, then inspect:
- Chrome / Edge: DevTools > Application > Manifest / Service Workers
- Lighthouse: run PWA audit
- Android: browser menu > Install app
- iPhone/iPad Safari: Share > Add to Home Screen

## Deploy to Netlify
Put `netlify.toml` from `/deploy` into the root beside `index.html`, then deploy the folder.

```bash
netlify deploy --prod --dir .
```

## Deploy to Vercel
Put `vercel.json` from `/deploy` into the root beside `index.html`, then deploy.

```bash
vercel --prod
```

## Deploy to Firebase Hosting
Put `firebase.json` from `/deploy` into the root beside `index.html`, then deploy.

```bash
firebase login
firebase init hosting
firebase deploy
```

When Firebase asks for the public directory, use `.` if this project root contains `index.html`.

## Deploy to Cloudflare Pages
Put `_headers` from `/deploy` into the root beside `index.html`.
Then upload the folder or connect the GitHub repo in Cloudflare Pages.

Build command: leave empty
Build output directory: `/`

## Important
For full offline function, every original project file must exist in the deployed folder, especially:

```txt
css/style.css
js/utils.js
js/invoice-generator.js
js/pdf-export.js
js/main.js
```

This PWA add-on does not change your invoice logic. It only adds install/offline/deploy support.

## Paid Verified Stamp

A **Payment Status** toggle has been added inside Invoice Details. When marked as paid, the invoice preview, PDF export, PNG export, and print view show a **PAID VERIFIED** stamp. The paid state is also saved with each invoice in localStorage.
