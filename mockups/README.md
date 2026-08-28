# mockups/ — Mobile redesign hi-fi mockups (2026-08-27)

Design references for the mobile-first shapes programme
(`docs/MOBILE_SHAPES.md`). **Not part of the site build.** Nothing in this
directory is imported by `src/`.

| File | What it is |
|---|---|
| `mobile-redesign.html` | Design board: 9 phone frames (390px), Direction C tokens. Frames scroll; `<details>` chapters open; sticky bars work. Open in a browser at 100% zoom for true-to-device size. |
| `before-after.html` | 10-section comparison board: live-site captures (left) vs redesigned frames (right). |
| `shots/frame-0N.png` | Renders of the 9 mockup frames (2× scale). |
| `shots/live-*.png` | Live production captures, iPhone-width 390×844, first-visit state, 2026-08-27. |
| `shots/pair-N.png` | The 10 before/after comparison sections as single images. |
| `shot.mjs`, `shot-live.mjs`, `shot-live2.mjs`, `shot-pairs.mjs` | Playwright render scripts. |

Frame → spec mapping: 01 home · 02 rankings (List) · 03 entry low-risk ·
04 entry high-risk (door swap) · 05 compare (Duel) · 06 search overlay ·
07 /me · 08 /shindan · 09 Q&A (List variant).

Numbers shown are real 2026-07-26 AIOIS-10 scores (看護師 3.6/0.6 · 483rd,
経理事務 8.5/5.5 · 6th, データ入力 9.4 · 1st). The home "今月の変動" riser
column, Q&A row order, and 求人倍率 15.0 for helper are illustrative.

Re-render:

```bash
cd mockups && python3 -m http.server 8823 &   # serve boards
node shot.mjs        # 9 frames  → shots/frame-0N.png
node shot-pairs.mjs  # 10 pairs  → shots/pair-N.png
node shot-live.mjs && node shot-live2.mjs   # live captures (network)
```
