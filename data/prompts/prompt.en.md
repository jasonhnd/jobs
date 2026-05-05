# Japan's 552 Occupations × AI Risk

Structured data on **552 Japanese occupations** sourced from MHLW jobtag, each scored on a 0–10 AI risk axis. Designed to be pasted into an LLM for analyzing and discussing how AI will reshape Japan's labor market.

- Live visualization: https://mirai-shigoto.com/
- Original data: MHLW Occupational Information Site / jobtag (https://shigoto.mhlw.go.jp/User/)

## Scoring methodology

- **Scoring LLM:** Claude Opus 4.7 (Anthropic)
- **Scored on:** 2026-04-25
- **Translated on:** 2026-04-25
- **Workforce / wage data:** MHLW FY2023 commissioned survey (via jobtag)
- **Scoring scale:** In-house 0–10 rubric (task substitutability, automation depth, residual human-judgment requirements via 5-step anchors)

AI risk is a single 0–10 axis estimating how much AI will reshape each occupation. Combines direct automation (AI doing the work) and indirect effects (AI making workers so productive that fewer are needed).

**Heuristic:** "Can the job be done entirely from a home computer?" — if yes, the score is naturally high, since AI is advancing fastest in digital domains.

**Scale anchors:**
- 0–1 Minimal: physical/field work (commercial diver, logger)
- 2–3 Low: manual labor + some interpersonal (electrician, hair stylist)
- 4–5 Moderate: mix of physical and knowledge work (nurse, police officer)
- 6–7 High: knowledge work with judgment (teacher, lawyer, accountant)
- 8–9 Very high: predominantly computer-based (programmer, translator)
- 10 Maximum: pure routine digital processing (data entry)

**Important caveat:** A high score does NOT predict the job disappearing. Programmers score 9/10, but AI-driven productivity gains may grow total demand. Most high-exposure jobs will be reshaped, not replaced.

## Aggregate statistics

- **Occupations:** 552
- **Total workforce:** 54,490,970 (54.5M)
- **Total estimated annual wages:** ¥254.4T
- **Job-weighted average AI risk:** 4.97/10

### Breakdown by AI risk tier

| Tier | Occupations | Workers | % workers | Wages | % wages | Avg pay |
|------|-------------|---------|-----------|-------|---------|---------|
| 0-1 | 1 | 130K | 0.2% | ¥0.6T | 0.2% | ¥453万 |
| 2-3 | 170 | 19.4M | 35.7% | ¥79.6T | 31.3% | ¥409万 |
| 4-5 | 142 | 13.4M | 24.6% | ¥60.4T | 23.8% | ¥450万 |
| 6-7 | 163 | 11.8M | 21.6% | ¥62.6T | 24.6% | ¥532万 |
| 8-9 | 74 | 9.4M | 17.3% | ¥50.0T | 19.7% | ¥532万 |
| 10 | 2 | 302K | 0.6% | ¥1.1T | 0.4% | ¥374万 |

### Avg AI risk by salary band (job-weighted)

| Salary band (万円) | Avg AI risk | Occupations | Workers |
|--------------------|------------|-------------|---------|
| <300 | 2.21 | 2 | 1.0M |
| 300-500 | 3.97 | 298 | 31.0M |
| 500-700 | 6.64 | 181 | 18.1M |
| 700-1000 | 6.28 | 49 | 2.3M |
| 1000+ | 4.39 | 10 | 589K |

### Avg AI risk by top-education level (job-weighted)

Each occupation is grouped by the education label with the highest share in `education_pct`.

| Education | Avg AI risk | Occupations | Workers |
|-----------|------------|-------------|---------|
| Below HS | 2.00 | 1 | 29K |
| High school | 3.32 | 193 | 23.2M |
| Vocational | 4.08 | 42 | 3.3M |
| Junior college | 3.00 | 4 | 831K |
| Bachelor's | 6.73 | 248 | 24.2M |
| Master's | 6.65 | 16 | 408K |
| Doctoral | 7.33 | 3 | 49K |

## Notable lists

### Top 20 highest AI risk

| # | Occupation | AI risk | Workers | Pay |
|---|---|---|---|---|
| 1 | Data Entry Operator (データ入力) | 10/10 | 156K | ¥356万 |
| 2 | Mail-Order Receipt Clerk (通信販売受付事務) | 10/10 | 146K | ¥394万 |
| 3 | General Office Clerk (一般事務) | 9/10 | 2.6M | ¥530万 |
| 4 | Accounting Clerk (経理事務) | 9/10 | 508K | ¥509万 |
| 5 | Bank Teller (銀行等窓口事務) | 9/10 | 508K | ¥509万 |
| 6 | P&C Insurance Clerk (損害保険事務) | 9/10 | 174K | ¥512万 |
| 7 | Infrastructure Systems Engineer (システムエンジニア（基盤システム）) | 9/10 | 164K | ¥753万 |
| 8 | Call Center Operator (コールセンターオペレーター) | 9/10 | 146K | ¥394万 |
| 9 | Supermarket Cashier (スーパーレジ係) | 9/10 | 143K | ¥369万 |
| 10 | Paralegal (Lawyer's Assistant) (パラリーガル（弁護士補助職）) | 9/10 | 121K | ¥481万 |
| 11 | Pharmacy Office Clerk (調剤薬局事務) | 9/10 | 121K | ¥481万 |
| 12 | Care Office Clerk (介護事務) | 9/10 | 121K | ¥481万 |
| 13 | Medical Office Clerk (医療事務) | 9/10 | 121K | ¥481万 |
| 14 | Systems Engineer (Custom Software) (システムエンジニア（受託開発）) | 9/10 | 49K | ¥574万 |
| 15 | Programmer (プログラマー) | 9/10 | 49K | ¥574万 |
| 16 | Systems Engineer (Web Services) (システムエンジニア（Webサービス開発）) | 9/10 | 49K | ¥574万 |
| 17 | Package Software Developer (ソフトウェア開発（パッケージソフト）) | 9/10 | 49K | ¥574万 |
| 18 | Mobile App Developer (ソフトウェア開発（スマホアプリ）) | 9/10 | 49K | ¥574万 |
| 19 | UX/UI Designer (UX/UIデザイナー) | 9/10 | 49K | ¥574万 |
| 20 | IT Help Desk (ヘルプデスク（IT）) | 9/10 | 26K | ¥629万 |

### Top 20 lowest AI risk

| # | Occupation | AI risk | Workers | Pay |
|---|---|---|---|---|
| 1 | Commercial Diver (潜水士) | 1/10 | 130K | ¥453万 |
| 2 | Facility Care Worker (施設介護員) | 2/10 | 1.4M | ¥376万 |
| 3 | Building Cleaner (ビル清掃) | 2/10 | 911K | ¥286万 |
| 4 | Factory Laborer (工場労務作業員) | 2/10 | 383K | ¥345万 |
| 5 | Electrician (電気工事士) | 2/10 | 380K | ¥548万 |
| 6 | Carpenter (大工) | 2/10 | 298K | ¥449万 |
| 7 | Home Care Worker / Helper (訪問介護員/ホームヘルパー) | 2/10 | 276K | ¥381万 |
| 8 | Construction/Civil Laborer (建設・土木作業員) | 2/10 | 228K | ¥415万 |
| 9 | Pavement Worker (舗装工) | 2/10 | 228K | ¥415万 |
| 10 | Plumber (配管工) | 2/10 | 221K | ¥486万 |
| 11 | Hair Stylist (美容師) | 2/10 | 176K | ¥372万 |
| 12 | Welder (溶接工) | 2/10 | 164K | ¥452万 |
| 13 | Barber (理容師) | 2/10 | 141K | ¥372万 |
| 14 | Window Frame Installer (サッシ取付) | 2/10 | 130K | ¥453万 |
| 15 | Interior Finisher (内装工) | 2/10 | 130K | ¥453万 |
| 16 | Waterproofing Worker (防水工) | 2/10 | 130K | ¥453万 |
| 17 | Insulation Worker (保温工事) | 2/10 | 130K | ¥453万 |
| 18 | Hotel Room Cleaner (客室清掃・整備担当（ホテル・旅館）) | 2/10 | 127K | ¥338万 |
| 19 | Mover (引越作業員) | 2/10 | 123K | ¥394万 |
| 20 | Loading/Unloading Worker (積卸作業員) | 2/10 | 123K | ¥394万 |

### Top 20 by workforce

| # | Occupation | AI risk | Workers | Pay |
|---|---|---|---|---|
| 1 | General Office Clerk (一般事務) | 9/10 | 2.6M | ¥530万 |
| 2 | Facility Care Worker (施設介護員) | 2/10 | 1.4M | ¥376万 |
| 3 | Building Cleaner (ビル清掃) | 2/10 | 911K | ¥286万 |
| 4 | Nurse (看護師) | 4/10 | 693K | ¥520万 |
| 5 | Quarantine Officer (Nurse) (検疫官（看護師）) | 4/10 | 693K | ¥520万 |
| 6 | Nursery Teacher (Hoikushi) (保育士) | 3/10 | 634K | ¥407万 |
| 7 | Accounting Clerk (経理事務) | 9/10 | 508K | ¥509万 |
| 8 | Bank Teller (銀行等窓口事務) | 9/10 | 508K | ¥509万 |
| 9 | Tax Office Officer (税務事務官) | 7/10 | 508K | ¥509万 |
| 10 | Die Maker (金型工) | 3/10 | 457K | ¥472万 |
| 11 | Entrepreneur / Startup Founder (起業、創業) | 7/10 | 457K | ? |
| 12 | Company Owner / Executive (会社経営者) | 7/10 | 457K | ? |
| 13 | Order Picker (ピッキング作業員) | 4/10 | 383K | ¥345万 |
| 14 | Backyard Staff (Supermarket Food) (バックヤード作業員（スーパー食品部門）) | 3/10 | 383K | ¥345万 |
| 15 | Factory Laborer (工場労務作業員) | 2/10 | 383K | ¥345万 |
| 16 | Electrician (電気工事士) | 2/10 | 380K | ¥548万 |
| 17 | Facility Security Guard (施設警備員) | 3/10 | 375K | ¥354万 |
| 18 | Receptionist (受付事務) | 8/10 | 370K | ¥356万 |
| 19 | Trading Company Sales (Sosha) (商社営業) | 7/10 | 352K | ¥618万 |
| 20 | Advertising Sales (広告営業) | 7/10 | 352K | ¥618万 |

### Top 20 by salary

| # | Occupation | AI risk | Workers | Pay |
|---|---|---|---|---|
| 1 | Pilot (パイロット) | 4/10 | 7K | ¥1,697万 |
| 2 | Pediatrician (小児科医) | 4/10 | 43K | ¥1,338万 |
| 3 | Internal Medicine Physician (内科医) | 4/10 | 43K | ¥1,338万 |
| 4 | Psychiatrist (精神科医) | 4/10 | 43K | ¥1,338万 |
| 5 | Obstetrician/Gynecologist (産婦人科医) | 4/10 | 43K | ¥1,338万 |
| 6 | Surgeon (外科医) | 3/10 | 43K | ¥1,338万 |
| 7 | Anesthesiologist (麻酔科医) | 3/10 | 43K | ¥1,338万 |
| 8 | Orthopedic Surgeon (整形外科医) | 3/10 | 43K | ¥1,338万 |
| 9 | Dentist (歯科医師) | 4/10 | 98K | ¥1,136万 |
| 10 | University/College Faculty (大学・短期大学教員) | 6/10 | 180K | ¥1,093万 |
| 11 | Bank Branch Manager (銀行支店長) | 7/10 | 24K | ¥917万 |
| 12 | General Affairs Section Chief (総務課長) | 7/10 | 24K | ¥917万 |
| 13 | HR Section Chief (人事課長) | 7/10 | 24K | ¥917万 |
| 14 | Accounting Section Chief (経理課長) | 7/10 | 24K | ¥917万 |
| 15 | Sales Section Chief (営業課長) | 7/10 | 24K | ¥917万 |
| 16 | Equity Research Analyst (証券アナリスト) | 8/10 | 9K | ¥903万 |
| 17 | Actuary (アクチュアリー) | 8/10 | 9K | ¥903万 |
| 18 | Fund Manager (ファンドマネージャー) | 8/10 | 9K | ¥903万 |
| 19 | Labor and Social Security Attorney (Sharoshi) (社会保険労務士) | 7/10 | 22K | ¥903万 |
| 20 | SMB Diagnostician (Shoshindanshi) (中小企業診断士) | 7/10 | 9K | ¥903万 |

## All 552 occupations (AI risk order)

Sorted by AI risk descending, then by workforce descending.

| # | Occupation | Pay | Workers | Avg age | Recruit ratio | Top edu | AI risk | Rationale |
|---|-----------|-----|---------|---------|---------------|---------|---------|-----------|
| 1 | Data Entry Operator (データ入力) | ¥356万 | 156K | 41.0 | 0.21 | High school | 10/10 | Data entry; max AI replacement |
| 2 | Mail-Order Receipt Clerk (通信販売受付事務) | ¥394万 | 146K | 43.6 | 0.77 | Bachelor's | 10/10 | Mail order receipt; AI chat replaces |
| 3 | General Office Clerk (一般事務) | ¥530万 | 2.6M | 44.5 | 0.30 | Bachelor's | 9/10 | General clerical; AI rapid |
| 4 | Accounting Clerk (経理事務) | ¥509万 | 508K | 43.4 | 0.59 | Bachelor's | 9/10 | Accounting clerk; AI booking rising |
| 5 | Bank Teller (銀行等窓口事務) | ¥509万 | 508K | 43.4 | 3.76 | Bachelor's | 9/10 | Bank teller; branches shrinking, AI |
| 6 | P&C Insurance Clerk (損害保険事務) | ¥512万 | 174K | 42.4 | 2.03 | Bachelor's | 9/10 | Insurance clerk; AI rapid |
| 7 | Infrastructure Systems Engineer (システムエンジニア（基盤システム）) | ¥753万 | 164K | 41.4 | 2.28 | Bachelor's | 9/10 | Infrastructure SE; AI configuration |
| 8 | Call Center Operator (コールセンターオペレーター) | ¥394万 | 146K | 43.6 | 0.77 | Bachelor's | 9/10 | Call center; rapidly displaced by AI/IVR |
| 9 | Supermarket Cashier (スーパーレジ係) | ¥369万 | 143K | 42.7 | 2.80 | High school | 9/10 | Cashier; rapid self-checkout displacement |
| 10 | Paralegal (Lawyer's Assistant) (パラリーガル（弁護士補助職）) | ¥481万 | 121K | 43.5 | 0.59 | Bachelor's | 9/10 | Paralegal; AI research expanding |
| 11 | Pharmacy Office Clerk (調剤薬局事務) | ¥481万 | 121K | 43.5 | 2.49 | Bachelor's | 9/10 | Pharmacy clerk; AI clerical rising |
| 12 | Care Office Clerk (介護事務) | ¥481万 | 121K | 43.5 | 1.85 | High school | 9/10 | Care clerical; AI automating |
| 13 | Medical Office Clerk (医療事務) | ¥481万 | 121K | 43.5 | 1.61 | Vocational | 9/10 | Medical clerical; receipt AI |
| 14 | Systems Engineer (Custom Software) (システムエンジニア（受託開発）) | ¥574万 | 49K | 38.0 | 2.57 | Bachelor's | 9/10 | SE; heavy AI code generation |
| 15 | Programmer (プログラマー) | ¥574万 | 49K | 38.0 | 0.94 | Bachelor's | 9/10 | Programmer; AI copilot pervasive |
| 16 | Systems Engineer (Web Services) (システムエンジニア（Webサービス開発）) | ¥574万 | 49K | 38.0 | 2.57 | Bachelor's | 9/10 | Web SE; AI design + gen |
| 17 | Package Software Developer (ソフトウェア開発（パッケージソフト）) | ¥574万 | 49K | 38.0 | 2.57 | Bachelor's | 9/10 | Package SW dev; AI support |
| 18 | Mobile App Developer (ソフトウェア開発（スマホアプリ）) | ¥574万 | 49K | 38.0 | 2.57 | Bachelor's | 9/10 | App dev; AI gen rising |
| 19 | UX/UI Designer (UX/UIデザイナー) | ¥574万 | 49K | 38.0 | 4.73 | Bachelor's | 9/10 | UX/UI designer; gen AI rising |
| 20 | IT Help Desk (ヘルプデスク（IT）) | ¥629万 | 26K | 43.4 | 1.79 | Bachelor's | 9/10 | Helpdesk; AI displacing fast |
| 21 | Data Engineer (データエンジニア) | ¥629万 | 26K | 43.4 | 2.25 | Bachelor's | 9/10 | Data engineer; AI collaboration |
| 22 | Illustrator (イラストレーター) | ¥453万 | 24K | 36.8 | 0.06 | Bachelor's | 9/10 | Illustrator; gen AI rapid |
| 23 | Translator (翻訳者) | ¥680万 | 15K | 41.5 | 0.11 | Bachelor's | 9/10 | Translator; one of largest AI impact areas |
| 24 | Copywriter (コピーライター) | ¥680万 | 15K | 41.5 | 0.11 | Bachelor's | 9/10 | Copywriter; AI gen rising |
| 25 | Web Designer (Web Production) (Webデザイナー（Web制作会社）) | ¥484万 | 14K | 38.5 | 0.12 | Bachelor's | 9/10 | Web designer; gen AI rising |
| 26 | CG/3D Creator (CG制作) | ¥484万 | 14K | 38.5 | 0.42 | Vocational | 9/10 | CG creator; AI gen rising |
| 27 | Advertising Designer (広告デザイナー) | ¥484万 | 14K | 38.5 | 0.15 | Bachelor's | 9/10 | Ad designer; gen AI rising |
| 28 | Graphic Designer (グラフィックデザイナー) | ¥484万 | 14K | 38.5 | 0.15 | Vocational | 9/10 | Graphic design; max AI gen impact |
| 29 | Technical Writer (テクニカルライター) | ¥680万 | 14K | 41.5 | 0.21 | Bachelor's | 9/10 | Tech writer; AI gen rapid |
| 30 | Video Producer (動画制作) | ¥591万 | 10K | 42.7 | 0.43 | Bachelor's | 9/10 | Video creator; AI gen rapid |
| 31 | Stenographer / Audio Transcriber (速記者、音声反訳者) | ¥591万 | 10K | 42.7 | 0.43 | ? | 9/10 | Stenographer; ASR rapid replacement |
| 32 | Receptionist (受付事務) | ¥356万 | 370K | 42.0 | 1.09 | Bachelor's | 8/10 | Receptionist; chatbots reducing |
| 33 | Production Process Clerk (生産・工程管理事務) | ¥521万 | 292K | 45.1 | 1.99 | Bachelor's | 8/10 | Production clerical; AI rising |
| 34 | Shipping/Receiving Clerk (出荷・受荷事務) | ¥521万 | 292K | 45.1 | 1.66 | Bachelor's | 8/10 | Shipping clerical; AI rising |
| 35 | CAD Operator (CADオペレーター) | ¥454万 | 289K | 41.9 | 0.79 | Bachelor's | 8/10 | CAD work; AI-generated design encroaching |
| 36 | HR Office Clerk (人事事務) | ¥514万 | 264K | 44.6 | 1.14 | Bachelor's | 8/10 | HR clerk; HR DX progressing |
| 37 | General Affairs Clerk (総務事務) | ¥514万 | 264K | 44.6 | 1.34 | Bachelor's | 8/10 | General affairs; AI process automation |
| 38 | Sales Office Clerk (営業事務) | ¥512万 | 174K | 42.4 | 1.42 | Bachelor's | 8/10 | Sales clerk; AI order processing |
| 39 | Trade Office Clerk (貿易事務) | ¥512万 | 174K | 42.4 | 0.25 | Bachelor's | 8/10 | Trade clerical; AI doc processing |
| 40 | DX (Digital Transformation) Producer (DXプロデューサー) | ¥753万 | 164K | 41.4 | 0.89 | Bachelor's | 8/10 | DX producer; strategy + AI |
| 41 | Postal Window Clerk (郵便局郵便窓口業務) | ¥506万 | 147K | 45.9 | 6.01 | High school | 8/10 | Post counter; declining + AI |
| 42 | Medical Records Manager (診療情報管理士) | ¥481万 | 121K | 43.5 | 1.61 | Vocational | 8/10 | Medical records; high AI automation |
| 43 | E-Commerce Product Planner (ネット通販の企画開発) | ¥691万 | 121K | 42.0 | 0.54 | Bachelor's | 8/10 | E-commerce planning; AI tools |
| 44 | E-Commerce Operations Manager (ネット通販の運営) | ¥481万 | 121K | 43.5 | 0.85 | Bachelor's | 8/10 | E-commerce ops; automation rising |
| 45 | Web Marketer (Digital Ads/Promotion) (Webマーケティング（ネット広告・販売促進）) | ¥691万 | 121K | 42.0 | 0.54 | Bachelor's | 8/10 | Web marketing; AI tools rapid |
| 46 | Planning/Research Officer (企画・調査担当) | ¥691万 | 121K | 42.0 | 0.54 | Bachelor's | 8/10 | Planning/research; AI analytics |
| 47 | Corporate Legal Officer (企業法務担当) | ¥481万 | 121K | 43.5 | 0.59 | Bachelor's | 8/10 | Corp legal; AI contract analysis |
| 48 | Market Researcher (マーケティング・リサーチャー) | ¥691万 | 121K | 42.0 | 0.54 | Bachelor's | 8/10 | Market researcher; AI analytics |
| 49 | Securities Trader (ディーラー) | ¥662万 | 97K | 40.7 | 2.79 | Bachelor's | 8/10 | Trader; AI trading rising |
| 50 | Securities Representative (証券外務員) | ¥662万 | 97K | 40.7 | 2.79 | Bachelor's | 8/10 | Securities rep; AI trading |
| 51 | Tax Accountant (Zeirishi) (税理士) | ¥856万 | 64K | 43.1 | 2.31 | Bachelor's | 8/10 | Tax accountant; AI data processing |
| 52 | DTP Operator (Pre-Press) (製版オペレーター、DTPオペレーター) | ¥463万 | 60K | 45.3 | 0.97 | Vocational | 8/10 | DTP op; AI automation |
| 53 | Animator (アニメーター) | ¥442万 | 58K | 41.0 | 1.29 | ? | 8/10 | Animator; AI in-betweening |
| 54 | Embedded/IoT Systems Engineer (システムエンジニア（組込み、IoT）) | ¥574万 | 49K | 38.0 | 4.77 | Bachelor's | 8/10 | Embedded SE; AI-aided design |
| 55 | Software Tester (Debug) (デバッグ作業) | ¥574万 | 49K | 38.0 | 4.73 | Bachelor's | 8/10 | Debug work; AI autotest rising |
| 56 | Industrial Robot Developer (産業用ロボット開発技術者) | ¥669万 | 49K | 42.2 | 3.21 | Bachelor's | 8/10 | Industrial robot dev; AI engineer |
| 57 | Taxi Dispatcher (タクシー配車オペレーター) | ¥506万 | 44K | 45.9 | 3.36 | High school | 8/10 | Taxi dispatch; AI routing replaces |
| 58 | Autonomous Driving Developer (自動運転開発エンジニア（自動車）) | ¥701万 | 34K | 42.0 | 2.75 | Bachelor's | 8/10 | Autonomous dev; AI/ML core |
| 59 | Meter Reader (検針員) | ¥426万 | 34K | 48.5 | 4.69 | High school | 8/10 | Meter reader; smart meters replacing |
| 60 | Cytotechnologist (細胞検査士) | ¥430万 | 27K | 39.9 | 1.97 | Bachelor's | 8/10 | Cytotech; AI image dx replacing |
| 61 | IT Operations Engineer (運用・管理（IT）) | ¥629万 | 26K | 43.4 | 2.73 | Bachelor's | 8/10 | IT ops; AIOps rising |
| 62 | AI Engineer (AIエンジニア) | ¥629万 | 26K | 43.4 | 2.25 | Master's | 8/10 | AI engineer; develops AI itself |
| 63 | Technical Illustrator (テクニカルイラストレーター) | ¥453万 | 24K | 36.8 | 0.06 | ? | 8/10 | Tech illustrator; AI gen |
| 64 | Computer Science Researcher (情報工学研究者) | ¥750万 | 16K | 40.6 | 0.45 | Doctoral | 8/10 | CS researcher; researches AI itself |
| 65 | Book Designer (ブックデザイナー) | ¥484万 | 14K | 38.5 | 0.42 | ? | 8/10 | Book designer; AI gen support |
| 66 | Textile Designer (テキスタイルデザイナー) | ¥484万 | 14K | 38.5 | 0.42 | Bachelor's | 8/10 | Textile designer; AI gen rising |
| 67 | Data Scientist (データサイエンティスト) | ¥573万 | 11K | 43.0 | 11.88 | Bachelor's | 8/10 | Data scientist; AI collaboration |
| 68 | Interpreter (通訳者) | ¥591万 | 10K | 42.7 | 0.21 | Bachelor's | 8/10 | Interpreter; real-time AI nearing |
| 69 | Video Editor (映像編集者) | ¥591万 | 10K | 42.7 | 0.43 | Bachelor's | 8/10 | Video editor; AI tools advancing |
| 70 | Web Director (Web Production) (Webディレクター（Web制作会社）) | ¥591万 | 10K | 42.7 | 0.43 | Bachelor's | 8/10 | Web director; AI-aided planning |
| 71 | Game Creator (ゲームクリエーター) | ¥591万 | 10K | 42.7 | 0.43 | ? | 8/10 | Game creator; AI tools rising |
| 72 | IP Searcher (知的財産サーチャー) | ¥591万 | 10K | 42.7 | 0.43 | Bachelor's | 8/10 | IP searcher; AI search displacing |
| 73 | Equity Research Analyst (証券アナリスト) | ¥903万 | 9K | 39.5 | 0.57 | Bachelor's | 8/10 | Equity analyst; AI analytics rapid |
| 74 | Actuary (アクチュアリー) | ¥903万 | 9K | 39.5 | 0.57 | Master's | 8/10 | Actuary; AI analytics rising |
| 75 | Fund Manager (ファンドマネージャー) | ¥903万 | 9K | 39.5 | 0.57 | Bachelor's | 8/10 | Fund mgr; AI/algo rising |
| 76 | Economist (エコノミスト) | ¥750万 | 3K | 40.6 | ? | Bachelor's | 8/10 | Economist; AI forecasting rising |
| 77 | Tax Office Officer (税務事務官) | ¥509万 | 508K | 43.4 | 2.51 | Bachelor's | 7/10 | Tax officer; investigation AI rising |
| 78 | Entrepreneur / Startup Founder (起業、創業) | ? | 457K | ? | ? | Bachelor's | 7/10 | Founder; AI-aided planning |
| 79 | Company Owner / Executive (会社経営者) | ? | 457K | ? | ? | Bachelor's | 7/10 | Company owner; strategy + AI |
| 80 | Trading Company Sales (Sosha) (商社営業) | ¥618万 | 352K | 41.6 | 12.12 | Bachelor's | 7/10 | Trade sales; relationships + AI support |
| 81 | Advertising Sales (広告営業) | ¥618万 | 352K | 41.6 | 2.60 | Bachelor's | 7/10 | Ad sales; AI-generated proposals rising |
| 82 | Print Sales (印刷営業) | ¥618万 | 352K | 41.6 | 11.21 | Bachelor's | 7/10 | Print sales; AI tools assist quoting |
| 83 | Public Relations / PR Officer (広報・PR担当) | ¥514万 | 264K | 44.6 | 1.34 | Bachelor's | 7/10 | PR; AI gen articles |
| 84 | Internal Auditor (内部監査人) | ¥514万 | 264K | 44.6 | 1.34 | Bachelor's | 7/10 | Internal auditor; AI audit tools |
| 85 | Pharmacist (薬剤師) | ¥599万 | 244K | 40.9 | 3.57 | Bachelor's | 7/10 | Pharmacist; prescription AI rising |
| 86 | IT Consulting Sales (コンサルティング営業（IT）) | ¥653万 | 194K | 41.3 | 4.02 | Bachelor's | 7/10 | IT consult sales; pitch + AI |
| 87 | Office Equipment Sales (OA機器営業) | ¥594万 | 194K | 40.9 | 14.13 | Bachelor's | 7/10 | Office equip sales; in-person + AI |
| 88 | Franchise Chain Supervisor (フランチャイズチェーン・スーパーバイザー) | ¥512万 | 174K | 42.4 | 2.03 | Bachelor's | 7/10 | Franchise SV; store guidance role |
| 89 | Travel Agency Counter Clerk (旅行会社カウンター係) | ¥512万 | 174K | 42.4 | 2.03 | Bachelor's | 7/10 | Travel agent; AI booking displacing |
| 90 | IT Project Manager (プロジェクトマネージャ（IT）) | ¥753万 | 164K | 41.4 | 2.10 | Bachelor's | 7/10 | IT PM; planning + coordination |
| 91 | IT Consultant (ITコンサルタント) | ¥753万 | 164K | 41.4 | 0.89 | Bachelor's | 7/10 | IT consultant; strategy + AI |
| 92 | Bank Corporate Officer (Outside Sales) (銀行・信用金庫渉外担当) | ¥631万 | 156K | 37.9 | 8.31 | Bachelor's | 7/10 | Bank corp officer; AI rising |
| 93 | Gas Station Staff (ガソリンスタンド・スタッフ) | ¥369万 | 143K | 42.7 | 5.53 | High school | 7/10 | Gas station; self-serve rapid |
| 94 | CD Shop Clerk (CDショップ店員) | ¥369万 | 143K | 42.7 | 5.82 | High school | 7/10 | CD shop; sector shrinking |
| 95 | National Civil Servant (Administrative) (国家公務員（行政事務）) | ¥481万 | 121K | 43.5 | 0.59 | Bachelor's | 7/10 | National civil servant; doc automation |
| 96 | Local Civil Servant (Administrative) (地方公務員（行政事務）) | ¥481万 | 121K | 43.5 | 0.59 | Bachelor's | 7/10 | Local civil servant; doc automation |
| 97 | Solar Power Project Planner (太陽光発電の企画・調査) | ¥691万 | 121K | 42.0 | 0.54 | Bachelor's | 7/10 | Solar planner; survey + proposal |
| 98 | Secretary (秘書) | ¥555万 | 121K | 44.9 | 0.67 | Bachelor's | 7/10 | Secretary; AI scheduling reducing |
| 99 | School Office Clerk (学校事務) | ¥481万 | 121K | 43.5 | 0.83 | Bachelor's | 7/10 | School clerical; AI automating |
| 100 | Investor Relations / IR Officer (IR広報担当) | ¥481万 | 121K | 43.5 | 0.59 | Bachelor's | 7/10 | IR PR; AI-aided materials |
| 101 | Compliance Officer (コンプライアンス推進担当) | ¥481万 | 121K | 43.5 | 0.59 | Bachelor's | 7/10 | Compliance; AI monitoring |
| 102 | Product Planner (Chain Store) (商品企画開発（チェーンストア）) | ¥691万 | 121K | 42.0 | 0.54 | Bachelor's | 7/10 | Product planner; AI market data |
| 103 | Immigration Inspector (入国審査官) | ¥481万 | 121K | 43.5 | 0.83 | Bachelor's | 7/10 | Immigration officer; doc + AI |
| 104 | Clinical Research Monitor (臨床開発モニター) | ¥481万 | 121K | 43.5 | 1.61 | Master's | 7/10 | Clinical monitor; AI analysis |
| 105 | Event Planner / Operator (イベントの企画・運営) | ¥691万 | 121K | 42.0 | 0.54 | Bachelor's | 7/10 | Event planner; planning + people |
| 106 | Private University Office Clerk (学校事務（私立大学）) | ¥481万 | 121K | 43.5 | 0.83 | Bachelor's | 7/10 | Univ clerical; AI rising |
| 107 | Hello Work (Public Employment Office) Staff (ハローワーク職員) | ¥481万 | 121K | 43.5 | 0.15 | ? | 7/10 | Hello Work staff; AI matching |
| 108 | Wind Power Project Planner (風力発電の企画・調査) | ¥691万 | 121K | 42.0 | 0.54 | ? | 7/10 | Wind planner; survey + proposal |
| 109 | English Conversation Teacher (英会話教師) | ¥438万 | 113K | 38.5 | 1.58 | Bachelor's | 7/10 | English teacher; AI conversation rising |
| 110 | Clinical Laboratory Technologist (臨床検査技師) | ¥504万 | 83K | 40.4 | 1.75 | Bachelor's | 7/10 | Lab tech; AI analysis rising fast |
| 111 | Audio/Recording Engineer (録音エンジニア) | ¥454万 | 62K | 41.9 | 0.74 | Vocational | 7/10 | Audio engineer; AI processing rising |
| 112 | Semiconductor Engineer (半導体技術者) | ¥755万 | 61K | 43.8 | 1.09 | Bachelor's | 7/10 | Semicon engineer; AI design rising |
| 113 | Electrical Engineer (電気技術者) | ¥755万 | 61K | 43.8 | 2.68 | Bachelor's | 7/10 | Electrical eng; AI design support |
| 114 | Electronics Engineer (電子機器技術者) | ¥755万 | 61K | 43.8 | 2.68 | Bachelor's | 7/10 | Electronics eng; AI design rising |
| 115 | Quality Control Engineer (生産・品質管理技術者) | ¥755万 | 61K | 43.8 | 4.15 | Bachelor's | 7/10 | QA engineer; AI analytics rising |
| 116 | Medical Device Developer (医療機器開発技術者) | ¥755万 | 61K | 43.8 | 2.68 | Bachelor's | 7/10 | Medical device dev; AI design |
| 117 | Radiology Technologist (診療放射線技師) | ¥550万 | 57K | 40.0 | 1.19 | Bachelor's | 7/10 | Radiology tech; AI imaging rapid |
| 118 | Civil Engineer (Design) (土木設計技術者) | ¥596万 | 53K | 46.0 | 9.95 | Bachelor's | 7/10 | Civil engineering CAD increasingly AI-aided |
| 119 | Mechanical Design Engineer (機械設計技術者) | ¥669万 | 49K | 42.2 | 3.21 | Bachelor's | 7/10 | Mech engineer; CAD/AI generation |
| 120 | Precision Instrument Engineer (精密機器技術者) | ¥669万 | 49K | 42.2 | 3.21 | Bachelor's | 7/10 | Precision instrument eng; AI design |
| 121 | Plant Designer (Industrial) (プラント設計技術者) | ¥669万 | 49K | 42.2 | 3.21 | Master's | 7/10 | Plant designer; CAD/AI design |
| 122 | Aircraft Engine (Jet) Developer (航空機開発エンジニア（ジェットエンジン）) | ¥669万 | 49K | 42.2 | 3.21 | Bachelor's | 7/10 | Jet engine dev; AI design |
| 123 | Architectural Designer (建築設計技術者) | ¥642万 | 49K | 43.6 | 2.85 | Bachelor's | 7/10 | Architecture; BIM and AI tools rising |
| 124 | Biomass Power Plant Designer (バイオマス発電プラントの設計) | ¥642万 | 49K | 43.6 | 2.85 | ? | 7/10 | Biomass plant design |
| 125 | Station Staff (駅務員) | ¥506万 | 44K | 45.9 | 3.42 | Bachelor's | 7/10 | Station staff; auto-gates + AI info |
| 126 | Rail Operations Dispatcher (鉄道運転計画・運行管理) | ¥506万 | 44K | 45.9 | 3.36 | High school | 7/10 | Rail dispatcher; AI scheduling |
| 127 | Flight Dispatcher (ディスパッチャー（航空機運航管理者）) | ¥506万 | 44K | 45.9 | 3.36 | Bachelor's | 7/10 | Flight dispatcher; AI scheduling |
| 128 | Automotive Engineer (自動車技術者) | ¥701万 | 34K | 42.0 | 2.75 | Bachelor's | 7/10 | Auto engineer; AI-aided design |
| 129 | Ship Designer (R&D) (造船技術者（船舶の開発・設計）) | ¥701万 | 34K | 42.0 | 3.77 | High school | 7/10 | Ship designer; CAD/AI |
| 130 | Rail Vehicle Designer (鉄道車両の設計・開発) | ¥701万 | 34K | 42.0 | 3.77 | ? | 7/10 | Rail vehicle design; CAD/AI |
| 131 | Analytical Chemist (分析化学技術者) | ¥613万 | 30K | 40.5 | 1.21 | Bachelor's | 7/10 | Analytical chem; AI analysis rapid |
| 132 | Polymer Chemist (高分子化学技術者) | ¥613万 | 30K | 40.5 | 0.90 | Master's | 7/10 | Polymer chem; AI R&D rising |
| 133 | Biotechnology Engineer (バイオテクノロジー技術者) | ¥613万 | 30K | 40.5 | 0.90 | Master's | 7/10 | Biotech engineer; AI R&D |
| 134 | Merchandiser / Buyer (マーチャンダイザー、バイヤー) | ¥473万 | 30K | 42.3 | 1.67 | Bachelor's | 7/10 | Buyer; AI demand analysis |
| 135 | Telecom Engineer (電気通信技術者) | ¥629万 | 26K | 43.4 | 3.22 | Bachelor's | 7/10 | Telecom eng; AI design + build |
| 136 | Security Operations Expert (セキュリティエキスパート（オペレーション）) | ¥629万 | 26K | 43.4 | 2.73 | Bachelor's | 7/10 | Security ops; AI threat detection |
| 137 | Vulnerability Assessment Specialist (セキュリティエキスパート（脆弱性診断）) | ¥629万 | 26K | 43.4 | 2.25 | ? | 7/10 | Vulnerability tester; AI tools |
| 138 | Digital Forensics Specialist (セキュリティエキスパート（デジタルフォレンジック）) | ¥629万 | 26K | 43.4 | 2.25 | ? | 7/10 | Digital forensics; AI analysis |
| 139 | Bank Branch Manager (銀行支店長) | ¥917万 | 24K | 51.2 | 1.49 | Bachelor's | 7/10 | Bank branch manager; automation rising |
| 140 | General Affairs Section Chief (総務課長) | ¥917万 | 24K | 51.2 | 1.49 | Bachelor's | 7/10 | GA mgr; operations + HR |
| 141 | HR Section Chief (人事課長) | ¥917万 | 24K | 51.2 | 1.49 | Bachelor's | 7/10 | HR mgr; HR AI integration |
| 142 | Accounting Section Chief (経理課長) | ¥917万 | 24K | 51.2 | 1.49 | Bachelor's | 7/10 | Accounting mgr; AI accounting |
| 143 | Sales Section Chief (営業課長) | ¥917万 | 24K | 51.2 | 1.49 | Bachelor's | 7/10 | Sales mgr; in-person + AI |
| 144 | Japanese Language Teacher (日本語教師) | ¥491万 | 24K | 45.6 | 1.45 | Bachelor's | 7/10 | Japanese teacher; AI translation rivals |
| 145 | Certified Public Accountant (公認会計士) | ¥856万 | 22K | 43.1 | 0.32 | Bachelor's | 7/10 | CPA; audit AI tools expanding |
| 146 | Labor and Social Security Attorney (Sharoshi) (社会保険労務士) | ¥903万 | 22K | 39.5 | 0.89 | Bachelor's | 7/10 | Labor consultant; paperwork automating |
| 147 | Video Rental Clerk (ビデオレンタル店店員) | ¥396万 | 21K | 43.1 | 10.47 | High school | 7/10 | Video rental; sector declining |
| 148 | Customs Officer (税関職員) | ¥329万 | 17K | 53.0 | 5.14 | ? | 7/10 | Customs officer; AI inspection |
| 149 | Civil/Architectural Engineering Researcher (土木・建築工学研究者) | ¥750万 | 16K | 40.6 | 0.45 | Bachelor's | 7/10 | Civil/arch researcher; AI analysis |
| 150 | Medical Researcher (医学研究者) | ¥750万 | 16K | 40.6 | 0.45 | Doctoral | 7/10 | Medical researcher; AI analysis rapid |
| 151 | Forensic Crime Lab Researcher (科学捜査研究所鑑定技術職員) | ¥750万 | 16K | 40.6 | 0.45 | Master's | 7/10 | Forensic researcher; AI analytics |
| 152 | Pharmaceutical Researcher (薬学研究者) | ¥750万 | 16K | 40.6 | 0.45 | Master's | 7/10 | Pharma researcher; AI drug discovery |
| 153 | Biotechnology Researcher (バイオテクノロジー研究者) | ¥750万 | 16K | 40.6 | 0.45 | Doctoral | 7/10 | Biotech researcher; AI analysis |
| 154 | Librarian (図書館司書) | ¥591万 | 16K | 42.7 | 0.14 | Bachelor's | 7/10 | Librarian; AI Q&A displacing |
| 155 | Narrator (ナレーター) | ¥589万 | 16K | 40.0 | 0.56 | ? | 7/10 | Narrator; AI voice synth nearing |
| 156 | Display Designer (ディスプレイデザイナー) | ¥484万 | 14K | 38.5 | 0.42 | ? | 7/10 | Display designer; plan + install |
| 157 | Interior Designer (インテリアデザイナー) | ¥484万 | 14K | 38.5 | 0.42 | Bachelor's | 7/10 | Interior designer; AI-aided |
| 158 | Interior Coordinator (インテリアコーディネーター) | ¥484万 | 14K | 38.5 | 0.42 | Bachelor's | 7/10 | Interior coordinator; AI tools |
| 159 | Color Coordinator (カラーコーディネーター) | ¥484万 | 14K | 38.5 | 0.42 | ? | 7/10 | Color coordinator; sense + AI |
| 160 | Fashion Designer (ファッションデザイナー) | ¥484万 | 14K | 38.5 | 0.42 | Vocational | 7/10 | Fashion designer; AI ideation |
| 161 | Jewelry Designer (ジュエリーデザイナー) | ¥484万 | 14K | 38.5 | 0.42 | Bachelor's | 7/10 | Jewelry designer; CAD/AI |
| 162 | Industrial Designer (インダストリアルデザイナー) | ¥484万 | 14K | 38.5 | 0.42 | Bachelor's | 7/10 | Industrial designer; CAD/AI |
| 163 | Newspaper Reporter (新聞記者) | ¥680万 | 14K | 41.5 | 0.21 | Bachelor's | 7/10 | Journalist; writing AI co-pilot |
| 164 | Magazine Reporter (雑誌記者) | ¥680万 | 14K | 41.5 | 0.21 | Bachelor's | 7/10 | Mag reporter; AI writing tools |
| 165 | Book Editor (図書編集者) | ¥680万 | 14K | 41.5 | 0.21 | Bachelor's | 7/10 | Book editor; AI editing tools |
| 166 | Magazine Editor (雑誌編集者) | ¥680万 | 14K | 41.5 | 0.21 | Bachelor's | 7/10 | Mag editor; AI gen competition |
| 167 | Judicial Scrivener (Shihoshoshi) (司法書士) | ¥765万 | 13K | 47.2 | 1.59 | Bachelor's | 7/10 | Judicial scrivener; AI doc automation |
| 168 | Patent Attorney (Benrishi) (弁理士) | ¥765万 | 13K | 47.2 | 1.77 | Bachelor's | 7/10 | Patent attorney; AI doc support rising |
| 169 | Nuclear Power Engineer (原子力技術者) | ¥573万 | 11K | 43.0 | 1.03 | Master's | 7/10 | Nuclear eng; AI monitoring rising |
| 170 | Fine Ceramics Engineer (ファインセラミックス製造技術者) | ¥573万 | 11K | 43.0 | 1.03 | Bachelor's | 7/10 | Fine ceramics R&D; AI rising |
| 171 | Aerospace Engineer (宇宙開発技術者) | ¥573万 | 11K | 43.0 | 11.88 | Bachelor's | 7/10 | Aerospace eng; AI design rising |
| 172 | Lawyer (弁護士) | ¥765万 | 11K | 47.2 | ? | Bachelor's | 7/10 | Lawyer; research AI + courtroom in-person |
| 173 | Administrative Scrivener (Gyoseishoshi) (行政書士) | ¥591万 | 10K | 42.7 | 0.43 | Bachelor's | 7/10 | Admin scrivener; doc automation rising |
| 174 | Career Counselor (キャリアカウンセラー/キャリアコンサルタント) | ¥591万 | 10K | 42.7 | 0.15 | Bachelor's | 7/10 | Career counselor; AI advice tools |
| 175 | Customs Broker (Tsukanshi) (通関士) | ¥591万 | 10K | 42.7 | 0.43 | Bachelor's | 7/10 | Customs broker; doc automation |
| 176 | Art Director (アートディレクター) | ¥591万 | 10K | 42.7 | 0.43 | Bachelor's | 7/10 | Art director; AI tools rising |
| 177 | Advertising Director (広告ディレクター) | ¥591万 | 10K | 42.7 | 0.43 | Bachelor's | 7/10 | Ad director; planning + AI |
| 178 | Stylist (スタイリスト) | ¥591万 | 10K | 42.7 | 0.43 | Vocational | 7/10 | Stylist; in-person + AI style |
| 179 | Food Coordinator (フードコーディネーター) | ¥591万 | 10K | 42.7 | 0.43 | ? | 7/10 | Food coordinator; planning + AI |
| 180 | PR Consultant (広報コンサルタント) | ¥591万 | 10K | 42.7 | 0.43 | Bachelor's | 7/10 | PR consultant; AI-aided advice |
| 181 | IP Coordinator (知的財産コーディネーター) | ¥591万 | 10K | 42.7 | 0.43 | Bachelor's | 7/10 | IP coordinator; coord + AI search |
| 182 | Social Education Officer (Shakaikyoiku-shuji) (社会教育主事) | ¥591万 | 10K | 42.7 | 0.43 | Bachelor's | 7/10 | Social ed officer; planning + AI |
| 183 | International Development Specialist (国際協力専門家) | ¥591万 | 10K | 42.7 | 0.43 | Master's | 7/10 | Intl development; planning + people |
| 184 | Labor Standards Inspector (労働基準監督官) | ¥591万 | 10K | 42.7 | 0.43 | Bachelor's | 7/10 | Labor inspector; investigation + AI |
| 185 | Information Security Auditor (セキュリティエキスパート（情報セキュリティ監査）) | ¥591万 | 10K | 42.7 | 0.43 | Bachelor's | 7/10 | Security audit; AI-aided |
| 186 | SMB Diagnostician (Shoshindanshi) (中小企業診断士) | ¥903万 | 9K | 39.5 | 0.57 | Bachelor's | 7/10 | Business consultant; analysis + advice |
| 187 | Management Consultant (経営コンサルタント) | ¥903万 | 9K | 39.5 | 0.57 | Bachelor's | 7/10 | Mgmt consultant; strategy + AI tools |
| 188 | Financial Planner (ファイナンシャル・プランナー) | ¥903万 | 9K | 39.5 | 0.57 | Bachelor's | 7/10 | Financial planner; advice + AI tools |
| 189 | HR Consultant (人事コンサルタント) | ¥903万 | 9K | 39.5 | 0.57 | Bachelor's | 7/10 | HR consultant; AI analytics |
| 190 | M&A Manager / Advisor (M&Aマネージャー、M&Aコンサルタント/M&Aアドバイザー) | ¥903万 | 9K | 39.5 | 0.57 | Bachelor's | 7/10 | M&A advisor; AI valuation |
| 191 | Independent Financial Advisor (IFA) (独立系ファイナンシャル・アドバイザー（IFA）) | ¥903万 | 9K | 39.5 | 0.57 | Bachelor's | 7/10 | IFA; in-person + AI tools |
| 192 | Plant Factory R&D Engineer (植物工場の研究開発) | ¥573万 | 9K | 43.0 | 0.94 | ? | 7/10 | Plant factory R&D; AI models |
| 193 | Food Technologist (食品技術者) | ¥573万 | 9K | 43.0 | 0.71 | High school | 7/10 | Food technologist; AI R&D |
| 194 | Land and House Investigator (Tochikaokuchosashi) (土地家屋調査士) | ¥765万 | 6K | 47.2 | 0.91 | Bachelor's | 7/10 | Land surveyor; field + paperwork |
| 195 | Prosecutor's Affairs Officer (検察事務官) | ¥765万 | 6K | 47.2 | 0.91 | Bachelor's | 7/10 | Pros affairs officer; doc + AI |
| 196 | Patent Examiner (特許審査官) | ¥765万 | 6K | 47.2 | 0.91 | Master's | 7/10 | Patent examiner; AI prior art search |
| 197 | Sociology Researcher (社会学研究者) | ¥750万 | 3K | 40.6 | ? | ? | 7/10 | Sociologist; AI analysis + writing |
| 198 | Food Maker Sales (食品営業（食品メーカー）) | ¥618万 | 352K | 41.6 | 4.72 | Bachelor's | 6/10 | Food maker sales; in-person |
| 199 | Auto Sales (自動車営業) | ¥594万 | 194K | 40.9 | 14.47 | Bachelor's | 6/10 | Car sales; in-person consultation |
| 200 | University/College Faculty (大学・短期大学教員) | ¥1,093万 | 180K | 58.1 | 0.12 | ? | 6/10 | University faculty; research + AI tools |
| 201 | Insurance Sales (保険営業（生命保険、損害保険）) | ¥501万 | 156K | 46.7 | 8.31 | Bachelor's | 6/10 | Insurance sales; in-person + AI quote |
| 202 | Insurance Agency Sales (代理店営業（保険会社）) | ¥501万 | 156K | 46.7 | 8.31 | Bachelor's | 6/10 | Agency sales; in-person + AI |
| 203 | Real Estate Sales (Housing) (住宅・不動産営業) | ¥618万 | 139K | 41.6 | 3.00 | Bachelor's | 6/10 | Real estate sales; face-to-face advice |
| 204 | Hotel Front Desk Clerk (フロント（ホテル・旅館）) | ¥338万 | 127K | 39.0 | 2.59 | High school | 6/10 | Hotel front desk; automation rising |
| 205 | Dietitian (栄養士) | ¥394万 | 121K | 37.5 | 4.39 | Bachelor's | 6/10 | Dietitian; AI menu planning rising |
| 206 | Diplomat (外務公務員（外交官）) | ¥481万 | 121K | 43.5 | 0.59 | Bachelor's | 6/10 | Diplomat; in-person + intel analysis |
| 207 | International Civil Servant (国際公務員) | ¥481万 | 121K | 43.5 | 0.59 | Bachelor's | 6/10 | Intl civil servant; policy + info |
| 208 | Property Management Front (Mansion) (マンション管理フロント) | ¥481万 | 121K | 43.5 | 0.83 | Bachelor's | 6/10 | Property mgr; ops + paperwork |
| 209 | NPO Staff (Planning/Operations) (NPO法人職員（企画・運営）) | ¥691万 | 121K | 42.0 | 0.54 | Bachelor's | 6/10 | NPO staff; planning + interpersonal |
| 210 | Anime Production Manager (アニメ制作進行管理) | ¥481万 | 121K | 43.5 | 0.83 | ? | 6/10 | Anime production mgr; coord + plan |
| 211 | Pro Sports Org Staff (Planning/Ops) (プロスポーツ運営団体職員（企画・運営）) | ¥691万 | 121K | 42.0 | 0.54 | ? | 6/10 | Sports org staff; plan + interpersonal |
| 212 | Burger Shop Manager (ハンバーガーショップ店長) | ¥358万 | 114K | 39.9 | 10.51 | High school | 6/10 | Burger mgr; rapid automation |
| 213 | Cram School Teacher (学習塾教師) | ¥438万 | 113K | 38.5 | 1.58 | Bachelor's | 6/10 | Cram teacher; AI materials + in-person |
| 214 | Medical Representative (MR) (医薬情報担当者（MR）) | ¥618万 | 83K | 41.6 | 1.07 | Bachelor's | 6/10 | Pharma rep; doctor visits + info delivery |
| 215 | Pattern Maker (パタンナー) | ¥442万 | 58K | 41.0 | 0.48 | Vocational | 6/10 | Pattern maker; AI-aided |
| 216 | Drone Pilot (ドローンパイロット) | ¥467万 | 50K | 48.0 | 3.61 | ? | 6/10 | Drone pilot; AI autonomy |
| 217 | Seismic Inspector (耐震診断) | ¥642万 | 49K | 43.6 | 3.88 | ? | 6/10 | Seismic inspector; field + analysis |
| 218 | Care Manager (介護支援専門員/ケアマネジャー) | ¥430万 | 44K | 52.8 | 6.89 | Vocational | 6/10 | Care manager; in-person + paperwork |
| 219 | Care Facility Manager (施設管理者（介護施設）) | ¥441万 | 44K | 45.4 | 7.42 | High school | 6/10 | Care facility mgr; ops + HR |
| 220 | Child Development Support Manager (児童発達支援管理責任者) | ¥441万 | 44K | 45.4 | 8.99 | ? | 6/10 | Child dev mgr; in-person + paperwork |
| 221 | Welfare Service Manager (障害福祉サービス管理責任者) | ¥441万 | 44K | 45.4 | 8.99 | ? | 6/10 | Welfare service mgr; in-person + ops |
| 222 | Airport Ground Staff (空港グランドスタッフ) | ¥506万 | 44K | 45.9 | 3.42 | Bachelor's | 6/10 | Ground staff; self-service rising |
| 223 | Nondestructive Testing Inspector (非破壊検査技術者) | ¥427万 | 43K | 42.4 | 4.03 | High school | 6/10 | NDT inspector; AI image analysis |
| 224 | Power Plant Operator (発電所運転管理) | ¥659万 | 34K | 44.2 | 4.30 | Bachelor's | 6/10 | Power plant op; automation + judge |
| 225 | Clinical Research Coordinator (治験コーディネーター) | ¥430万 | 27K | 39.9 | 1.97 | Bachelor's | 6/10 | CRC; coord + paperwork |
| 226 | Hygiene Manager (Eisei Kanrisha) (衛生管理者) | ¥430万 | 27K | 39.9 | 1.97 | Bachelor's | 6/10 | Hygiene officer; planning + check |
| 227 | Commercial Photographer (商業カメラマン) | ¥453万 | 23K | 36.8 | 0.42 | Bachelor's | 6/10 | Commercial photographer; AI editing |
| 228 | Museum Curator (Gakugeiin) (学芸員) | ¥591万 | 16K | 42.7 | 0.21 | Bachelor's | 6/10 | Curator; research + AI search |
| 229 | Broadcast Director (放送ディレクター) | ¥589万 | 16K | 40.0 | 0.38 | Bachelor's | 6/10 | Director; planning + production |
| 230 | Broadcast Reporter (放送記者) | ¥680万 | 14K | 41.5 | 0.21 | Bachelor's | 6/10 | Broadcast reporter; field + writing |
| 231 | Ceramics Engineer (陶磁器技術者) | ¥573万 | 11K | 43.0 | 1.03 | Vocational | 6/10 | Ceramics tech; R&D + tradition |
| 232 | Judge (裁判官) | ? | 11K | ? | ? | Bachelor's | 6/10 | Judge; judgment + AI case research |
| 233 | Prosecutor (検察官) | ? | 11K | ? | ? | Master's | 6/10 | Prosecutor; judgment + AI support |
| 234 | Real Estate Appraiser (不動産鑑定士) | ¥591万 | 10K | 42.7 | 0.43 | Bachelor's | 6/10 | Appraiser; AI valuation + judgment |
| 235 | Weather Forecaster (気象予報士) | ¥591万 | 10K | 42.7 | 0.43 | Bachelor's | 6/10 | Weather forecaster; AI models + comm |
| 236 | Announcer (アナウンサー) | ¥591万 | 10K | 42.7 | 0.43 | Bachelor's | 6/10 | Announcer; AI voice synth nearing |
| 237 | Broadcast Engineer (テレビ・ラジオ放送技術者) | ¥591万 | 9K | 42.7 | 0.52 | Bachelor's | 6/10 | Broadcast tech; equipment ops |
| 238 | Hotel/Inn Manager (ホテル・旅館支配人) | ¥338万 | 8K | 39.0 | 3.98 | Bachelor's | 6/10 | Hotel manager; interpersonal + admin |
| 239 | Family Court Investigator (家庭裁判所調査官) | ¥765万 | 6K | 47.2 | 0.91 | Bachelor's | 6/10 | Family court investigator; interview + judgment |
| 240 | Supermarket Manager (スーパー店長) | ¥369万 | 304K | 42.7 | 4.70 | Bachelor's | 5/10 | Supermarket manager; ordering automating |
| 241 | High School Teacher (高等学校教員) | ¥679万 | 257K | 43.5 | 1.14 | Bachelor's | 5/10 | High school teacher; subject + counseling |
| 242 | Plastic Molder (プラスチック成形) | ¥439万 | 149K | 42.8 | 4.93 | High school | 5/10 | Plastic molding is machine-driven |
| 243 | Electronics Shop Clerk (電器店店員) | ¥369万 | 143K | 42.7 | 5.79 | Bachelor's | 5/10 | Electronics shop; technical sales |
| 244 | Bookstore Clerk (書店員) | ¥369万 | 143K | 42.7 | 5.82 | Bachelor's | 5/10 | Bookstore clerk; shelving + service |
| 245 | Shoe Fitter (シューフィッター) | ¥369万 | 143K | 42.7 | 5.82 | High school | 5/10 | Shoe fitter; in-person measurement |
| 246 | Station Kiosk Clerk (駅構内売店店員) | ¥369万 | 143K | 42.7 | 5.82 | High school | 5/10 | Station kiosk; service + stocking |
| 247 | Convenience Store Clerk (コンビニエンスストア店員) | ¥369万 | 143K | 42.7 | 2.87 | High school | 5/10 | Convenience store; cashier + stocking |
| 248 | OTC Drug Sales (Touroku Hanbaisha) (医薬品販売/登録販売者) | ¥369万 | 143K | 42.7 | 3.56 | Bachelor's | 5/10 | OTC drug sales; in-person + advice |
| 249 | Mobile Phone Sales (携帯電話販売) | ¥369万 | 143K | 42.7 | 34.41 | Bachelor's | 5/10 | Mobile phone sales; setup + service |
| 250 | Beverage Route Sales (清涼飲料ルートセールス) | ¥394万 | 139K | 46.9 | 1.70 | High school | 5/10 | Beverage route sales |
| 251 | Sommelier (ソムリエ) | ¥358万 | 127K | 39.9 | 2.91 | High school | 5/10 | Sommelier; in-person tasting |
| 252 | Hotel Customer Service (接客担当（ホテル・旅館）) | ¥338万 | 127K | 39.0 | 2.78 | High school | 5/10 | Hotel host; in-person service |
| 253 | Frozen Processed Food Manufacturer (冷凍加工食品製造) | ¥366万 | 94K | 43.5 | 2.05 | High school | 5/10 | Frozen food factories highly automated |
| 254 | Canned/Bottled/Retort Food Manufacturer (かん詰・びん詰・レトルト食品製造) | ¥366万 | 94K | 43.5 | 2.05 | High school | 5/10 | Canned/retort production heavily automated |
| 255 | CNC Machine Operator (NC工作機械オペレーター) | ¥466万 | 76K | 42.5 | 3.33 | High school | 5/10 | CNC operator; automation rising |
| 256 | Wedding Planner / Bridal Coordinator (ブライダルコーディネーター) | ¥396万 | 65K | 43.1 | 1.08 | Vocational | 5/10 | Wedding planner; in-person + AI support |
| 257 | Printing Press Operator (印刷オペレーター) | ¥463万 | 60K | 45.3 | 1.86 | High school | 5/10 | Print op; machine operation |
| 258 | Bindery Operator (製本オペレーター) | ¥463万 | 60K | 45.3 | 0.97 | High school | 5/10 | Bindery op; machine operation |
| 259 | Sign Maker (看板制作) | ¥442万 | 58K | 41.0 | 1.29 | High school | 5/10 | Sign maker; install + design |
| 260 | Civil Construction Manager (土木施工管理技術者) | ¥596万 | 53K | 46.0 | 16.30 | Bachelor's | 5/10 | Civil PM; interpersonal site work |
| 261 | Surveyor (測量士) | ¥502万 | 53K | 45.0 | 4.40 | Vocational | 5/10 | Surveying; drones and automation rising |
| 262 | Sewer Pipe Inspector (下水道管路施設の点検・調査) | ¥596万 | 53K | 46.0 | 13.08 | ? | 5/10 | Sewer inspector; field + AI |
| 263 | Diet Member (National Politician) (国会議員) | ? | 52K | ? | ? | ? | 5/10 | Diet member; politics + AI |
| 264 | Parking Lot Attendant (駐車場管理) | ¥418万 | 50K | 51.0 | 1.50 | High school | 5/10 | Parking attendant; unmanned systems rising |
| 265 | Public Health Nurse (保健師) | ¥521万 | 49K | 38.7 | 1.02 | Bachelor's | 5/10 | Public health nurse; visits + data |
| 266 | Building Construction Manager (建築施工管理技術者) | ¥642万 | 49K | 43.6 | 8.56 | Bachelor's | 5/10 | Construction PM; on-site judgment required |
| 267 | Plant Factory Designer/Installer (植物工場の設計、施工) | ¥642万 | 49K | 43.6 | 2.85 | ? | 5/10 | Plant factory design; field + plan |
| 268 | Child Welfare Counselor (児童相談所相談員) | ¥441万 | 44K | 45.4 | 1.24 | Bachelor's | 5/10 | Child welfare; in-person counseling |
| 269 | Welfare Office Caseworker (福祉事務所ケースワーカー) | ¥441万 | 44K | 45.4 | 1.24 | Bachelor's | 5/10 | Caseworker; home visits |
| 270 | Elderly Welfare Counselor (老人福祉施設生活相談員) | ¥441万 | 44K | 45.4 | 8.02 | Vocational | 5/10 | Elderly counselor; in-person + paper |
| 271 | Medical Social Worker (医療ソーシャルワーカー) | ¥441万 | 44K | 45.4 | 3.04 | Bachelor's | 5/10 | Medical SW; in-person counseling |
| 272 | Welfare Social Worker (福祉ソーシャルワーカー) | ¥441万 | 44K | 45.4 | 1.24 | Bachelor's | 5/10 | Welfare SW; in-person counseling |
| 273 | Home Care Service Manager (訪問介護のサービス提供責任者) | ¥430万 | 44K | 52.8 | 42.38 | High school | 5/10 | Home care mgr; ops + in-person |
| 274 | Pharmaceutical Manufacturer (医薬品製造) | ¥536万 | 44K | 41.7 | 4.07 | Bachelor's | 5/10 | Pharma mfg; quality + automation |
| 275 | Petroleum Refinery Operator (石油精製オペレーター) | ¥536万 | 44K | 41.7 | 4.07 | High school | 5/10 | Oil refinery op; instrumentation + judgment |
| 276 | Medical Counselor (カウンセラー（医療福祉分野）) | ¥430万 | 27K | 39.9 | 1.97 | Master's | 5/10 | Medical counselor; in-person |
| 277 | Nonferrous Metal Engineer (非鉄金属製錬技術者) | ¥577万 | 26K | 41.1 | 1.54 | High school | 5/10 | Nonferrous tech; AI control rising |
| 278 | Corrections Education Officer (法務教官) | ¥491万 | 24K | 45.6 | 1.45 | Bachelor's | 5/10 | Corrections officer; in-person guidance |
| 279 | Vocational School Teacher (専門学校教員) | ¥491万 | 24K | 45.6 | 1.45 | Bachelor's | 5/10 | Vocational school teacher; career ed |
| 280 | TV Cameraman (テレビカメラマン) | ¥453万 | 23K | 36.8 | 0.42 | Bachelor's | 5/10 | TV cameraman; field + interpersonal |
| 281 | Press/News Photographer (報道カメラマン) | ¥453万 | 23K | 36.8 | 0.42 | Bachelor's | 5/10 | News cameraman; field response |
| 282 | Car Rental Counter Clerk (レンタカー店舗スタッフ) | ¥396万 | 21K | 43.1 | 10.47 | Bachelor's | 5/10 | Car rental staff; automation rising |
| 283 | Welfare Equipment Specialist (福祉用具専門相談員) | ¥396万 | 21K | 43.1 | 6.07 | Bachelor's | 5/10 | Welfare equipment advisor; in-person |
| 284 | Train Conductor (鉄道車掌) | ¥562万 | 12K | 40.5 | 1.35 | High school | 5/10 | Conductor; unmanned trials underway |
| 285 | Industrial Waste Treatment Tech (産業廃棄物処理技術者) | ¥573万 | 11K | 43.0 | 11.88 | High school | 5/10 | Waste tech; AI monitoring |
| 286 | Working Environment Measurement Specialist (作業環境測定士) | ¥573万 | 11K | 43.0 | 11.88 | ? | 5/10 | Environment measurer; field inspect |
| 287 | Sign Language Interpreter (手話通訳者) | ¥591万 | 10K | 42.7 | 0.21 | Bachelor's | 5/10 | Sign interpreter; AI translation rising |
| 288 | School Counselor (スクールカウンセラー) | ¥591万 | 10K | 42.7 | 0.15 | Master's | 5/10 | School counselor; in-person |
| 289 | Corrections Psychology Specialist (法務技官（心理）（矯正心理専門職）) | ¥591万 | 10K | 42.7 | 0.43 | Master's | 5/10 | Corrections psych; in-person assess |
| 290 | Detective (Private Investigator) (探偵) | ¥591万 | 10K | 42.7 | 0.43 | ? | 5/10 | Detective; field + interpersonal |
| 291 | Air Traffic Controller (航空管制官) | ¥591万 | 9K | 42.7 | 0.52 | Bachelor's | 5/10 | Air traffic control; AI + judgment |
| 292 | Agricultural Engineer (農業技術者) | ¥573万 | 9K | 43.0 | 0.94 | High school | 5/10 | Agronomist; AI farming support |
| 293 | Fisheries Engineer (水産技術者) | ¥573万 | 9K | 43.0 | 0.94 | Bachelor's | 5/10 | Fisheries tech; AI monitoring |
| 294 | Livestock Engineer (畜産技術者) | ¥573万 | 9K | 43.0 | 0.94 | Bachelor's | 5/10 | Livestock tech; AI monitoring |
| 295 | Tour Conductor (ツアーコンダクター) | ¥396万 | 8K | 43.1 | 0.40 | Bachelor's | 5/10 | Tour conductor; in-person leading |
| 296 | Tour Interpreter Guide (Tsuyaku-Annai-shi) (通訳ガイド) | ¥396万 | 8K | 43.1 | 0.40 | Bachelor's | 5/10 | Tour interpreter; AI translation rivals |
| 297 | Bartender (バーテンダー) | ¥370万 | 7K | 45.2 | 0.56 | High school | 5/10 | Bartender; in-person service |
| 298 | Nurse (看護師) | ¥520万 | 693K | 41.2 | 2.41 | Vocational | 4/10 | Nurse; hands-on care + judgment |
| 299 | Quarantine Officer (Nurse) (検疫官（看護師）) | ¥520万 | 693K | 41.2 | 3.34 | Bachelor's | 4/10 | Quarantine officer; field + paper |
| 300 | Order Picker (ピッキング作業員) | ¥345万 | 383K | 48.4 | 0.89 | High school | 4/10 | Picker; automation + robot |
| 301 | Plant Factory Grower (植物工場の栽培管理) | ¥352万 | 291K | 42.5 | 1.13 | High school | 4/10 | Plant factory grower; automating |
| 302 | Rice Farmer (稲作農業者) | ¥352万 | 291K | 42.5 | 1.54 | High school | 4/10 | Rice farmer; AI farming rising |
| 303 | Greenhouse Vegetable Grower (ハウス野菜栽培者) | ¥352万 | 291K | 42.5 | 1.13 | High school | 4/10 | Greenhouse veg; automation |
| 304 | Product Packaging Worker (製品包装作業員) | ¥308万 | 274K | 46.6 | 2.78 | High school | 4/10 | Product packaging; auto + inspect |
| 305 | Middle School Teacher (中学校教員) | ¥726万 | 231K | 42.3 | 0.53 | Bachelor's | 4/10 | Middle school teacher; subject + guidance |
| 306 | Elementary School Teacher (小学校教員) | ¥726万 | 211K | 42.3 | 2.14 | Bachelor's | 4/10 | Elementary teacher; in-person + AI tools |
| 307 | Auto Mechanic (自動車整備士) | ¥513万 | 188K | 40.5 | 5.45 | Vocational | 4/10 | Auto mechanic; diagnostics + hand |
| 308 | Local Bus Driver (路線バス運転士) | ¥461万 | 161K | 55.0 | 7.66 | High school | 4/10 | Bus driver; autonomy approaching |
| 309 | Taxi Driver (タクシー運転手) | ¥415万 | 161K | 60.2 | 9.11 | High school | 4/10 | Taxi; autonomous research advancing |
| 310 | Truck Driver (トラックドライバー) | ¥492万 | 161K | 50.9 | 3.20 | High school | 4/10 | Truck driver; autonomy approaching |
| 311 | Trailer Truck Driver (トレーラートラックドライバー) | ¥492万 | 161K | 50.9 | 3.34 | High school | 4/10 | Trailer driver; autonomy research |
| 312 | Building Facility Manager (ビル施設管理) | ¥458万 | 158K | 46.5 | 1.08 | High school | 4/10 | Building manager; rounds + IoT monitor |
| 313 | Tire Manufacturer (タイヤ製造) | ¥439万 | 149K | 42.8 | 5.13 | Bachelor's | 4/10 | Tire mfg; automation |
| 314 | Department Store Clerk (デパート店員) | ¥369万 | 143K | 42.7 | 1.42 | Bachelor's | 4/10 | Department store clerk; face-to-face |
| 315 | Supermarket Clerk (スーパー店員) | ¥369万 | 143K | 42.7 | 6.15 | High school | 4/10 | Store clerk; stocking + customer service |
| 316 | Florist Shop Clerk (フラワーショップ店員) | ¥369万 | 143K | 42.7 | 5.82 | Bachelor's | 4/10 | Florist clerk; sensory in-person work |
| 317 | Eyewear Sales (メガネ販売) | ¥369万 | 143K | 42.7 | 5.82 | Bachelor's | 4/10 | Eyewear sales; fitting required |
| 318 | Sporting Goods Sales (スポーツ用品販売) | ¥369万 | 143K | 42.7 | 5.82 | Bachelor's | 4/10 | Sports goods sales; in-person advice |
| 319 | Hardware/Home Center Clerk (ホームセンター店員) | ¥369万 | 143K | 42.7 | 9.25 | Bachelor's | 4/10 | Hardware store clerk; product guidance |
| 320 | Pet Shop Clerk (ペットショップ店員) | ¥369万 | 143K | 42.7 | 5.82 | Vocational | 4/10 | Pet shop; animal care + service |
| 321 | Apparel Sales (衣料品販売) | ¥369万 | 143K | 42.7 | 2.67 | Bachelor's | 4/10 | Apparel sales; styling advice |
| 322 | Bakery Shop Clerk (ベーカリーショップ店員) | ¥369万 | 143K | 42.7 | 7.40 | High school | 4/10 | Bakery shop clerk; service + display |
| 323 | Cafe Clerk (カフェ店員) | ¥369万 | 143K | 42.7 | 7.40 | High school | 4/10 | Cafe clerk; service + drinks |
| 324 | Recycle Shop Clerk (リサイクルショップ店員) | ¥369万 | 143K | 42.7 | 5.82 | High school | 4/10 | Resale shop; appraisal + service |
| 325 | Cosmetics Sales / Beauty Advisor (化粧品販売/美容部員) | ¥369万 | 143K | 42.7 | 0.96 | High school | 4/10 | Beauty advisor; in-person counsel |
| 326 | Bicycle Sales (自転車販売) | ¥369万 | 143K | 42.7 | 5.82 | High school | 4/10 | Bicycle sales; in-person + assembly |
| 327 | Route Delivery Driver (ルート配送ドライバー) | ¥394万 | 139K | 46.9 | 1.70 | High school | 4/10 | Delivery driver; AI routing |
| 328 | Parcel Delivery Driver (宅配便配達員) | ¥394万 | 139K | 46.9 | 1.30 | High school | 4/10 | Parcel delivery; AI + robot research |
| 329 | Industrial Robot Maintenance Tech (産業用ロボットの保守・メンテナンス) | ¥586万 | 134K | 43.4 | 6.00 | High school | 4/10 | Robot maintenance; manual inspect |
| 330 | Logistics Equipment Maintenance (物流設備管理・保全) | ¥586万 | 134K | 43.4 | 6.00 | High school | 4/10 | Logistics maintenance; manual |
| 331 | Textile Equipment Maintenance (紡織設備管理・保全) | ¥586万 | 134K | 43.4 | 6.00 | ? | 4/10 | Textile machine maint; manual |
| 332 | Dental Hygienist (歯科衛生士) | ¥406万 | 129K | 35.9 | 3.08 | Vocational | 4/10 | Dental hygienist; hands-on oral care |
| 333 | Cabin Crew / Flight Attendant (客室乗務員) | ¥596万 | 127K | 33.6 | 0.25 | Bachelor's | 4/10 | Cabin crew; in-person service |
| 334 | Restaurant Server (Floor Staff) (ホールスタッフ（レストラン）) | ¥358万 | 127K | 39.9 | 2.91 | High school | 4/10 | Restaurant server; in-person service |
| 335 | Chain Restaurant Staff (飲食チェーン店店員) | ¥358万 | 127K | 39.9 | 2.91 | High school | 4/10 | Chain restaurant; service + floor |
| 336 | Police Officer (警察官（都道府県警察）) | ? | 126K | ? | 7.06 | Bachelor's | 4/10 | Police; field response + AI investigation |
| 337 | Semiconductor Manufacturing Worker (半導体製造) | ¥429万 | 121K | 43.5 | 0.89 | Bachelor's | 4/10 | Semicon manufacturing; automating |
| 338 | Industrial Robot Installer (産業用ロボットの設置・設定) | ¥491万 | 111K | 40.0 | 1.46 | Bachelor's | 4/10 | Robot installer; on-site work |
| 339 | Cleaner (Dry-Cleaning) (クリーニング師) | ¥297万 | 105K | 48.6 | 3.13 | High school | 4/10 | Cleaner; machine + judgment |
| 340 | Dentist (歯科医師) | ¥1,136万 | 98K | 36.2 | 3.31 | Bachelor's | 4/10 | Dentist; manual + AI diagnosis |
| 341 | Dairy Product Manufacturer (乳製品製造) | ¥366万 | 94K | 43.5 | 4.44 | Bachelor's | 4/10 | Dairy factories increasingly automated |
| 342 | Surimi Product Manufacturer (水産ねり製品製造) | ¥366万 | 94K | 43.5 | 3.80 | High school | 4/10 | Surimi factories partially automated |
| 343 | Auto Inspector (自動車検査員) | ¥562万 | 87K | 43.3 | 1.05 | ? | 4/10 | Auto inspector; check + paperwork |
| 344 | Dental Aide (歯科助手) | ¥323万 | 84K | 34.9 | 2.76 | Vocational | 4/10 | Dental aide; in-person hand |
| 345 | Special-Needs Education Teacher (特別支援学校教員、特別支援学級教員) | ¥491万 | 78K | 45.6 | 0.96 | Bachelor's | 4/10 | Special ed teacher; interpersonal |
| 346 | Air Self-Defense Force Officer (航空自衛官) | ? | 77K | ? | 12.30 | High school | 4/10 | Air SDF; equipment + training |
| 347 | Loom Operator (織布工/織機オペレーター) | ¥305万 | 69K | 45.4 | 3.60 | High school | 4/10 | Loom operator; automation |
| 348 | Dye Operator (染色工/染色設備オペレーター) | ¥305万 | 69K | 45.4 | 3.60 | High school | 4/10 | Dye operator; automation |
| 349 | Spinning Machine Operator (紡績機械オペレーター) | ¥305万 | 69K | 45.4 | 2.26 | High school | 4/10 | Spinning machine op; automation |
| 350 | Aircraft Mechanic (航空整備士) | ¥558万 | 59K | 42.3 | 4.95 | Vocational | 4/10 | Aircraft mechanic; inspection + hand |
| 351 | Plywood Manufacturer (合板製造) | ¥409万 | 55K | 44.3 | 2.41 | ? | 4/10 | Plywood mfg; automation |
| 352 | Paper Container Manufacturer (紙器製造) | ¥409万 | 55K | 44.3 | 5.00 | High school | 4/10 | Paper container mfg; automation |
| 353 | Solar Power Designer/Installer (太陽光発電の設計・施工) | ¥596万 | 53K | 46.0 | 9.95 | Bachelor's | 4/10 | Solar designer; field + design |
| 354 | Food Inspector (検査工（食料品等）) | ¥426万 | 48K | 43.6 | 3.44 | High school | 4/10 | Food inspector; AI + quality |
| 355 | Cosmetics Manufacturer (化粧品製造) | ¥536万 | 44K | 41.7 | 3.89 | Bachelor's | 4/10 | Cosmetics mfg; automation + quality |
| 356 | Chemical Plant Operator (化学製品製造オペレーター) | ¥536万 | 44K | 41.7 | 4.07 | High school | 4/10 | Chemical mfg op; instrumentation |
| 357 | Pediatrician (小児科医) | ¥1,338万 | 43K | 44.1 | 0.58 | Bachelor's | 4/10 | Pediatrician; exam + AI diagnostic |
| 358 | Internal Medicine Physician (内科医) | ¥1,338万 | 43K | 44.1 | 0.58 | Bachelor's | 4/10 | Internist; exam + AI diagnostic |
| 359 | Psychiatrist (精神科医) | ¥1,338万 | 43K | 44.1 | 0.58 | Bachelor's | 4/10 | Psychiatrist; in-person counseling |
| 360 | Obstetrician/Gynecologist (産婦人科医) | ¥1,338万 | 43K | 44.1 | 0.58 | Bachelor's | 4/10 | Ob/Gyn; manual + exam |
| 361 | Industrial Product Inspector (検査工（工業製品）) | ¥427万 | 43K | 42.4 | 4.03 | High school | 4/10 | Industrial inspector; AI inspection |
| 362 | Steel Mill Operator (鉄鋼製造オペレーター) | ¥529万 | 39K | 41.1 | 1.96 | High school | 4/10 | Steel op; automation |
| 363 | Clinical Engineer (臨床工学技士) | ¥430万 | 27K | 39.9 | 1.83 | Vocational | 4/10 | Clinical eng; equipment + patient |
| 364 | Veterinarian (獣医師) | ¥885万 | 25K | 46.7 | 2.75 | Master's | 4/10 | Vet; manual + AI diagnostics |
| 365 | Funeral Director (葬祭ディレクター) | ¥396万 | 25K | 43.1 | 6.46 | High school | 4/10 | Funeral director; in-person |
| 366 | Vocational Training Instructor (職業訓練指導員) | ¥491万 | 24K | 45.6 | 1.45 | Bachelor's | 4/10 | Vocational instructor; hands-on training |
| 367 | Cosmetics Door-to-Door Sales (化粧品訪問販売) | ¥473万 | 23K | 42.3 | 6.51 | High school | 4/10 | Cosmetics sales; in-person |
| 368 | Aquaculture Worker (水産養殖従事者) | ¥352万 | 17K | 42.5 | 2.02 | ? | 4/10 | Aquaculture; automation + judge |
| 369 | Immigration Enforcement Officer (入国警備官) | ¥329万 | 17K | 53.0 | 5.14 | Bachelor's | 4/10 | Immigration enforcement; field-focused |
| 370 | Stage Set Designer (舞台美術スタッフ) | ¥589万 | 16K | 40.0 | 0.38 | Vocational | 4/10 | Stage art; on-site hand work |
| 371 | Stage Lighting Designer (舞台照明スタッフ) | ¥589万 | 16K | 40.0 | 0.38 | Vocational | 4/10 | Stage lighting; on-site equipment |
| 372 | Beer Brewer (ビール製造) | ¥366万 | 15K | 43.5 | 4.07 | High school | 4/10 | Industrial brewing highly automated |
| 373 | Navigator (航海士) | ¥467万 | 14K | 48.0 | 1.23 | High school | 4/10 | Navigator; autopilot + judgment |
| 374 | Floral Designer (フラワーデザイナー) | ¥484万 | 14K | 38.5 | 0.42 | High school | 4/10 | Floral designer; in-person hand |
| 375 | Orthoptist (視能訓練士) | ¥444万 | 13K | 35.5 | 2.97 | Vocational | 4/10 | Orthoptist; testing + training |
| 376 | Sightseeing Bus Guide (観光バスガイド) | ¥562万 | 12K | 40.5 | 1.35 | High school | 4/10 | Bus guide; in-person tour |
| 377 | Forestry Engineer (林業技術者) | ¥573万 | 9K | 43.0 | 0.94 | High school | 4/10 | Forestry tech; drone/AI monitoring |
| 378 | Boiler Operator (ボイラーオペレーター) | ¥458万 | 8K | 46.5 | 1.21 | High school | 4/10 | Boiler op; instruments + inspection |
| 379 | Narcotics Control Officer (麻薬取締官) | ? | 7K | ? | ? | Bachelor's | 4/10 | Narcotics agent; field + analysis |
| 380 | Pilot (パイロット) | ¥1,697万 | 7K | 40.4 | ? | Bachelor's | 4/10 | Pilot; autopilot + judgment |
| 381 | Marine Engineer (船舶機関士) | ¥467万 | 6K | 48.0 | ? | Vocational | 4/10 | Marine engineer; monitoring |
| 382 | Nursery Teacher (Hoikushi) (保育士) | ¥407万 | 634K | 39.5 | 3.16 | Junior college | 3/10 | Nursery teacher; childcare + interpersonal |
| 383 | Die Maker (金型工) | ¥472万 | 457K | 43.6 | 4.39 | High school | 3/10 | Die maker; precision hand craft |
| 384 | Backyard Staff (Supermarket Food) (バックヤード作業員（スーパー食品部門）) | ¥345万 | 383K | 48.4 | 0.31 | High school | 3/10 | Backyard staff; stocking + freshness |
| 385 | Facility Security Guard (施設警備員) | ¥354万 | 375K | 52.9 | 4.03 | High school | 3/10 | Security guard; on-site |
| 386 | Auto Assembly Line Worker (自動車組立) | ¥563万 | 345K | 39.9 | 0.66 | High school | 3/10 | Auto assembly; line work |
| 387 | Fruit Grower (果樹栽培者) | ¥352万 | 291K | 42.5 | 1.13 | High school | 3/10 | Fruit grower; hand work primary |
| 388 | Flower Grower (花き栽培者) | ¥352万 | 291K | 42.5 | 1.13 | High school | 3/10 | Flower grower; hand work |
| 389 | Packing Worker (こん包作業員) | ¥394万 | 285K | 46.9 | 1.30 | High school | 3/10 | Packing worker; manual |
| 390 | Warehouse Worker (倉庫作業員) | ¥394万 | 274K | 46.9 | 0.83 | High school | 3/10 | Warehouse worker; robots rising |
| 391 | Western Cuisine Chef (西洋料理調理人（コック）) | ¥370万 | 228K | 45.2 | 3.19 | Vocational | 3/10 | Western chef; hand work primary |
| 392 | Japanese Cuisine Chef (Itamae) (日本料理調理人（板前）) | ¥370万 | 228K | 45.2 | 4.71 | High school | 3/10 | Japanese chef; traditional craft |
| 393 | Sushi Chef (すし職人) | ¥370万 | 228K | 45.2 | 4.71 | High school | 3/10 | Sushi chef; epitome of hand craft |
| 394 | Soba/Udon Chef (そば・うどん調理人) | ¥370万 | 228K | 45.2 | 4.71 | High school | 3/10 | Soba chef; hand work craft |
| 395 | Chinese Cuisine Chef (中華料理調理人) | ¥370万 | 228K | 45.2 | 8.04 | High school | 3/10 | Chinese chef; hand work primary |
| 396 | Ramen Chef (ラーメン調理人) | ¥370万 | 228K | 45.2 | 8.04 | High school | 3/10 | Ramen chef; hand work |
| 397 | Cooking Aide (調理補助) | ¥370万 | 228K | 45.2 | 1.35 | High school | 3/10 | Cooking aide; manual |
| 398 | School Cafeteria Cook (給食調理員) | ¥370万 | 228K | 45.2 | 3.40 | High school | 3/10 | School cook; hand work |
| 399 | School Nurse (Yogo Kyoyu) (養護教諭) | ¥726万 | 211K | 42.3 | 2.14 | ? | 3/10 | School nurse; in-person care |
| 400 | Theme Park Staff (遊園地スタッフ) | ¥373万 | 204K | 39.8 | 4.28 | High school | 3/10 | Theme park staff; on-site service |
| 401 | Caddie (キャディ) | ¥373万 | 204K | 39.8 | 4.28 | High school | 3/10 | Caddie; on-course in-person service |
| 402 | Auto Body Repair/Painter (自動車板金塗装) | ¥513万 | 188K | 40.5 | 5.60 | High school | 3/10 | Auto body; hand craft |
| 403 | Makeup Artist (メイクアップアーティスト) | ¥372万 | 176K | 32.8 | 5.73 | Vocational | 3/10 | Makeup artist; hand craft |
| 404 | Sightseeing Bus Driver (観光バス運転士) | ¥461万 | 161K | 55.0 | 7.66 | High school | 3/10 | Tour bus driver; commentary + driving |
| 405 | Dump Truck Driver (ダンプカー運転手) | ¥492万 | 161K | 50.9 | 3.92 | High school | 3/10 | Dump truck; on-site hauling |
| 406 | Shuttle Bus Driver (送迎バス等運転手) | ¥461万 | 161K | 55.0 | 0.93 | High school | 3/10 | Shuttle driver; on-site service |
| 407 | Care Taxi Driver (介護タクシー運転手) | ¥415万 | 161K | 60.2 | 1.14 | High school | 3/10 | Care taxi; in-person transport |
| 408 | Tanker Truck Driver (タンクローリー乗務員) | ¥492万 | 161K | 50.9 | 6.53 | High school | 3/10 | Tanker driver; physical transport |
| 409 | Apartment (Mansion) Manager (マンション管理員) | ¥418万 | 147K | 51.0 | 0.85 | Bachelor's | 3/10 | Mansion mgmt; on-site |
| 410 | Kindergarten Teacher (幼稚園教員) | ¥413万 | 143K | 38.5 | 2.77 | Junior college | 3/10 | Kindergarten teacher; childcare + interpersonal |
| 411 | Newspaper Delivery (新聞配達員) | ¥394万 | 139K | 46.9 | 1.78 | High school | 3/10 | Newspaper delivery; on-site |
| 412 | Food Delivery Driver (フードデリバリー（料理配達員）) | ¥394万 | 139K | 46.9 | 1.30 | High school | 3/10 | Food delivery; on-site |
| 413 | Nursing Aide (看護助手) | ¥329万 | 138K | 48.6 | 4.12 | High school | 3/10 | Nurse aide; hands-on assistance |
| 414 | Coast Guard Officer (海上保安官) | ? | 126K | ? | 7.06 | High school | 3/10 | Coast guard; field response |
| 415 | Landscape Gardener (造園工) | ¥352万 | 123K | 42.5 | 1.92 | High school | 3/10 | Landscaper; on-site hand work |
| 416 | Electronic Equipment Assembler (電子機器組立) | ¥429万 | 121K | 43.5 | 2.62 | High school | 3/10 | Electronics assembly; manual |
| 417 | Medical Imaging Equipment Assembler (医療用画像機器組立) | ¥429万 | 121K | 43.5 | 2.39 | High school | 3/10 | Medical device assembly; precision |
| 418 | Switchgear/Control Panel Assembler (配電盤・制御盤等組立) | ¥429万 | 121K | 43.5 | 2.48 | High school | 3/10 | Switchgear assembly; precision hand |
| 419 | Production Machine Assembler (生産用機械組立) | ¥491万 | 111K | 40.0 | 1.46 | High school | 3/10 | Production machine assembly; manual |
| 420 | Physical Therapist (理学療法士（PT）) | ¥444万 | 101K | 35.5 | 4.53 | Bachelor's | 3/10 | PT; hands-on + in-person |
| 421 | Occupational Therapist (作業療法士（OT）) | ¥444万 | 101K | 35.5 | 4.26 | Bachelor's | 3/10 | OT; in-person rehab |
| 422 | Auctioneer (Seriin) (せり人) | ¥662万 | 97K | 40.7 | 2.79 | Bachelor's | 3/10 | Auctioneer; live in-person skill |
| 423 | Prepared Food Manufacturer (惣菜製造) | ¥366万 | 94K | 43.5 | 2.40 | High school | 3/10 | Prepared food has manual cooking steps |
| 424 | Soy Sauce Brewer (しょうゆ製造) | ¥366万 | 94K | 43.5 | 4.44 | Bachelor's | 3/10 | Soy sauce brewing; partial automation |
| 425 | Ham, Sausage, and Bacon Manufacturer (ハム・ソーセージ・ベーコン製造) | ¥366万 | 94K | 43.5 | 3.75 | High school | 3/10 | Sausage factory; manual quality control |
| 426 | Pickle (Tsukemono) Manufacturer (野菜つけ物製造) | ¥366万 | 94K | 43.5 | 4.44 | High school | 3/10 | Pickle making; manual fermentation |
| 427 | Veterinary Nurse (動物看護) | ¥323万 | 84K | 34.9 | 1.77 | Vocational | 3/10 | Vet nurse; hands-on |
| 428 | Ground Self-Defense Force Officer (陸上自衛官) | ? | 77K | ? | 12.30 | High school | 3/10 | Ground SDF; field operations |
| 429 | Maritime Self-Defense Force Officer (海上自衛官) | ? | 77K | ? | 12.30 | High school | 3/10 | Maritime SDF; shipboard duty |
| 430 | General Machinist (Lathe, Drill Press) (汎用金属工作機械工（旋盤工、ボール盤工等）) | ¥466万 | 76K | 42.5 | 2.69 | High school | 3/10 | General machinist; hand work |
| 431 | Firefighter (消防官) | ¥329万 | 74K | 53.0 | 2.55 | Bachelor's | 3/10 | Firefighter; field rescue |
| 432 | Emergency Medical Technician (EMT) (救急救命士) | ¥329万 | 74K | 53.0 | 2.55 | Bachelor's | 3/10 | EMT; field emergency response |
| 433 | Shoemaker (靴製造) | ¥412万 | 72K | 42.9 | 1.34 | High school | 3/10 | Shoemaker; hand work |
| 434 | Bag and Pouch Maker (かばん・袋物製造) | ¥412万 | 72K | 42.9 | 1.34 | High school | 3/10 | Bag maker; hand craft |
| 435 | Jewelry Craftsman (貴金属装身具製作) | ¥412万 | 72K | 42.9 | 1.34 | High school | 3/10 | Jewelry making; precision craft |
| 436 | Toy Maker (玩具（おもちゃ）製作) | ¥412万 | 72K | 42.9 | 3.34 | ? | 3/10 | Toy maker; hand craft |
| 437 | Music School Instructor (音楽教室講師) | ¥438万 | 70K | 38.5 | 1.56 | Bachelor's | 3/10 | Music teacher; in-person lessons |
| 438 | Sewing Machine Operator (ミシン縫製) | ¥305万 | 69K | 45.4 | 2.26 | High school | 3/10 | Sewing; manual stitching |
| 439 | After-School Care Staff (学童保育指導員) | ¥396万 | 65K | 43.1 | 2.60 | Bachelor's | 3/10 | After-school staff; childcare |
| 440 | Aromatherapist (アロマセラピスト) | ¥396万 | 65K | 43.1 | 1.77 | High school | 3/10 | Aromatherapist; in-person hands-on |
| 441 | Reflexologist (リフレクソロジスト) | ¥396万 | 65K | 43.1 | 1.77 | High school | 3/10 | Reflexologist; manual technique |
| 442 | Childcare Aide (保育補助者) | ¥396万 | 65K | 43.1 | 0.86 | Bachelor's | 3/10 | Childcare aide; hands-on |
| 443 | Disability Group Home Caretaker (障害者グループホーム世話人) | ¥396万 | 65K | 43.1 | 1.77 | High school | 3/10 | Group home staff; in-person care |
| 444 | Metal Press Worker (金属プレス工) | ¥417万 | 61K | 42.0 | 3.40 | High school | 3/10 | Metal press; machine op |
| 445 | Sports Instructor (スポーツインストラクター) | ¥438万 | 60K | 38.5 | 1.17 | Bachelor's | 3/10 | Sports instructor; in-person coaching |
| 446 | Outdoor Activity Instructor (アウトドアインストラクター) | ¥438万 | 60K | 38.5 | 1.17 | Bachelor's | 3/10 | Outdoor instructor; field in-person |
| 447 | Lumber Processor (木材製造) | ¥409万 | 55K | 44.3 | 2.41 | High school | 3/10 | Lumber processing; machine + judgment |
| 448 | Furniture Maker (家具製造) | ¥409万 | 55K | 44.3 | 2.41 | High school | 3/10 | Furniture mfg; hand work |
| 449 | Joinery (Tategu) Maker (建具製造) | ¥409万 | 55K | 44.3 | 2.41 | High school | 3/10 | Joinery; hand craft |
| 450 | Forklift Operator (フォークリフト運転作業員) | ¥467万 | 50K | 48.0 | 0.80 | High school | 3/10 | Forklift op; autonomy research |
| 451 | Crane Operator (クレーン運転士) | ¥527万 | 48K | 46.6 | 4.15 | High school | 3/10 | Crane operator; on-site |
| 452 | Glassware Maker (ガラス食器製造) | ¥461万 | 47K | 44.5 | 4.92 | High school | 3/10 | Glassware mixes hand craft and machine |
| 453 | Train Cleaner (鉄道車両清掃) | ¥400万 | 45K | 49.2 | 4.23 | High school | 3/10 | Train cleaning; partial automation |
| 454 | Pest Control Worker (ペストコントロール従事者（害虫等防除・駆除従事者）) | ¥400万 | 45K | 49.2 | 2.27 | High school | 3/10 | Pest control; on-site |
| 455 | Child Care Counselor (児童指導員) | ¥441万 | 44K | 45.4 | 4.88 | Bachelor's | 3/10 | Child counselor; in-person |
| 456 | Disability Support Worker (障害者福祉施設指導専門員（生活支援員、就労支援員等）) | ¥441万 | 44K | 45.4 | 2.71 | Bachelor's | 3/10 | Disability staff; in-person support |
| 457 | Construction Equipment Operator (建設機械オペレーター) | ¥465万 | 43K | 49.9 | 3.36 | High school | 3/10 | Construction equipment; autonomy approaching |
| 458 | Surgeon (外科医) | ¥1,338万 | 43K | 44.1 | 0.58 | Bachelor's | 3/10 | Surgeon; manual surgical technique |
| 459 | Anesthesiologist (麻酔科医) | ¥1,338万 | 43K | 44.1 | 0.58 | ? | 3/10 | Anesthesiologist; manual + monitor |
| 460 | Orthopedic Surgeon (整形外科医) | ¥1,338万 | 43K | 44.1 | 0.58 | ? | 3/10 | Orthopedic surgeon; manual + tech |
| 461 | Kimono Dressing Instructor (きもの着付指導員) | ¥330万 | 40K | 40.7 | 1.58 | Junior college | 3/10 | Kimono dressing; in-person craft |
| 462 | Dental Technician (歯科技工士) | ¥454万 | 39K | 40.9 | 1.25 | Vocational | 3/10 | Dental tech; hand work primary |
| 463 | Dairy Farmer (酪農従事者) | ¥352万 | 39K | 42.5 | 3.75 | High school | 3/10 | Dairy farmer; manual animal care |
| 464 | Plating Worker (めっき工) | ¥462万 | 37K | 43.1 | 6.77 | High school | 3/10 | Plating op; machine + quality |
| 465 | Train Driver (電車運転士) | ¥668万 | 37K | 42.3 | 1.30 | High school | 3/10 | Train operator; ATO/ATC assist |
| 466 | Solar Power Maintenance Tech (太陽光発電のメンテナンス) | ¥586万 | 31K | 43.4 | 2.63 | Bachelor's | 3/10 | Solar maintenance; on-site |
| 467 | Home Appliance Repair Tech (家電修理) | ¥586万 | 31K | 43.4 | 2.63 | Bachelor's | 3/10 | Appliance repair; diagnose + hand |
| 468 | Wind Power Maintenance Tech (風力発電のメンテナンス) | ¥586万 | 31K | 43.4 | 2.63 | ? | 3/10 | Wind maintenance; high-altitude field |
| 469 | Midwife (助産師) | ¥581万 | 28K | 38.7 | 1.30 | Bachelor's | 3/10 | Midwife; birth attendance |
| 470 | Prosthetist & Orthotist (義肢装具士) | ¥430万 | 27K | 39.9 | 1.97 | Vocational | 3/10 | Prosthetist; hand craft fabrication |
| 471 | Orchestra Musician (オーケストラ奏者（団員）) | ¥589万 | 26K | 40.0 | 0.21 | ? | 3/10 | Orchestra musician; live performance |
| 472 | Railway Track Maintenance Worker (鉄道線路管理) | ¥415万 | 25K | 46.0 | 21.67 | High school | 3/10 | Rail track maintenance; inspection automating |
| 473 | Mortician (Nokanshi) (納棺師) | ¥396万 | 25K | 43.1 | 6.46 | ? | 3/10 | Mortuary attendant; in-person hand |
| 474 | Driving School Instructor (自動車教習指導員) | ¥491万 | 24K | 45.6 | 1.45 | High school | 3/10 | Driving instructor; in-vehicle coach |
| 475 | PC Kitting Worker (キッティング作業員（PCセットアップ作業員）) | ¥356万 | 23K | 41.0 | 0.94 | High school | 3/10 | PC kitting; manual setup |
| 476 | Optical Equipment Assembler (光学機器組立) | ¥446万 | 22K | 42.5 | 3.79 | High school | 3/10 | Optics assembly; precision manual |
| 477 | Instrument Assembler (計器組立) | ¥446万 | 22K | 42.5 | 3.79 | High school | 3/10 | Instrument assembly; precision |
| 478 | Foundry Worker / Casting Operator (鋳造工/鋳造設備オペレーター) | ¥489万 | 18K | 41.5 | 5.56 | High school | 3/10 | Foundry op; machine + judgment |
| 479 | Forging Worker / Forge Operator (鍛造工/鍛造設備オペレーター) | ¥489万 | 18K | 41.5 | 5.56 | High school | 3/10 | Forging op; machine + judgment |
| 480 | Road Patrol Worker (道路パトロール隊員) | ¥329万 | 17K | 53.0 | 5.14 | High school | 3/10 | Road patrol; field response |
| 481 | Park Ranger (Nature Conservation Officer) (自然保護官（レンジャー）) | ¥329万 | 17K | 53.0 | 5.14 | ? | 3/10 | Park ranger; field conservation |
| 482 | Ship Crew Member (船員) | ¥467万 | 14K | 48.0 | 1.05 | High school | 3/10 | Crew; on-board duty |
| 483 | Port Stevedore (港湾荷役作業員) | ¥592万 | 14K | 42.7 | 5.51 | High school | 3/10 | Port stevedore; equipment + judgment |
| 484 | Babysitter (ベビーシッター) | ¥396万 | 14K | 43.1 | 1.75 | Junior college | 3/10 | Babysitter; childcare hands-on |
| 485 | Speech-Language Therapist (言語聴覚士) | ¥444万 | 13K | 35.5 | 4.26 | Bachelor's | 3/10 | Speech therapist; in-person training |
| 486 | Animal Trainer (Choukyoshi) (調教師) | ¥591万 | 10K | 42.7 | 0.43 | High school | 3/10 | Trainer; hands-on animal training |
| 487 | Perfumer (調香師) | ¥591万 | 10K | 42.7 | 0.43 | Bachelor's | 3/10 | Perfumer; olfactory craft |
| 488 | Prison Officer (刑務官) | ? | 7K | ? | 1.58 | Bachelor's | 3/10 | Prison officer; in-person security |
| 489 | Facility Care Worker (施設介護員) | ¥376万 | 1.4M | 45.2 | 3.09 | High school | 2/10 | Facility care; hands-on assistance |
| 490 | Building Cleaner (ビル清掃) | ¥286万 | 911K | 52.8 | 1.25 | High school | 2/10 | Building cleaning; manual work |
| 491 | Factory Laborer (工場労務作業員) | ¥345万 | 383K | 48.4 | 0.39 | High school | 2/10 | Factory laborer; physical |
| 492 | Electrician (電気工事士) | ¥548万 | 380K | 43.4 | 3.80 | High school | 2/10 | Electrician; on-site judgment + manual |
| 493 | Carpenter (大工) | ¥449万 | 298K | 40.6 | 2.47 | High school | 2/10 | Carpentry; hand work and site judgment |
| 494 | Home Care Worker / Helper (訪問介護員/ホームヘルパー) | ¥381万 | 276K | 49.1 | 28.85 | High school | 2/10 | Home care; hands-on physical assistance |
| 495 | Construction/Civil Laborer (建設・土木作業員) | ¥415万 | 228K | 46.0 | 9.48 | High school | 2/10 | Outdoor site labor; physical |
| 496 | Pavement Worker (舗装工) | ¥415万 | 228K | 46.0 | 13.47 | ? | 2/10 | Paving; outdoor physical labor |
| 497 | Plumber (配管工) | ¥486万 | 221K | 45.6 | 10.83 | High school | 2/10 | Plumbing; on-site hand work |
| 498 | Hair Stylist (美容師) | ¥372万 | 176K | 32.8 | 5.73 | Vocational | 2/10 | Hair stylist; sensory hand work |
| 499 | Welder (溶接工) | ¥452万 | 164K | 42.1 | 2.67 | High school | 2/10 | Welder; on-site hand work |
| 500 | Barber (理容師) | ¥372万 | 141K | 32.8 | 16.24 | Vocational | 2/10 | Barber; pure hand craft |
| 501 | Window Frame Installer (サッシ取付) | ¥453万 | 130K | 42.4 | 4.03 | High school | 2/10 | Window frame install; on-site work |
| 502 | Interior Finisher (内装工) | ¥453万 | 130K | 42.4 | 4.03 | High school | 2/10 | Interior finishing; hand work |
| 503 | Waterproofing Worker (防水工) | ¥453万 | 130K | 42.4 | 13.27 | High school | 2/10 | Waterproofing; on-site physical |
| 504 | Insulation Worker (保温工事) | ¥453万 | 130K | 42.4 | 8.19 | High school | 2/10 | Insulation work; on-site labor |
| 505 | Hotel Room Cleaner (客室清掃・整備担当（ホテル・旅館）) | ¥338万 | 127K | 39.0 | 1.40 | High school | 2/10 | Room cleaning; manual labor |
| 506 | Mover (引越作業員) | ¥394万 | 123K | 46.9 | 5.19 | High school | 2/10 | Movers; physical labor |
| 507 | Loading/Unloading Worker (積卸作業員) | ¥394万 | 123K | 46.9 | 5.19 | High school | 2/10 | Loading/unloading; physical |
| 508 | Elevator Installer (エレベーター据付) | ¥491万 | 111K | 40.0 | 1.46 | High school | 2/10 | Elevator install; on-site |
| 509 | Tofu Maker / Tofu Craftsman (豆腐製造、豆腐職人) | ¥366万 | 94K | 43.5 | 4.44 | High school | 2/10 | Hand-crafted tofu making; manual food trade |
| 510 | Bread Maker / Baker (パン製造、パン職人) | ¥366万 | 94K | 43.5 | 1.55 | High school | 2/10 | Hand baking; sensory judgment central |
| 511 | Western Confectioner / Pastry Chef (洋菓子製造、パティシエ) | ¥366万 | 94K | 43.5 | 1.55 | High school | 2/10 | Hand pastry craft; sensory and artistic skill |
| 512 | Japanese Confectioner (Wagashi Maker) (和菓子製造、和菓子職人) | ¥366万 | 94K | 43.5 | 1.55 | High school | 2/10 | Traditional Japanese confection craft |
| 513 | Miso Maker (みそ製造) | ¥366万 | 94K | 43.5 | 4.44 | High school | 2/10 | Traditional miso fermentation craft |
| 514 | Architectural Sheet Metal Worker (建築板金) | ¥404万 | 73K | 42.9 | 7.93 | High school | 2/10 | Architectural sheet metal; on-site craft |
| 515 | Lacquerware (Shikki) Maker (漆器製造) | ¥412万 | 72K | 42.9 | 1.34 | ? | 2/10 | Lacquerware; traditional hand craft |
| 516 | Coastal Fisher (沿岸漁業従事者) | ¥352万 | 66K | 42.5 | 1.43 | High school | 2/10 | Coastal fishing; field labor |
| 517 | Pet Groomer (Trimmer) (トリマー) | ¥396万 | 65K | 43.1 | 0.75 | Vocational | 2/10 | Pet groomer; hands-on craft |
| 518 | Garbage Collector (ごみ収集作業員) | ¥400万 | 60K | 49.2 | 3.99 | High school | 2/10 | Garbage collector; physical |
| 519 | Industrial Waste Transporter (産業廃棄物収集運搬作業員) | ¥400万 | 60K | 49.2 | 4.76 | High school | 2/10 | Waste transport; on-site |
| 520 | Plasterer (Sakan) (左官) | ¥453万 | 60K | 42.4 | 7.03 | High school | 2/10 | Plastering; traditional hand skill |
| 521 | Building Painter (建築塗装工) | ¥442万 | 58K | 41.0 | 5.43 | High school | 2/10 | Building painting; manual on-site |
| 522 | Scaffolder (Tobi) (とび) | ¥506万 | 56K | 43.0 | 22.08 | High school | 2/10 | Scaffolding; high-risk physical labor |
| 523 | Demolition Worker (解体工) | ¥506万 | 56K | 43.0 | 6.35 | High school | 2/10 | Demolition; heavy equipment + manual |
| 524 | Power Transmission Line Worker (送電線工事) | ¥548万 | 47K | 43.4 | 7.08 | High school | 2/10 | Power line work; hazardous physical |
| 525 | Pottery Maker (陶磁器製造) | ¥461万 | 47K | 44.5 | 4.92 | High school | 2/10 | Pottery is hand craft work |
| 526 | Stonemason (石工) | ¥461万 | 47K | 44.5 | 4.92 | High school | 2/10 | Stonemason; traditional hand craft |
| 527 | Fireworks Maker (Hanabishi) (花火師) | ¥536万 | 44K | 41.7 | 3.89 | ? | 2/10 | Fireworks maker; hand craft |
| 528 | Boring/Drilling Worker (さく井工/ボーリング工) | ¥465万 | 43K | 49.9 | 3.36 | High school | 2/10 | Boring/drilling; physical operation |
| 529 | Formwork Carpenter (型枠大工) | ¥506万 | 41K | 43.0 | 10.86 | High school | 2/10 | Formwork carpentry; physical site work |
| 530 | Esthetician (エステティシャン) | ¥330万 | 40K | 40.7 | 1.58 | Vocational | 2/10 | Esthetician; in-person hands-on |
| 531 | Nail Artist (ネイリスト) | ¥330万 | 40K | 40.7 | 0.36 | Vocational | 2/10 | Nail artist; fine hand craft |
| 532 | Massage/Anma/Shiatsu Therapist (あんまマッサージ指圧師) | ¥430万 | 39K | 39.9 | 0.92 | Vocational | 2/10 | Massage therapist; pure hand craft |
| 533 | Judo Therapist (Bonesetter) (柔道整復師) | ¥430万 | 39K | 39.9 | 3.38 | Vocational | 2/10 | Judo therapist; manual technique |
| 534 | Acupuncturist / Moxibustionist (はり師・きゅう師) | ¥430万 | 39K | 39.9 | 0.92 | Vocational | 2/10 | Acupuncturist; traditional hand craft |
| 535 | Stable Staff (Race Horse) (厩舎スタッフ) | ¥352万 | 39K | 42.5 | 0.82 | High school | 2/10 | Stable staff; horse care manual |
| 536 | Zoo Keeper (動物園飼育員) | ¥352万 | 39K | 42.5 | 0.82 | Vocational | 2/10 | Zoo keeper; manual animal care |
| 537 | Animal Breeder (ブリーダー) | ¥352万 | 39K | 42.5 | 0.82 | High school | 2/10 | Breeder; animal care |
| 538 | Reinforcement Worker (Rebar) (鉄筋工) | ¥506万 | 29K | 43.0 | 9.79 | Below HS | 2/10 | Rebar work; physical on-site |
| 539 | House Cleaner (ハウスクリーニング) | ¥400万 | 28K | 49.2 | 3.17 | High school | 2/10 | House cleaning; manual |
| 540 | Steel Worker (鉄骨工) | ¥466万 | 27K | 42.7 | 7.64 | High school | 2/10 | Steel work; heavy physical labor |
| 541 | Shipbuilder (造船技能者（造船工、船舶艤装工等）) | ¥466万 | 27K | 42.7 | 7.64 | High school | 2/10 | Shipbuilder; field hand work |
| 542 | Forestry Worker (林業作業) | ¥352万 | 17K | 42.5 | 4.59 | High school | 2/10 | Logger; field physical labor |
| 543 | Aquarium Keeper (水族館飼育員) | ¥352万 | 17K | 42.5 | 2.02 | Vocational | 2/10 | Aquarium keeper; manual care |
| 544 | Crowd/Traffic Security Guard (雑踏・交通誘導警備員) | ¥329万 | 17K | 53.0 | 52.30 | High school | 2/10 | Traffic security; on-site |
| 545 | Sake Brewer (清酒製造) | ¥366万 | 15K | 43.5 | 4.07 | Bachelor's | 2/10 | Sake brewing relies on master's intuition |
| 546 | Wine Maker (ワイン製造) | ¥366万 | 15K | 43.5 | 4.07 | Bachelor's | 2/10 | Wine making is terroir + craft skill |
| 547 | Piano Tuner (ピアノ調律師) | ¥591万 | 10K | 42.7 | 0.43 | Vocational | 2/10 | Piano tuner; auditory hand craft |
| 548 | Dog Trainer (犬訓練士) | ¥591万 | 10K | 42.7 | 0.43 | Vocational | 2/10 | Dog trainer; in-person training |
| 549 | Block Layer (ブロック積み) | ¥453万 | 8K | 42.4 | 17.01 | High school | 2/10 | Block laying; manual work |
| 550 | Tile Setter (タイル工) | ¥453万 | 8K | 42.4 | 17.01 | High school | 2/10 | Tile setting; manual precision craft |
| 551 | Housekeeper (家政婦（夫）) | ¥396万 | 7K | 43.1 | 1.11 | High school | 2/10 | Housekeeper; manual housework |
| 552 | Commercial Diver (潜水士) | ¥453万 | 130K | 42.4 | 8.19 | High school | 1/10 | Diving work; AI barely touches |

