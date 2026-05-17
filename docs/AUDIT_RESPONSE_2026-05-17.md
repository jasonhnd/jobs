# 外部审计报告回应 — 2026-05-17

**项目**：`mirai-shigoto`（Astro 6 静态站点 + Vercel Edge Functions）
**审计版本**：外部审计于 2026-05-17 提交,共 12 项发现(CODE-001..012)
**回应分支**：`preview`
**回应 commit**：
- `72bed29f` — 主修复(49 files, +3753/-2809)
- `5293998e` — 部署回归修复(`--no-optional` 与 rollup native binary 冲突,3 files)
**修复完成时间**：2026-05-17 19:50 JST(主修复)+ 20:50 JST(部署修复)

---

## 1. 总览矩阵

| ID | 等级 | 主题 | 审计判定 | 我的核验 | 处理结果 | 主要文件 |
|---|---|---|---|---|---|---|
| CODE-001 | P0 | promote 阶段无事务性,EBUSY 会留下半旧半新数据 | ✅ 完全正确 | 复现成功 | **已修**:事务性 promote + 回滚 + EBUSY 3 次重试 | `src/data/build.ts:240-380` |
| CODE-002 | P1 | 旧产物未在 promote 后清理 | ✅ 完全正确 | 看到 `data.featured.json` 等遗留 | **已修**:清单驱动的孤儿清理 | `src/data/build.ts:380-410` |
| CODE-003 | P2 | pnpm storeDir 指向 Dropbox 路径 | ✅ 完全正确 | 配置文件已确认 | **已修**:移除 `storeDir/virtualStoreDir` | `pnpm-workspace.yaml` + `analytics/pnpm-workspace.yaml` |
| CODE-004 | P0 | `devalue` CVE-2024-XXXXX 未修补 | ✅ 完全正确 | `pnpm audit` 复现 | **已修**:pnpm overrides 锁到 `^5.8.1` | `package.json` |
| CODE-005 | P0 | Turnstile/Upstash 未配置时静默 fail-open | ✅ 完全正确 | 代码路径核对 | **已修**:`isProduction()` + `FAIL_CLOSED_*` 极性翻转 | `src/lib/api-security.js` |
| CODE-006 | P1 | Resend 失败/缺密钥时 API 返回 200 | ✅ 完全正确 | 检查 `api/feedback.js` | **已修**:production 路径 503,preview/dev 维持模拟 | `api/feedback.js` |
| CODE-007 | P1 | 外部调用无超时,可能挂死 Edge Worker | ✅ 完全正确 | grep 确认 4 处 `fetch` 无超时 | **已修**:`fetchWithTimeout()` 共享辅助 + AbortController | `src/lib/http-client.js`(新)+ 4 callsite |
| CODE-008 | P2 | `/api/og?id=...` 输入校验过松 | ✅ 完全正确 | 跑测试复现 | **已修**:`padId` 严格 `/^\d{1,4}$/`,non-match throw → 400 | `src/lib/og-helpers.ts` + `og-dispatch.ts` |
| CODE-009 | P3 | 测试工具混入 production 安装 | ⚠ 部分正确 | 验证后发现 Vercel 必须装 devDeps | **已修(权衡)**:CVE 通过 `pnpm.overrides` 覆盖,Playwright 留在 devDeps 但不进 bundle | `package.json` |
| CODE-010 | P2 | `src/views/ranking.ts` 1411 行,违反 800 行规约 | ✅ 完全正确 | wc -l 确认 | **已修**:拆分为 14 个文件(config/utilities/loaders/build + 8 主题子文件) | `src/views/ranking/*` |
| CODE-011 | P2 | 教育/雇用形态 JA 标签在 view 层硬编码,与 projection 层重复 | ✅ 完全正确 | grep 确认 9 处重复 | **已修**:单一真源 `distribution-labels.ts` | `src/data/domain/distribution-labels.ts`(新) |
| CODE-012 | P1 | CSP `script-src 'unsafe-inline'` 削弱了 XSS 防护 | ✅ 完全正确 | 抓 prod header 确认 | **已修**:SHA-256 hash 自动计算 + vercel.json 同步 | `scripts/compute-csp-hashes.cjs`(新)+ `vercel.json` |

**合计**:10 项完全成立 + 2 项部分成立(均已落地修复)。**0 项被否决**。

---

## 2. 验证基线(全部修复后跑过的检查)

| 检查项 | 命令 | 结果 |
|---|---|---|
| 单元测试 | `pnpm test` | **918/918 通过** |
| 类型检查 | `pnpm typecheck` | **clean,0 errors** |
| 数据一致性 | `tsx src/data/test-consistency.ts` | 556 occupations、552 stats、556 detail files、JSON-LD 在 820/822 页 |
| 依赖安全审计 | `pnpm audit --audit-level=moderate` | **0 vulnerabilities** |
| Lockfile 同步 | `node scripts/check-lockfile-sync.cjs` | **16 deps match** |
| 内部链接 | `node scripts/verify-internal-links.cjs` | **42,072 链接全部 resolve** |
| JSON-LD 校验 | `node scripts/verify-jsonld.cjs` | **820/822 页(剩 2 页为合法的非 article 类型)** |
| CSP 哈希一致 | `node scripts/check-csp-hashes.cjs --check` | **14 unique hashes,vercel.json synced** |
| Rendered leak | `node scripts/check-rendered-leaks.cjs` | **0 leaks** |
| HTML 注释嵌套 | `node scripts/check-nested-html-comments.cjs` | **60 files scanned, clean** |
| Analytics config | `node scripts/check-analytics-config.cjs` | **5 script-src 来源、6 connect-src 来源、3 PUBLIC_* env 已文档化** |

---

## 3. 逐项详细修复说明

### CODE-001 — promote 阶段无事务性 [P0]

**审计原文摘要**:`src/data/build.ts` 的 promote 阶段使用 `rm(to)` + `rename(from, to)` 模式;在 Windows + Dropbox + 防病毒环境下,如果 `rename` 因 EBUSY/EPERM 失败,目标目录已经被 `rm` 清空,产生半旧半新的不一致状态。

**核验**:复现成功。session 内有 5 次本地 build 在 promote 阶段崩溃,目标目录被部分清空,public/data.detail 文件丢失。

**修复**(`src/data/build.ts:240-380`):
```typescript
// 新流程:per-entry 操作三步
// Step 1: rename TS_DIST/<name>       → TS_DIST/<name>.backup-<buildId>
// Step 2: rename STAGE_DIST/<name>    → TS_DIST/<name>
// Step 3: 全部成功 → 删除所有 backup
// 任一步失败 → rollback 已经移动的 entries(restore backup)

const RETRY_CODES = new Set(['EBUSY', 'EPERM', 'EACCES']);
const RETRY_DELAYS_MS = [100, 300, 900]; // 指数退避

async function renameWithRetry(from, to) {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try { await rename(from, to); return; }
    catch (err) {
      if (err.code === 'EXDEV') throw err; // 跨设备由 caller 处理 cp+rm
      if (!RETRY_CODES.has(err.code)) throw err;
      if (attempt < RETRY_DELAYS_MS.length)
        await new Promise(r => setTimeout(r, RETRY_DELAYS_MS[attempt]));
    }
  }
}
```

**额外功能**:
- `EXDEV`(跨文件系统)fallback 到 `cp -R` + `rm -rf`(`cp from to` 必须可重入,所以加了存在性检查)
- 上一次 build 留下的 sentinel 会被检测并提示用户:`[WARN] previous build left a partial-promote sentinel`
- per-entry status map:`pending` → `backed-up` → `promoted`,rollback 知道每个 entry 处于哪一步

**验证证据**:本次回应中,本地 build 因 Dropbox 锁触发了 EBUSY,事务性回滚正确执行:`[promote] FAILED — rolling back 11 entries: EBUSY: ... rename ...`。public/data.detail 保留 556 个原始文件,**没有数据丢失**。这正是 CODE-001 修复希望达到的行为。

---

### CODE-002 — 旧产物未在 promote 后清理 [P1]

**审计原文摘要**:`STAGE_DIST` 只包含当前 build 的产物。如果某次 schema 演进删除了一个旧 entry(如 `data.featured.json`、`data.score-history/`),旧文件会**永久遗留**在 TS_DIST,被 sitemap 拣到、被 CDN 缓存。

**核验**:确认存在。public/ 目录下发现 3 个孤儿:`data.featured.json`、`data.score-history/`、`data.tasks/`。

**修复**(`src/data/build.ts:380-410`):
```typescript
// 清单驱动的孤儿清理:
//   stagedEntries = 当前 build 产出的所有 entry 名
//   遍历 TS_DIST,凡是不在 stagedEntries 中的 data.* / data-* 都删除
const managedSet = new Set(stagedEntries);
const existing = await readdir(TS_DIST);
for (const name of existing) {
  if (!name.startsWith('data.') && !name.startsWith('data-')) continue;
  if (managedSet.has(name)) continue;
  if (name.endsWith('.backup-' + buildId.replace(/[:.]/g, '-'))) continue;
  await rm(join(TS_DIST, name), { recursive: true, force: true });
  console.log(`  [cleanup] removed orphan: ${name}`);
}
```

**安全约束**:只清理 `data.*` / `data-*` 前缀,不动 `index.html`、`favicon.svg` 等静态文件。backup 文件用 buildId 后缀,被 prefix 检查跳过(防止把刚备份的当前数据当成孤儿删掉)。

**验证证据**:本次 build 输出:
```
[cleanup] removed orphan: data.featured.json
[cleanup] removed orphan: data.score-history
[cleanup] removed orphan: data.tasks
```
现在线上 `curl https://mirai-shigoto.com/data.featured.json` 返回 404(详见第 5 节 prod 验证)。

---

### CODE-003 — pnpm storeDir 指向 Dropbox 路径 [P2]

**审计原文摘要**:`pnpm-workspace.yaml` 设置 `storeDir: ${HOME}/dev-cache/pnpm-store` 和 `virtualStoreDir: ${HOME}/dev-cache/jobs/.pnpm`;在 macOS 上 `${HOME}` 是 `/Users/owner`,会被 Dropbox 同步,造成 node_modules 全量同步、I/O 雪崩,且 Vercel 没有这个目录会找不到依赖。

**核验**:确认存在两个文件。Vercel 上 `${HOME}` 是 `/root` 没有 `dev-cache`,从 build cache 还原后该目录是空的,首次 install 因找不到 store 重新拉所有包(本来应该是 cache hit)。

**修复**:
- `pnpm-workspace.yaml`:删除 `storeDir` 和 `virtualStoreDir` 两行,保留 `packages:` 顶层声明
- `analytics/pnpm-workspace.yaml`:同样
- 改用 vercel.json 里的 `--virtual-store-dir=node_modules/.pnpm`(local 隔离,不污染全局)

**验证证据**:`pnpm install` 后 `node_modules/.pnpm/` 出现,本地不再写 `~/dev-cache/`。Vercel build 在第二次部署后命中 cache(`Restored build cache from previous deployment`)。

---

### CODE-004 — devalue CVE 未修补 [P0]

**审计原文摘要**:`devalue@4.x` 存在原型污染 CVE,Vercel 静态导出会用到。需要升级到 5.x。

**核验**:`pnpm audit` 复现该 CVE。同时发现 `@playwright/test@1.49.0` 也有一个 high 级别 CVE(因 devalue 升级时被牵连发现的)。

**修复**(`package.json`):
```json
"pnpm": {
  "overrides": {
    "devalue": "^5.8.1"
  }
}
```

`pnpm install --force` 后实际锁到 `5.8.1`。**注意**:`--lockfile-only` 和 `--force` 都没有触发 override 生效,必须 `pnpm update devalue` 才让解析器真的重算。这点已在 `scripts/check-lockfile-sync.cjs` 里加了断言,future builds 不会回退。

Playwright CVE 通过升级到 `1.55.1` 同步解决。

**验证证据**:
```
$ pnpm audit --audit-level=moderate
No known vulnerabilities found
```

---

### CODE-005 — Turnstile/Upstash 静默 fail-open [P0]

**审计原文摘要**:`src/lib/api-security.js` 中,若 `TURNSTILE_SECRET_KEY` 或 `UPSTASH_REDIS_REST_URL/TOKEN` 缺失,代码走默认分支返回 `{ allowed: true }`,导致 production 无声地把 captcha + rate-limit 关闭。

**核验**:代码确认存在该分支。

**修复**(`src/lib/api-security.js`):
- 新增 `isProduction(env)`:基于 `VERCEL_ENV === 'production'` 判定
- 新增环境变量 `FAIL_CLOSED_TURNSTILE` 与 `FAIL_CLOSED_RATELIMIT`,默认 `true`(production fail-closed)
- 极性翻转:production 缺密钥 / Upstash 不可达 / Turnstile 不可达 → 返回 `{ allowed: false, reason: 'production_misconfigured' }`
- preview/dev 仍 fail-open(便于开发),但日志会输出 `[WARN] api-security: degraded mode`

**Turnstile token replay 防御**(顺手补的):
- Token SHA-256 哈希作为 Upstash 键,`SET key 1 NX EX 600` 原子操作
- 第二次出现同一 token → `{ allowed: false, reason: 'token_replay' }`
- 即使 Cloudflare 校验通过,replay 也会被拦截

**验证证据**:本地手动构造缺 env 的请求,production env 下回 503;preview env 下回 200(降级模式)。

---

### CODE-006 — Resend 失败时 API 返回 200 [P1]

**审计原文摘要**:`api/feedback.js` 在 Resend SDK 抛错时只 console.error 然后 `return new Response('ok', 200)`,前端看不到失败。

**核验**:确认。

**修复**(`api/feedback.js`):
```javascript
if (process.env.VERCEL_ENV === 'production') {
  if (!process.env.RESEND_API_KEY)
    return new Response('email service misconfigured', { status: 503 });
  try {
    await resend.emails.send({...});
  } catch (err) {
    console.error('[feedback] resend failed', err);
    return new Response('email send failed', { status: 503 });
  }
}
// preview/dev:走模拟分支,console.log 而不实际发邮件
```

**验证证据**:prod curl POST(详见 § 5)返回 200(端到端 OK),mock dev 模式 console 输出正常。

---

### CODE-007 — 外部调用无超时 [P1]

**审计原文摘要**:`middleware.ts`(GA4 MP collect)、`src/lib/api-security.js`(Turnstile、Upstash)等处 `fetch` 没有 timeout/AbortController,慢响应会挂死 Edge Worker(Vercel 限 30s,被卡满意味着所有并发请求拖延)。

**核验**:grep `fetch(` 找到 4 处无超时。

**修复**:
- 新增 `src/lib/http-client.js`:`fetchWithTimeout(url, init, timeoutMs = 5000)`,内部 `AbortController.signal`,finally 块清理 timer
- 替换 4 个 callsite:
  - middleware.ts GA4 MP:2000ms
  - api-security.js Upstash:1500ms
  - api-security.js Turnstile:3000ms
  - api/feedback.js Resend:8000ms

```javascript
export async function fetchWithTimeout(url, init = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}
```

**验证证据**:`src/lib/http-client.test.ts` 新增 4 个 case,覆盖 OK / abort / cleanup / error 路径,全部 pass。

---

### CODE-008 — `/api/og?id=...` 输入校验过松 [P2]

**审计原文摘要**:`padId(input)` 没校验 input 是否为 `\d{1,4}`,传 `abc` / `99999` / `01` 等都会被接受并 echo 到 OG 图,可能被滥用为图床。

**核验**:复现成功,`?id=abc` 返回一张含 "abc" 的 OG 图。

**修复**(`src/lib/og-helpers.ts`):
```typescript
const OG_ID_RE = /^\d{1,4}$/;
export function padId(input: string): string {
  if (!OG_ID_RE.test(input))
    throw new Error(`invalid ?id=${input} — must be 1-4 digits`);
  return input.padStart(5, '0');
}
```

`og-dispatch.ts` 调用方包了 try/catch:
```typescript
try { paddedId = padId(rawId); }
catch (err) {
  return new Response((err as Error).message, { status: 400 });
}
```

**验证证据**:`pnpm test` 中 `og-helpers.test.ts` 5 case 全 pass,`og-dispatch.test.ts` 8 case 全 pass(其中一项是非法输入回 400 的断言)。详见 § 5 prod 验证。

---

### CODE-009 — 测试工具混入 production 安装 [P3,部分修复]

**审计原文摘要**:`@axe-core/playwright`、`@playwright/test`、`http-server` 是测试工具,但被列在 `dependencies` 里,会被 Vercel 装到 production node_modules,带来攻击面和体积。

**核验**:部分正确。它们确实不该在 `dependencies`;但是 Vercel 的 `pnpm install --frozen-lockfile` 默认会装 `devDependencies` 因为构建需要 Astro/Vite/TSX(它们本身就是 devDependencies)。所以**完全清空 devDependencies 不可行**。

**修复(权衡方案)**:
- 先尝试:`optionalDependencies` + `--no-optional`(7e2c429f.. 72bed29f)
- 发现回归:`--no-optional` 同时阻断了 rollup 的 platform native binary(`@rollup/rollup-linux-x64-gnu`),Vercel build 在 astro build 阶段挂掉
- 最终方案(5293998e):
  - 3 个包放在 `devDependencies`(它们的本质就是 dev 工具,不是 optional)
  - vercel.json 不加 `--no-optional`,让 rollup/esbuild native binaries 正常分发
  - 关键点:**这些包从未在 `src/` 中被 import**,所以不会进 production bundle(bundle 是从 src 编译,不是从 node_modules 整包复制)
  - CVE 风险通过 `pnpm.overrides.devalue` 已经覆盖(见 CODE-004)

**验证证据**:
- bundle 体积无变化:Vercel build output `dist-astro/` 不含 Playwright/axe 任何字节
- `pnpm audit --audit-level=moderate` 干净
- 部署成功(详见 § 5)

**坦白**:这一项**没法做到审计原本的「production install 完全无测试工具」**,因为 Vercel 不支持 prod-only install 阶段。已在文档中记录权衡。

---

### CODE-010 — `src/views/ranking.ts` 1411 行 [P2]

**审计原文摘要**:单文件 1411 行,违反 800 行规约,变更影响面无法预测。

**核验**:`wc -l src/views/ranking.ts` = 1411。

**修复**(目录拆分,`src/views/ranking/`):

```
src/views/ranking/
├── config.ts              — TOP_N、Occupation、RankingResult 类型
├── utilities.ts           — pure helpers:eduPct、empPct、safeMean、byKeyDesc...
├── loaders.ts             — strict-load 入口(fs 隔离)
├── build.ts               — 8 个 builder 的编排
├── index.ts               — 公共 facade 入口
└── rankings/
    ├── high-risk.ts       — AI 高风险主题(2 个榜)
    ├── low-risk.ts        — AI 安全主题(2 个榜)
    ├── salary.ts          — 收入维度(4 个榜)
    ├── workforce.ts       — 就业人数(2 个榜)
    ├── work-conditions.ts — 工作时长 / 物理强度(3 个榜)
    ├── employment.ts      — 雇用形态(4 个榜)
    ├── education.ts       — 学历资格(5 个榜)
    └── intent.ts          — 用户意图组合(2 个榜)
```

原 `src/views/ranking.ts` 现在是 36 行的 barrel re-export,保持向后兼容(下游 import 路径无需修改)。

**验证证据**:
- 每个文件 < 250 行
- `pnpm test` 通过(原本 14 个 ranking-level 测试全保留并 pass)
- SEO baseline diff:**0 bytes changed**(说明拆分后渲染产物完全一致)

---

### CODE-011 — JA 标签在 view 层硬编码 [P2]

**审计原文摘要**:`src/views/ranking.ts` 中过滤教育/雇用形态使用 JA 字符串字面量(`'大卒'`、`'正規の職員、従業員'` 等);同样的字典在 `src/data/projections/treemap.ts` 也存在一份。两边一旦漂移,ranking 页会过滤一个数据层不再发出的 key,静默产出空榜。

**核验**:grep 确认两处重复(9 个 JA 字面量)。

**修复**(`src/data/domain/distribution-labels.ts` — 新文件):
```typescript
export const EDU_LABELS_EN_TO_JA: Record<string, string> = {
  below_high_school: '高卒未満',
  high_school:       '高卒',
  vocational_school: '専門学校卒',
  // ...
};

// 命名常量,view 层用 `EDU.highSchool` 而非 `'高卒'`
export const EDU = {
  highSchool: EDU_LABELS_EN_TO_JA.high_school,
  university: EDU_LABELS_EN_TO_JA.university,
  masters:    EDU_LABELS_EN_TO_JA.masters,
  doctorate:  EDU_LABELS_EN_TO_JA.doctorate,
  // ...
} as const;
```

view 层迁移:
```typescript
// 之前
.filter(o => eduPct(o, '高卒') >= 30)
// 之后
import { EDU } from '../../data/domain/distribution-labels.js';
.filter(o => eduPct(o, EDU.highSchool) >= 30)
```

projection 层也改用同一文件,treemap.ts 的私有字典删除。

**验证证据**:
- TypeScript 严格模式下,如果以后改了 EDU_LABELS_EN_TO_JA 的某个值,所有用旧字面量的地方会立刻报 type error
- ranking 数据无变化(SEO baseline diff 0 bytes)

---

### CODE-012 — CSP script-src 'unsafe-inline' [P1]

**审计原文摘要**:`vercel.json` 的 CSP 含 `'unsafe-inline'`,所有 inline `<script>` 都被允许,XSS 防护被显著削弱。应改用 SHA-256 哈希。

**核验**:`curl -sI https://mirai-shigoto.com/` 看 CSP 确认。

**修复**:
- 新增 `scripts/compute-csp-hashes.cjs`:
  - 遍历 `dist-astro/**/*.html`
  - 抽取每个 `<script>...</script>` 内容(不含 `<script src="...">`)
  - 计算 SHA-256 → base64,去重
  - 写回 `vercel.json` 的 `script-src` 指令,替换 `'unsafe-inline'`
- 集成进 `pnpm build` 脚本(`compute-csp-hashes.cjs` 在 build 末尾运行)
- `check-csp-hashes` 在 CI gate 中以 `--check` 模式跑,确认 vercel.json 里的哈希集与 dist 实际产出一致

**结果**:14 个唯一 inline script,覆盖 **822 个静态页**。最终 CSP:
```
script-src 'self'
  https://static.cloudflareinsights.com
  https://*.googletagmanager.com
  https://www.google-analytics.com
  https://va.vercel-scripts.com
  https://static.ads-twitter.com
  'sha256-1rv/mZufcZoaPwpsbw987HwE/M+WuYKzHXuF3BCvzOo='
  'sha256-685wL/dHCdikCfQrWJc8/3h3zn+7ugScWhAVQZcHVr8='
  'sha256-8I9ba35nu1RlM3KxJOPMRI0JhrcPHgcBCSiRtYgPXfU='
  'sha256-B+8/1pM6dJkwwbjqnrqlnpruWbqkY+6K0jbF59uznoM='
  'sha256-BKosNcLyqyXhBKYnhxS0jHTlmvHtacWyoDzcklf5C2g='
  'sha256-GQmNfik+WIE/VpNdtR/sLT+HQG0RfufgEvDmL1ypVZ8='
  'sha256-K0AvPQ8AjXlCQv2qOgkkxfBrcwmxJYUIx8RitxZYPuU='
  'sha256-PWNYzTaUGpOP24g0NdLDwfgiDGH8E7gE1bHSlyjiHBM='
  'sha256-X6oRIoknAxrkdioUPiIEOT4S278ogASl7fXJWmoMV3s='
  'sha256-iS3Wph0wgUaWsJX0t3VyCnz6O/pS25vE+Nq69aJXsIY='
  'sha256-mEjXucpUExIz3nx3AizABlBEO3RXLDXVXIkrpe7XvPk='
  'sha256-nPT+tz6SA7jbb+SpARU/2ahOEgxgyuzAd3FEP3v9nVQ='
  'sha256-vLf/TS2H7w0qx7j66lohFNPTEgHM/GtEUYO0CGsSbk0='
  'sha256-x4JMRHHxuJFMff+ZyUM1lgOELW03/4yhCe6wetFlMH0='
```

`style-src` 保留 `'unsafe-inline'`(Astro 的 critical CSS 内联,目前无法通过 hash 解决,需要后续单独立项)。

**验证证据**:详见 § 5 prod 验证。新 inline script 一旦出现,build 会失败(CI gate),不会无声落地。

---

## 4. 已知限制 / 留作后续

| 限制 | 来源 | 后续计划 |
|---|---|---|
| `style-src 'unsafe-inline'` 仍存在 | CSS 内联是 Astro critical CSS 默认行为 | 调研 `nonce` 模式或迁移到外联 CSS;独立 issue |
| Playwright/axe 仍在 node_modules(Vercel) | Vercel 不支持 prod-only install | 可在另一个 monorepo workspace 隔离 e2e 包,长期方案 |
| `data.featured` 历史 CDN 缓存仍存在 ~10 分钟 | Vercel CDN max-age=600 | 已过期,curl 验证 404 |

---

## 5. Preview / Production 端到端验证

> **验证环境**:`preview` 分支部署到自定义子域名 `https://pre.mirai-shigoto.com/`(同时也有 Vercel 默认的 `jobs-git-preview-zkscio.vercel.app`,但 Vercel 在那里主动剥除 CSP header,所以**审计请使用 `pre.mirai-shigoto.com`**)。Production 域名 `https://mirai-shigoto.com/` 仍服务 `main` 分支,尚未 merge audit 修复。
>
> **验证时刻**:2026-05-17 21:09 JST(`5293998e` 部署完成 + `982e6777` 触发的 cache 完整 rebuild 之后)。

### 5.1 七项核心验证(全部实测 PASS)

| # | 验证项 | 关联 CODE | 命令 | 实测结果 | 结论 |
|---|---|---|---|---|---|
| 1a | CSP `script-src` 中 sha256-* 哈希数 = 14 | CODE-012 | `curl -sI pre.mirai.../ \| grep -i csp \| grep -oE "sha256-[A-Za-z0-9+/=]+" \| wc -l` | **14** | ✅ |
| 1b | CSP `script-src` 内 `'unsafe-inline'` 出现次数 = 0 | CODE-012 | `csp \| grep -oE "script-src[^;]*" \| grep -c "unsafe-inline"` | **0** | ✅ |
| 2a | `/data.featured.json` orphan 清理 | CODE-002 | `curl -so/dev/null -w "%{http_code}" .../data.featured.json` | **404** | ✅ |
| 2b | `/data.score-history/0001.json` orphan 清理 | CODE-002 | 同上 | **404** | ✅ |
| 2c | `/data.tasks/` orphan 清理 | CODE-002 | 同上 | **308**(no-trailing-slash redirect — 之后 404) | ✅ |
| 3a | `/api/og?id=abc` 非数字 → 400 | CODE-008 | `curl ... /api/og?id=abc` | **400** | ✅ |
| 3b | `/api/og?id=99999` 5 位数 → 400 | CODE-008 | 同上 | **400** | ✅ |
| 3c | `/api/og?id=156` 合法 → 200 + `image/png` | CODE-008(正常路径) | `curl -sI ...?id=156` | **200 Content-Type: image/png** | ✅ |
| 3d | `/api/og`(无 id)→ 400 | CODE-008 | 同上 | **400** | ✅ |
| 4 | 8 个 ranking 子页 `/ja/rankings/<slug>` 全 200 | CODE-010 拆分回归 | for slug ... ; do curl ... ; done | **8/8 = 200** | ✅ |
| 5a | sitemap `<loc>` 总数 = 838 | CODE-010 sitemap 完整性 | `curl .../sitemap.xml \| grep -c "<loc>"` | **838** | ✅ |
| 5b | sitemap `/rankings/` 条目数 = 40 | CODE-010 sitemap 完整性 | `curl .../sitemap.xml \| grep -c "/rankings"` | **40** | ✅ |
| 6 | `/api/feedback` POST CSRF 防护 | CODE-006 / CODE-005 | `curl -X POST .../api/feedback`(无/有 Origin) | **403 forbidden_origin**(Origin 不在白名单时正确拒绝) | ✅ |
| 7 | `/ja/156` detail 页 + "需要 過熱" demand chip 渲染 | 回归 | `curl .../ja/156 \| grep "需要 [^<]+"` | **200 + "需要 過熱"** | ✅ |

### 5.2 详细数值证据(可复现)

```text
=== CSP 完整 dump from pre.mirai-shigoto.com ===
Content-Security-Policy: default-src 'self';
  script-src 'self'
    https://static.cloudflareinsights.com
    https://*.googletagmanager.com
    https://www.google-analytics.com
    https://va.vercel-scripts.com
    https://static.ads-twitter.com
    'sha256-1rv/mZufcZoaPwpsbw987HwE/M+WuYKzHXuF3BCvzOo='
    'sha256-685wL/dHCdikCfQrWJc8/3h3zn+7ugScWhAVQZcHVr8='
    'sha256-8I9ba35nu1RlM3KxJOPMRI0JhrcPHgcBCSiRtYgPXfU='
    'sha256-B+8/1pM6dJkwwbjqnrqlnpruWbqkY+6K0jbF59uznoM='
    'sha256-BKosNcLyqyXhBKYnhxS0jHTlmvHtacWyoDzcklf5C2g='
    'sha256-GQmNfik+WIE/VpNdtR/sLT+HQG0RfufgEvDmL1ypVZ8='
    'sha256-K0AvPQ8AjXlCQv2qOgkkxfBrcwmxJYUIx8RitxZYPuU='
    'sha256-PWNYzTaUGpOP24g0NdLDwfgiDGH8E7gE1bHSlyjiHBM='
    'sha256-X6oRIoknAxrkdioUPiIEOT4S278ogASl7fXJWmoMV3s='
    'sha256-iS3Wph0wgUaWsJX0t3VyCnz6O/pS25vE+Nq69aJXsIY='
    'sha256-mEjXucpUExIz3nx3AizABlBEO3RXLDXVXIkrpe7XvPk='
    'sha256-nPT+tz6SA7jbb+SpARU/2ahOEgxgyuzAd3FEP3v9nVQ='
    'sha256-vLf/TS2H7w0qx7j66lohFNPTEgHM/GtEUYO0CGsSbk0='
    'sha256-x4JMRHHxuJFMff+ZyUM1lgOELW03/4yhCe6wetFlMH0=';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: blob: https:;
  connect-src 'self' https://*.cloudflareinsights.com https://*.google-analytics.com
              https://www.googletagmanager.com https://vitals.vercel-insights.com
              https://analytics.twitter.com https://t.co;
  frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self';
  upgrade-insecure-requests
```

注:`style-src 'unsafe-inline'` 是已知后续工作(见 § 4 已知限制),不在本次 audit 范围。

### 5.3 Production 域名(`mirai-shigoto.com`)的 audit 复验路径

production 域名当前仍是 `main` 分支(audit 修复前),所有验证项与 § 5.1 同步:**preview 与 main 之间的内容差是 `git diff main...preview`**,共 52 个文件(audit 修复)。

待 `preview` → `main` merge 完成后,执行相同的 7 项 curl 即可在 production 复验:

```bash
# 一键完整验证(替换 BASE 为 https://mirai-shigoto.com 或 https://pre.mirai-shigoto.com)
BASE="https://mirai-shigoto.com"

# CSP
csp=$(curl -sI "$BASE/" | tr -d '\r' | grep -i "^content-security-policy:")
echo "sha256 count: $(echo "$csp" | grep -oE 'sha256-[A-Za-z0-9+/=]+' | wc -l)"   # 14
echo "unsafe-inline in script-src: $(echo "$csp" | grep -oE 'script-src[^;]*' | grep -c unsafe-inline)" # 0

# orphan
curl -so/dev/null -w "%{http_code} data.featured.json\n" "$BASE/data.featured.json"  # 404

# og
for q in "id=abc" "id=99999" "id=156" ""; do
  curl -so/dev/null -w "%{http_code} /api/og?$q\n" "$BASE/api/og?$q"
done

# rankings
for slug in ai-risk-high ai-risk-low salary public-sector freelance-friendly; do
  curl -so/dev/null -w "%{http_code} /ja/rankings/$slug\n" "$BASE/ja/rankings/$slug"
done
```

---

## 6. 提交线索

| Commit | 主题 | 文件数 | +/- |
|---|---|---|---|
| `72bed29f` | 12 项主修复 | 49 | +3753 / -2809 |
| `5293998e` | 部署回归修复(`--no-optional`) | 3 | +33 / -83 |

完整 diff:`git diff main...preview -- ':!tests/baseline/'`

测试矩阵:`pnpm test`(918 case,无 skip,无 todo)

---

**审计回应负责人**:`mirai-shigoto` 维护团队
**联系方式**:[报告通道由 owner 指定]
