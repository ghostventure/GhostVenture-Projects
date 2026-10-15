# Photo Upload and Performance Optimization - 2026-06-11

## Summary

Improved photo attachment handling and added conservative site-wide performance guards before the next social-traffic push.

## What shipped

- Added `src/mediaUploads.js` as the shared image-upload gate.
- Chat uploads now accept JPG, JPEG, PNG, GIF, and SVG vector images.
- Raster images are compressed client-side when useful with `browser-image-compression`.
- GIFs are preserved without compression so animation is not broken.
- SVG files are read as vector images, sanitized, and stored as safe `data:image/svg+xml` URLs.
- The chat picker now supports click-to-upload and drag/drop on the attachment target.
- Upload messaging now shows an `Optimizing...` state while processing.
- Repository attachment sanitization now only keeps supported image data URLs.
- Feed, chat, listing, and landing images use async decoding and lazy loading where appropriate.
- Heavy repeated workspace surfaces use CSS `content-visibility` with intrinsic sizing to reduce offscreen rendering work.

## Files changed

- `src/mediaUploads.js`
- `src/FoxHubShell.jsx`
- `src/App.jsx`
- `src/repository-local.js`
- `src/repository-firebase.js`
- `src/styles.css`
- `tests/media-uploads.test.mjs`
- `scripts/release-smoke.mjs`
- `docs/PHOTO_UPLOAD_PERFORMANCE_OPTIMIZATION_2026-06-11.md`
- `docs/PROJECT_STATUS.md`
- `docs/CURRENT_HANDOFF_2026-05-31.md`
- `docs/DOCS_INDEX.md`

## Verification

Completed:

- `node --check src/mediaUploads.js` (pass)
- `node --check src/repository-local.js` (pass)
- `node --check src/repository-firebase.js` (pass)
- `npm test` (pass, 21 tests)
- `npm run release:check` (pass)
- `npm run deploy:hosting` (pass)
- live `/management` HTTP 200
- live `/assets/FoxHubShell-DMH3cWYT.js` HTTP 200
- live `/assets/mediaUploads-DfcAefDW.js` HTTP 200
- live `/assets/browser-image-compression-CBVwGt6Q.js` HTTP 200
- live `/assets/index-BYoiQ_k9.css` HTTP 200
- live Hosting `Last-Modified`: `Thu, 11 Jun 2026 17:36:53 GMT`
- live bundle content check found `Attach photo`, `JPG, PNG, GIF, SVG`, `Optimizing`, `Use JPG, JPEG, PNG, GIF, or SVG vector images`, `browser-image-compression`, `image/svg+xml`, `attachment-dropzone`, and `content-visibility:auto`.
