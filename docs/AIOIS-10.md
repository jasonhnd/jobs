# AIOIS-10 — AI Occupational Impact Standard

**Version:** 1.0-draft · **Date:** 2026-05-30 · **Status:** DRAFT (under review)

An open reference framework for measuring how artificial intelligence affects an
occupation. AIOIS-10 scores every occupation along **10 orthogonal dimensions**
organised into a four-stage causal model, and rolls them up into two
interpretable indices. It is designed to be **universal** (applicable to any
country), **stable** (the dimensions do not change as AI advances — only the
scores do), **grounded** (each dimension maps to observable job attributes and
to the established economics-of-automation literature), and **operational**
(scorable by a human analyst or a language model, and machine-readable for
tooling).

> Trilingual by design. Each dimension carries an English / 日本語 / 中文 label.
> This document is the canonical (English) text; localized editions are derived
> from it without changing the dimension definitions.

---

## 1. Why ten dimensions, and not one number

"AI impact" is not a single quantity. A worker asks at least four different
questions, and they do not have the same answer:

| | The worker's question | Who scores high |
|---|---|---|
| **Transformation** | How much will AI **change how I work**? | knowledge / cognitive / creative work |
| **Displacement** | Will AI **cost me my job**, or shrink my field? | routine work with weak moats |
| **Valuation** | Will my **wage / bargaining power** rise or fall? | depends on augment vs. commoditise |
| **Adaptation** | What must I **re-learn**? | high skill-shift roles |

Transformation and Displacement frequently point in **opposite directions** (a
CEO is highly transformed by AI but very unlikely to be displaced). Collapsing
them into one 0–10 "AI risk" number is the central failure of single-axis
rubrics. AIOIS-10 measures the **inputs** along independent dimensions and lets
distinct questions read distinct outputs.

---

## 2. The EMFO model

AI impact propagates through a four-stage **causal pipeline**. Each stage filters
the previous one:

```
   Can AI do the tasks?      Replace or augment?       Will it deploy?         Net result
 ┌─ 1. EXPOSURE ───────→ 2. HUMAN MOAT ───────→ 3. DEPLOYMENT FRICTION ───→ 4. OUTCOME ─┐
 │   (what AI reaches)     (irreducible human)     (barriers to substitution)  (labor)   │
 └──────────────────────────────────────────────────────────────────────────────────────┘
```

Technical exposure alone overstates impact; a task an AI *could* do is not the
same as a worker who *will* be replaced. The moat and friction stages are what
separate AIOIS-10 from pure exposure indices.

Each dimension is scored **0–10** as the **magnitude of an observable property**
(not as "impact" directly). The role tag states how the property feeds impact:

- **▲ Driver** — higher score → larger AI impact.
- **■ Moat** — higher score → stronger human advantage → smaller impact.
- **◐ Modifier** — gates whether exposure becomes realized impact.

---

## 3. The 10 dimensions

### Stage 1 — Exposure (what AI can reach)

#### D1 · Cognitive–Generative Exposure · 認知・生成暴露度 · 认知/生成暴露　▲ Driver
The share of the role's tasks that are language, information, analysis, code, or
symbolic work that **current generative AI (LLMs / multimodal models)** can
perform end-to-end or nearly so.
**0** = no such tasks · **10** = the role is almost entirely AI-performable
cognitive work (data entry, machine-translatable text, routine drafting).
*Indicators:* `skills.writing`, `reading_comprehension`, `critical_thinking`,
`mathematics`; `knowledge.computers_electronics`; low physical/manual content.
*Lineage:* Eloundou et al., "GPTs are GPTs" (2023); Brynjolfsson et al.,
Suitability-for-Machine-Learning.

#### D2 · Routine–Procedural Exposure · 定型・手順暴露度 · 定型/流程暴露　▲ Driver
The degree to which tasks are rule-based, repetitive, predictable, and follow
explicit procedures — the reach of classic automation / RPA, independent of
modern AI.
**0** = every case is novel and unstructured · **10** = fully scripted,
identical, machine-paced.
*Indicators:* `work_characteristics.repetitive_tasks`,
`pace_determined_by_machine`, `repetition_of_activities`, `exactness_accuracy`.
*Lineage:* Autor–Levy–Murnane routine-task hypothesis (2003); Frey & Osborne
(2013).

### Stage 2 — Human Moat (what AI cannot replace even where it is capable)

#### D3 · Manual–Physical Demand · 身体・現場性 · 身体/现场性　■ Moat
How much the work requires physical manipulation, fine motor skill, mobility, or
real-world perception — reachable only by **robotics / embodied AI**, a harder,
slower, and more capital-intensive frontier than software.
**0** = purely desk-bound · **10** = highly physical / on-site (skilled trades,
hands-on care, surgery, field work).
*Indicators:* `work_characteristics.standing`, `outdoor_work`;
`skills.equipment_maintenance`, `repairing`, `installation`.
*Lineage:* Moravec's paradox; Frey & Osborne perception-and-manipulation
bottleneck.

#### D4 · Judgment & Accountability · 判断・責任 · 判断/责任　■ Moat
Non-routine decision-making under uncertainty and high stakes, plus the legal or
moral **responsibility for outcomes** that must rest on an identifiable human.
**0** = no discretion, no liability · **10** = high-stakes judgment with personal
accountability (judge, surgeon, chief executive, airline captain).
*Indicators:* `skills.judgment_decision_making`;
`work_characteristics.freedom_to_make_decisions`, `consequence_of_error`,
`responsibility_for_outcomes`.
*Lineage:* principal–agent / liability theory; Autor non-routine-cognitive work.

#### D5 · Social & Emotional Intelligence · 対人・情緒知能 · 人际/情感智能　■ Moat
In-person interaction, empathy, trust-building, care, persuasion, and
negotiation — where the human relationship **is** the value delivered.
**0** = solitary work · **10** = the relationship itself is the service (nursing,
counselling, sales, teaching, hospitality).
*Indicators:* `work_characteristics.face_to_face_discussions`,
`contact_with_others`; `skills.social_perceptiveness`, `service_orientation`,
`persuasion`, `negotiation`.
*Lineage:* Frey & Osborne social-intelligence bottleneck.

#### D6 · Creative & Original Intelligence · 創造・独創性 · 创造/独创性　■ Moat
Generating genuinely novel ideas, artefacts, or solutions, as opposed to
recombining existing patterns (a task at which generative models excel).
**0** = fully derivative / templated · **10** = original creation is the core of
the role (fine artist, research scientist, lead designer).
*Indicators:* `interests.artistic`; `skills.complex_problem_solving`,
`operations_analysis`.
*Lineage:* Frey & Osborne creative-intelligence bottleneck.

### Stage 3 — Deployment Friction (what blocks substitution even where AI could substitute)

#### D7 · Regulatory & Safety Barrier · 規制・安全障壁 · 监管/安全壁垒　◐ ■ Modifier-Moat
The extent to which law, licensing, or professional regulation **requires** a
human, or safety-criticality forces a human in the loop.
**0** = unregulated · **10** = a licensed human is legally mandatory, or error is
life-threatening.
*Indicators:* `related_certs`; `work_characteristics.consequence_of_error`;
law/government knowledge.
*Lineage:* institutional economics of labor.

#### D8 · Economic Feasibility · 経済合理性 · 经济合理性　▲ Modifier-Driver
Whether automating is **cheaper** than the labor it would replace — automation
and capital cost versus the prevailing wage.
**0** = uneconomic to automate (cheap labor and/or expensive embodiment) ·
**10** = strongly cost-justified (high wage, low automation cost).
*Indicators:* wage level × embodiment cost from D3; capital intensity.
*Lineage:* Acemoglu & Restrepo "so-so technology"; cost-of-automation.

#### D9 · Institutional & Labor-Market Context · 制度・労働市場文脈 · 制度/劳动市场背景　◐ Modifier ⟨localizable⟩
The local environment that turns technical substitutability into actual
displacement — or blunts it: organizational adoption capacity, employment
protection, unionization, and the **labor supply/demand balance** (an acute labor
shortage reframes AI as relief rather than threat).
**0** = strong shield (labor shortage, strong protection, slow adoption) ·
**10** = frictionless displacement (labor surplus, weak protection, fast
adoption).
*Note:* **This is the only dimension scored per-jurisdiction.** A labor shortage,
as in Japan's ageing economy, is one low-scoring instance; an at-will,
high-adoption market is a high-scoring instance. See §6.
*Lineage:* labor economics; technology-diffusion research.

### Stage 4 — Net Outcome

#### D10 · Labor-Demand Trajectory · 雇用需要の趨勢 · 就业需求走向　▲ Driver
The projected **net change** in the occupation's headcount and economic value
over a stated horizon (default **5–10 years**), integrating AI-driven
displacement against AI-driven new-task creation and reinstatement.
**0** = strongly growing · **10** = sharply shrinking.
*Indicators:* sector outlook, demographic demand, automation pressure from
D1–D9; labor-market projections.
*Lineage:* Acemoglu & Restrepo displacement vs. reinstatement; WEF Future of
Jobs; national labor-statistics projections.

---

## 4. Scoring conventions

1. **Scale.** Every dimension is `0.0`–`10.0` to one decimal place.
2. **Property, not verdict.** Score the *magnitude of the named property*; the
   role tag (▲ / ■ / ◐) determines its sign in the indices. This keeps each
   dimension an objective, repeatable observation.
3. **Capability horizon.** Exposure (D1–D2) is scored against a **declared AI
   capability frontier** — the standard fixes "current frontier" plus an optional
   "+5-year" projection. Re-scoring at a new frontier updates scores, **not**
   dimensions.
4. **Aggregation.** Where task-level data exists, score each task and aggregate
   (time- or importance-weighted) to the occupation. Otherwise score holistically
   from the role description, grounded in the indicator vectors.
5. **Confidence.** Each occupation carries a `confidence` (0–1); within-occupation
   heterogeneity (e.g., "manager" spans many firms) is expressed as lower
   confidence, not hidden in the point score.
6. **Scorer.** A trained analyst or a calibrated language model may score, using
   the indicators as a prior and anchor set. The scorer, model, and date are
   recorded with every batch.

---

## 5. Derived indices

The 10 dimensions roll up into two headline indices (both `0`–`10`). The v1.0
reference formulas are intentionally simple and tunable; weights `w` are
published with each scoring batch.

**Transformation Index (変化指数 / 变化指数)** — *how much AI reshapes the work*:

```
Transformation = mean(D1, D2)            # exposure-driven; high for knowledge work
```

**Displacement-Risk Index (代替リスク指数 / 代替风险指数)** — *risk of replacement or contraction*:

```
Exposure  = mean(D1, D2)                            # what AI reaches
Moat      = mean(D3, D4, D5, D6, D7)                # human + regulatory resilience
Deploy    = mean(D8, D9)                            # economic × institutional gating (D9 high = frictionless)
Displacement-Risk = clamp₀₋₁₀( Exposure · (1 − Moat/10) · (0.6 + 0.4 · (Deploy + D10)/20) )
```

The gate term `0.6 + 0.4·(Deploy + D10)/20` ranges 0.6–1.0: exposure that has
cleared the moat is *discounted*, not zeroed, by weak deployment economics or a
flat demand trajectory — so displacement risk is dominated by **exposure × the
inverse moat**, then modulated by deployment and trajectory. An earlier draft
multiplied four independent 0–1 factors and collapsed the whole index toward
zero; this single gate is the v1.0 calibration, fit so the worked anchors below
reproduce. Weights are published with each batch and may be re-tuned per edition.

A profile is therefore **two numbers plus a 10-axis radar**. The CEO reads
*high Transformation, low Displacement-Risk*; the data-entry clerk reads *high,
high*; the elderly-care worker reads *low, low*.

---

## 6. Universal core + localizable modifier

What makes AIOIS-10 a **world** standard rather than a local rubric:

- **Dimensions D1–D8 and D10 are universal.** They are intrinsic properties of
  the work and of the global AI frontier; an occupation's profile on them is the
  same in Tokyo, Berlin, or São Paulo (given the same capability horizon).
- **Dimension D9 is the single localizable layer.** A country edition re-scores
  only D9 (and may re-weight the Displacement formula) to reflect its labor
  market and institutions.

So one **universal occupational core profile** localizes to any jurisdiction by
swapping a single dimension — the mechanism by which a single standard can serve
every country.

---

## 7. Versioning & governance

- **The standard** (this document) is versioned independently of any scores —
  e.g., `AIOIS-10 v1.0`. Changing a dimension definition is a standard-version
  bump and must be logged here.
- **Score batches** reference the standard version they were produced under and
  the AI capability horizon assumed. As the frontier advances, batches are
  re-run; the 10 dimensions remain fixed. This stability is what lets the
  standard be cited and compared across time.

---

## 8. Relationship to prior frameworks

AIOIS-10 integrates, rather than replaces, the established literature:

| Prior framework | Contribution | AIOIS-10 home |
|---|---|---|
| Autor–Levy–Murnane (2003) | routine vs. non-routine tasks | D2 |
| Frey & Osborne (2013) | 3 engineering bottlenecks (perception/manipulation, social, creative) | D3, D5, D6 |
| Brynjolfsson et al. (2018) | Suitability for Machine Learning | D1 |
| Acemoglu & Restrepo (2018–22) | displacement vs. reinstatement; "so-so" automation | D8, D10 |
| Eloundou et al. (2023) | LLM task exposure | D1 |
| WEF Future of Jobs | occupational demand outlook | D10 |

The novel contribution is the **EMFO pipeline** that connects exposure to
realized labor outcome through explicit moat and friction stages, and the
**universal-core + localizable-modifier** design.

---

## 9. Worked examples (production batch, Japan edition, current frontier)

Profiles from the production scoring batch (Opus-4.8, 2026-05-30, Japan/D9).
T = Transformation, DR = Displacement-Risk.

| Occupation | D1 | D2 | D3 | D4 | D5 | D6 | D7 | D8 | D9 | D10 | **T** | **DR** |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| データ入力 Data-entry clerk | 9.5 | 9.0 | 0.6 | 0.3 | 0.0 | 0.7 | 0.8 | 4.4 | 6.6 | 7.9 | **9.2** | **7.6** |
| 翻訳者 Translator | 9.5 | 4.7 | 0.6 | 4.3 | 2.0 | 4.8 | 2.8 | 7.7 | 7.2 | 5.9 | **7.1** | **4.4** |
| 会社経営者 Chief executive | 7.0 | 1.7 | 2.4 | 8.4 | 6.4 | 5.0 | 4.8 | 5.5 | 5.0 | 3.2 | **4.4** | **1.5** |
| 外科医 Surgeon | 4.0 | 4.6 | 6.2 | 9.5 | 8.9 | 5.4 | 9.1 | 3.8 | 5.5 | 2.8 | **4.3** | **0.7** |
| 訪問介護員 Elderly-care worker | 2.0 | 3.9 | 6.3 | 4.0 | 5.2 | 2.0 | 5.4 | 1.8 | 1.6 | 1.6 | **3.0** | **1.1** |

These resolve the cases that break single-axis rubrics: the executive and surgeon
are *heavily impacted on judgment-laden cognitive tasks yet secure* (high D4/D5/D7
moats hold Displacement near 1); the Japanese care worker is *insulated* because
D9 (acute labor shortage, 有効求人倍率 ≈ 28) and the D3/D5 moats overwhelm a low
exposure. Only the data-entry clerk and translator carry exposure into real
displacement, because their moats are thin.

---

## 10. License & citation

Intended as an open, freely referenceable standard. Recommended citation form and
license to be finalized at v1.0 release. _Placeholder — to be completed._
