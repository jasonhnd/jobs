# Font Sources

This directory vendors the full upstream source fonts used by the build-time
font subset pipeline:

- `noto-serif-jp/NotoSerifJP[wght].ttf`
- `plus-jakarta-sans/PlusJakartaSans[wght].ttf`

Both files are from the Google Fonts repository and are licensed under the SIL
Open Font License 1.1; keep each family `OFL.txt` with the source font.

`scripts/subset-fonts.ts` runs after `astro build`, scans rendered
`dist-astro/**/*.html`, and emits content-hashed WOFF2 subsets to
`dist-astro/fonts/`. Do not commit generated `dist-astro/fonts/*` files.
