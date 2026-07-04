# AI働き方診断 — Virality & Entry Rework (Design)

Status: draft for review. Extends [`WORKTYPE_DIAGNOSTIC.md`](./WORKTYPE_DIAGNOSTIC.md)
(the diagnostic's scoring/type system is unchanged; this doc reworks how the
result is **named, surfaced, entered, and spread**).

Base branch: `preview`. Human-merge gate. JA-only site; English spec with JA copy
strings inline (owner finalizes the JA copy in review).

## 1. Why

`/shindan` (the diagnostic) and `/gyakuten` (the 24-type figure book / 図鑑) are
the two flagship, share-driven surfaces. Three problems cap their reach:

1. **A proprietary code is used as the public identity.** The result/figure-book
   surfaces an internal 3-axis code (e.g. `CPK`, from axes C/R · P/D · B/K). To
   anyone receiving a share it carries **zero recognition** — it can't be
   decoded — so it is friction, not a hook. We cannot out-recognize the already-
   viral "16 personalities" (MBTI) framework by minting a parallel code; a new
   code (whether 8 or 16) is still unknown, it only "looks like" the familiar
   format.
2. **Copy reads machine-generated.** Templated repetition (8× `次の一手は〜する
   ことです`, 24× `まだあなたのものではない`), spec-register framing that
   describes the mechanism instead of speaking to the user (`〜の入口です`,
   `データの土台`, `9問の強弱から出る味付け`), and formulaic name-coining
   (JP noun + katakana role-title: `共感ストラテジスト`, `ケアマイスター`,
   `フロウ・マスター`, `AIオートメーター`).
3. **No obvious entry.** The diagnostic is absent from the global nav; the only
   homepage CTA sits far below the treemap and the hub sections; the hero is
   about the occupation map. The two flagship interactive features get ~0
   first-screen exposure.

## 2. Strategy

Virality comes from a **self-explanatory named identity** plus **riding a
framework people already know** — not from a proprietary code.

- **S1 — Code is internal-only.** `familyId` (`CPK`…) stays for scoring, for the
  `data.worktypes.json` keys, and as an opaque deep-link param (`?self=…`). It is
  **removed from every visible surface**. The public identity is the **name + a
  one-line identity**.
- **S2 — Warm, conversational voice.** Address 「あなた」; lead with the identity/
  benefit; drop mechanism-describing framing. Keep the disclaimers intact
  (性格検査ではない; AI影響度は AIOIS-10 モデル出力であって統計的将来予測ではない).
- **S3 — Naming pass.** Reduce the "JP noun + katakana role-title" formula; prefer
  concrete / wa-go / spoken forms (`〜職人` `〜係` `〜役` `〜番` `〜上手`). Keep the
  names that already read well. Draft in Appendix A (owner finalizes in review).
- **S4 — Keep the game layer, kill the repetition.** 図鑑 / めくる / trophy→dare
  stays (it is the viral loop). Rotate the locked-label and next-move phrasings so
  nothing reads copy-pasted.
- **S5 — Single share hero.** The share unit is **one memorable identity** (the
  variant name + one line), not family＋variant＋code. Axes / family / rarity /
  "depth" live inside the page, not in the share hook.
- **S6 — Piggyback MBTI (editorial).** A new content line
  「MBTIタイプ × AI時代の働き方」 connects each already-known type to our
  occupation + AI-impact (AIOIS-10) data and funnels into the diagnostic. It rides
  existing `○○ 仕事 AI` search demand and attaches our unique data as the payoff.
  **No forced axis crosswalk** (personality ≠ work-preference; a hard MBTI→work-
  type mapping would read pseudo-scientific and undercut the site's data
  credibility). The connection is editorial + occupation tagging.

## 3. Non-goals

- Not restructuring the 3-axis / 8-family / 24-variant system into 16 types. A new
  16-code is still unrecognized; it would only mimic the count while forcing a full
  re-score and re-map of the 556 occupations.
- Not a hard MBTI → work-type mapping.
- No change to AIOIS-10 scoring or occupation-data integrity.
- JA-only. No English UI copy.

## 4. Changes by surface

### A. Drop the code + reshape identity & copy
- `src/site/worktype-copy.ts` — rewrite family `identity / strengths / aiRelation /
  empowerment / transition / share` and variant `catch` in the warm voice;
  de-template (no shared sentence scaffold across families/variants); apply the new
  names (Appendix A). No axis-code strings in any copy field.
- `/gyakuten` (`src/pages/gyakuten.astro`, `_gyakuten-css.ts`) — family cards and
  the 24-type roster show **name + one-liner + static rarity %**; **remove the
  `CPK`-style code label** everywhere. Rotate the 24 locked labels (S4).
- `/shindan` (`src/pages/_shindan.js`, `shindan.astro`) — the result card is
  name-led with no visible code; the share text is a single hero name (S5); the OG
  card (`/api/og`) shows the name, not the code. `?self=`/`?variant=` may remain as
  opaque URL params.
- Re-capture SEO baselines (`bun run capture:seo-baseline`); keep byte-stable inline
  scripts for CSP.

### B. Entry (information architecture)
- Global nav / Header — add a top-level **「診断」** entry (and a secondary
  **「図鑑」**), present on desktop and mobile.
- Homepage (`src/pages/index-source.html`) — a **first-screen entry band directly
  under the hero, before the treemap**, selling the identity question + 30-second +
  share-and-compare hook, with `診断をはじめる →` / `図鑑を見る` CTAs. Promote or
  retire the currently-buried home CTA (added in #95).

### C. MBTI content line (new feature)
- Route `/mbti/<type>`. **Phase 1 = a small high-search subset** (chosen by JA
  search volume, e.g. INTJ / INFP / ENFP / … — list finalized in the sub-spec), not
  all 16 at once.
- Page shape: known-type framing → 「AI時代の、このタイプの働き方」 (editorial) →
  matching occupations from the 556-occupation dataset with their AIOIS-10 AI-impact
  (linking existing `/[id]` pages) → CTA into `/shindan`. Follow site conventions
  (Page class / `check-page-class`, canonical tokens from Footer.astro, valid
  JSON-LD `WebPage`, internal-link + SEO baselines).
- Connection is **editorial + occupation tagging**, not a scoring map.
- Large enough to warrant its own DIAG-style sub-spec for the page template and the
  per-type → occupation editorial selection; this doc authorizes the direction and
  the funnel.

## 5. Decomposition (doc-first)

Merge this doc first, then open code issues:

1. **`[entry]`** nav 「診断」 + homepage first-screen entry band. Front-end only;
   fast, high-impact; unblocks "pushing the flagship features."
2. **`[identity]`** drop the public code + warm-voice copy rewrite + naming pass +
   de-template + single share hero (`worktype-copy.ts`, `gyakuten.astro`,
   `_shindan.js`/`shindan.astro`, `/api/og`, baselines).
3. **`[mbti]`** MBTI×AI-work content pages (phase-1 subset) + funnel; may get its own
   template sub-spec first.

Order 1 → 2 → 3. `base=preview`, human-merge gate. Names and JA copy are finalized by
the owner in this doc's review before the code issues are dispatched.

---

## Appendix A — Naming draft (たたき台; owner finalizes)

`○` = keep; `→` = suggested change. Principle: fewer "JP noun + katakana role-title"
coinages; more concrete / wa-go / spoken forms.

**Families**

| Code (internal) | Current | Suggested |
| --- | --- | --- |
| CPB | ふれあい創造家 | ○ keep |
| CPK | 共感ストラテジスト | → 寄りそい案内人 |
| CDB | ものづくり設計家 | ○ keep |
| CDK | AI共創パイロット | → AI二人三脚 |
| RPB | 現場のケアマイスター | → そばで支える人 |
| RPK | 段取りコーディネーター | → 段取りの世話役 |
| RDB | 現場フロウ・マスター | → 現場を回す人 |
| RDK | AIオートメーター | → 手放し上手 |

**Variants** (`→` = suggested change; unlisted = keep)

- CPB: アトリエ伴走家 ○ / ひらめき場づくり師 ○ / 手ざわり表現家 ○
- CPK: 共感フレーマー → 問い直し役 / 未来面談ナビ ○ / 意味づけストーリスト → 物語づくり職人
- CDB: 試作ブースター → 試して学ぶ職人 / 現物マッピング職人 ○ / 制約突破デザイナー → 制約くぐり職人
- CDK: AI先駆けハッカー ○ / 共創アーキテクト → 仕組みづくり職人 / 深掘りリサーチャー ○
- RPB: ぬくもりケア職人 ○ / 現場ホスピタリスト → その場の安心係 / 安心ルーティン守り人 ○
- RPK: 抜け漏れルーター → 抜け漏れ見張り番 / 調整ハブマネージャー → まとめ役 / テンプレ改善オペレーター → 定型かるく係
- RDB: 現場フロー管制官 → 流れの見張り番 / 精度チェック職人 ○ / 動線カイゼン隊長 ○
- RDK: 自動化レシピ職人 ○ / 例外チェック司令塔 → 例外の見張り番 / 業務アップデート設計者 → 仕事かるく係

## Appendix B — Copy rewrites (before→after samples; owner finalizes)

**Framing (mechanism-describing → speak to the user):**
- `/shindan` hero — before: `仕事の好みを3軸で見て、8つの家族タイプと24のバリアントに
  分けます。結果は…職業データを見に行くための入口です。`
  → `9問であなたの「働き方タイプ」が1枚に。AI時代、あなたの強みがいちばん活きる仕事は
  どこか——いっしょに見つけにいきましょう。`
- `/gyakuten` hero — before: `…8つの家族タイプと24のバリアントで眺める入口です。…土台、
  …コレクションです。`
  → `AI時代、人はどんな働き方に分かれるんだろう。8家族24タイプの図鑑です。あなたの1枚
  は、9問の診断でめくれます。`
- Homepage entry band (new): `あなたは、AIの時代に「どう働くタイプ」？` /
  `9問・30秒。あなたの1枚を見つけて、同僚とめくり合おう。` /
  `[ 診断をはじめる → ] [ 図鑑を見る ]`

**De-templating (S4):**
- Family `empowerment` — vary per family instead of the shared `次の一手は〜する
  ことです` scaffold. e.g. CPK → `AIに下書きを任せて、あなたは"問いの立て方"と"伝わり
  方"に集中しよう。`; RDK → `まず"AIに渡せる作業"を一つ切り出す。そこからあなたの確認
  力が効いてくる。`
- 24× locked labels — rotate rather than repeat one line: `？ 診断でめくる` /
  `まだ見ぬ1枚` / `解放待ち` … (keep the game feel).
