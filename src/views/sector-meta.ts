/**
 * src/views/sector-meta.ts — 16 sector の AI 時代エッセイ + パターン観察ヘルパー。
 *
 * Migrated from src/data/lib/sector-meta.ts 2026-05-14 as part of
 * Phase B. Lives under src/views/ per §6.2.
 *
 *
 * Phase 2 (2026-05-09) 追加: 既存の sector hub (src/pages/ja/sectors/[sector].astro)
 * は data/sectors/sectors.ja-en.json の 1 行 description_ja のみを intro に使っていた。
 * 本ファイルは各 sector に対して:
 *   - "AI 時代の特性" エッセイ (200-300 字、editorial 第 1 稿、後で人手で polish 可能)
 *   - "データから見えるパターン" 自動派生のヘルパー入力
 *   - 注目の発見ヒント (3-5 項目、boolean フラグ + テンプレ)
 * を提供する。
 *
 * 設計判断:
 *   - エッセイは「編集者手書き第 1 稿」位置づけ。データ独立で sector ごとの本質を
 *     一段深く言語化。サイト全体の構造的な観点を盛り込む。
 *   - パターン観察は別ヘルパー (computeSectorPatterns) で treemap.json から導出。
 *     エッセイと組み合わせて、editorial + data の両方が見える hub を構築。
 *
 * Pure-data モジュール、fs imports なし。
 */

export type SectorId =
  | 'iryo' | 'fukushi' | 'kyoiku' | 'hoan' | 'noringyo'
  | 'senmon' | 'it' | 'shigyo' | 'creative' | 'jimu'
  | 'hanbai' | 'service' | 'seizo' | 'maint' | 'kensetu' | 'keiseki';

export interface SectorEssay {
  id: SectorId;
  /** AI 時代におけるこのセクターの特性 (200-300 字) */
  ai_era_essay_ja: string;
  /**
   * 注目の発見の "型" — editorial の方向性ヒント。
   * 実際の生成は computeSectorPatterns + テンプレで自動化。
   */
  finding_hints_ja: ReadonlyArray<string>;
}

export const SECTOR_ESSAYS: Record<SectorId, SectorEssay> = {
  iryo: {
    id: 'iryo',
    ai_era_essay_ja:
      '医療・保健セクターは AI による業務影響が二極化する分野。' +
      '画像診断・記録・レセプト処理など事務的業務は AI で大きく効率化される一方、' +
      '患者ケア・診察判断・処置の手技は人間でしか担えない領域として強く残る。' +
      '看護師・介護福祉士・PT/OT/ST など対人ケア職は AI 影響度が低く、' +
      '高齢化に伴う需要増も相まって長期的に安定したキャリアが築ける。' +
      'ただし医療事務系・診療記録系は再設計が急務。',
    finding_hints_ja: [
      '対人ケア職と事務系の AI 影響度差',
      '高齢化に伴う需要側の構造的拡大',
      '国家資格による参入障壁の高さ',
    ],
  },
  fukushi: {
    id: 'fukushi',
    ai_era_essay_ja:
      '福祉・介護セクターは AI 時代の「安全地帯」として位置づけられる。' +
      'ケアの本質は身体的接触・感情的サポート・即興的調整にあり、' +
      'これらは AI で代替されにくい構造的な人間優位領域。' +
      '少子高齢化により需要が継続的に拡大する一方、人手不足が慢性化しており' +
      '入職ルートも比較的整備されている。賃金面の課題はあるものの、' +
      '長期的なキャリア安定性と社会的意義の両方が確保できる職業群。',
    finding_hints_ja: [
      'AI 影響度が全業種で最も低い領域の一つ',
      '人手不足による賃金上昇圧力',
      '無資格スタート → 資格取得のルート',
    ],
  },
  kyoiku: {
    id: 'kyoiku',
    ai_era_essay_ja:
      '教育・指導セクターは AI と教育の関係が再定義される最中の分野。' +
      'AI は個別学習・教材生成・採点で強力なツールになるが、' +
      '生徒のモチベーション喚起・社会性の育成・複雑な状況判断は教師の役割として残る。' +
      '保育士・教師・インストラクターなど対人指導職は AI 影響度が低く、' +
      '少子化の影響を受けつつも社会的需要は継続。' +
      '学校教員は資格・公務員的安定性も併せ持つ。',
    finding_hints_ja: [
      '対人指導の代替不可能性',
      '個別最適化教育における AI ツール活用',
      '少子化と需要側の関係',
    ],
  },
  hoan: {
    id: 'hoan',
    ai_era_essay_ja:
      '保安・公安セクターは AI 時代でも需要が安定する公的職業群。' +
      '警察官・自衛官・消防士・救急救命士は身体的能力・現場判断・対人ストレスへの対応が必須で、' +
      'AI による代替は事務処理部分に限定される。' +
      '地方公務員・国家公務員としての雇用安定性と福利厚生も大きな魅力。' +
      '退職後も警備員等のセカンドキャリアが整備されている。',
    finding_hints_ja: [
      '公的職業としての構造的安定',
      '身体能力 + 判断力 + 対人スキルの複合',
      '退職後セカンドキャリアの選択肢',
    ],
  },
  noringyo: {
    id: 'noringyo',
    ai_era_essay_ja:
      '農林・水産セクターは AI 影響度が低い身体技能職の代表格。' +
      '自然環境下での判断・身体的作業・地域知識は AI で代替されにくい。' +
      '一方で就業者の高齢化と後継者不足が深刻で、若手参入には大きなチャンスが存在。' +
      'スマート農業・林業 IoT などの技術導入で生産性は向上しているが、' +
      '現場の意思決定はあくまで人間中心。独立・自営業のルートが王道。',
    finding_hints_ja: [
      '高齢化と後継者問題が新規参入のチャンス',
      'スマート農業との共存',
      '独立・自営の典型キャリア',
    ],
  },
  senmon: {
    id: 'senmon',
    ai_era_essay_ja:
      '専門・技術セクターは AI の影響が分野ごとに大きく異なる。' +
      '医師・建築士・薬剤師など国家資格 + 現場判断を要する職業は AI 安全度が高い。' +
      '一方、研究補助・データ分析の一部は AI で大幅に効率化される。' +
      '高度な専門性 + 規制保護 + 対人接触の組合せが、AI 時代の優位性を作る。' +
      '長期の専門教育投資が前提だが、リターンも大きい職業群。',
    finding_hints_ja: [
      '国家資格保護の AI 抗性効果',
      '専門性の深さによる優位性',
      '研究補助系の AI 影響',
    ],
  },
  it: {
    id: 'it',
    ai_era_essay_ja:
      'IT・通信セクターは AI 時代の最前線にして二面性を持つ分野。' +
      'プログラミング・テスト・ドキュメント生成は AI コーディングで大幅に効率化され、' +
      'AI 影響度は全セクターで最も高い。一方で AI 自体を開発・運用する立場でもあり、' +
      '上流設計・アーキテクチャ・セキュリティ・複雑な意思決定は人間の役割として残る。' +
      'AI を「使う側」に立つことで職業の再定義に成功した人と、そうでない人で大きな差が出る。',
    finding_hints_ja: [
      'AI を使う側 vs 使われる側の二極化',
      '上流業務とコーディング業務の影響度差',
      '継続学習の必要性',
    ],
  },
  shigyo: {
    id: 'shigyo',
    ai_era_essay_ja:
      '士業・経営セクターは規制保護と AI 化が並行進行する分野。' +
      '弁護士・公認会計士・税理士・司法書士など国家資格職は法的に守られた業務範囲を持つが、' +
      '書類作成・リサーチ・基礎分析は AI で大幅に効率化されている。' +
      '結果として「AI で代替されない上流業務 (戦略・交渉・複雑判断) に注力する士業」と' +
      '「AI を活用して効率化する士業」の二極化が進む。経営層も同様の構造変化に直面。',
    finding_hints_ja: [
      '規制保護下の AI 化',
      '上流業務へのシフト圧力',
      '独立開業の典型ルート',
    ],
  },
  creative: {
    id: 'creative',
    ai_era_essay_ja:
      'クリエイティブ・メディアセクターは生成 AI の直撃を受けた分野。' +
      '画像生成・テキスト生成・音楽生成 AI の進化で、' +
      'デザイン・編集・翻訳・広告制作の業務構造が急速に変化している。' +
      '一方で独自の感性・編集判断・クライアント折衝・物理的作業 (撮影・調理等) は残り、' +
      'AI を活用するクリエイター vs AI に置き換わる工程の境界線が引かれつつある。' +
      'スタイル・世界観の独自性を持つ人ほど優位性を保つ。',
    finding_hints_ja: [
      '生成 AI による業務再設計',
      '独自性の市場価値',
      '物理的工程の AI 抗性',
    ],
  },
  jimu: {
    id: 'jimu',
    ai_era_essay_ja:
      '事務・公務セクターは AI 時代の影響を最も大きく受ける分野の一つ。' +
      '一般事務・経理・秘書・受付など PC で完結するルーティン業務は' +
      'AI と自動化ツールで業務量が大幅に減少する見込み。' +
      'ただし職業自体が消えるわけではなく、業務の中心が「判断・例外処理・関係調整」に' +
      'シフトする再設計が進行中。公務員系は法的保護で雇用は守られるが、' +
      '業務内訳の変化への適応が長期的な課題。',
    finding_hints_ja: [
      'PC 完結業務の AI 化',
      '業務再設計と人員配置',
      '判断系業務へのシフト',
    ],
  },
  hanbai: {
    id: 'hanbai',
    ai_era_essay_ja:
      '販売・小売セクターは AI 時代に二極化が進む分野。' +
      'EC・セルフレジ・在庫 AI の浸透で定型業務は減少する一方、' +
      '対面接客・商品提案・専門知識を要する販売は AI で代替できない領域として残る。' +
      '美容・宝飾・スポーツ用品等の専門販売、外商・営業職は対人スキルが本質。' +
      '一方、ネット通販受付や量販店レジ系は AI 影響度が高い。' +
      '専門性 + 対人スキルの組合せが鍵。',
    finding_hints_ja: [
      '専門販売 vs 量販販売の二極化',
      '対面接客の代替不可能性',
      '営業職への AI 補強',
    ],
  },
  service: {
    id: 'service',
    ai_era_essay_ja:
      'サービス・接客セクターは身体性 + 対人スキルが本質の AI 時代強い分野。' +
      '宿泊・飲食・美容・家事代行など、現場でのサービス提供は AI で代替されにくく、' +
      '人手不足も慢性化している。チェーン店オペレーションは AI 化が進む一方、' +
      'パーソナライズドな接客・専門技能 (調理・美容等) は人間優位が続く。' +
      'ホスピタリティが本物の優位性を作る分野。',
    finding_hints_ja: [
      '対人サービスの AI 抗性',
      '人手不足と賃金圧力',
      'チェーン化と職人化の分岐',
    ],
  },
  seizo: {
    id: 'seizo',
    ai_era_essay_ja:
      '製造・職人セクターは AI 時代の安定軸の一つ。' +
      'ロボット化が進む工程と、職人技で残る工程が明確に分かれている。' +
      '量産品の組み立て・検査は自動化されるが、' +
      '伝統工芸・食品手仕事・カスタム製造の職人技は AI で代替不可能。' +
      '製造業全体としては中堅層の高齢化が進み、若手参入のチャンスが拡大。' +
      'モノづくり日本の核となる人材ニーズが継続。',
    finding_hints_ja: [
      '量産自動化 vs 職人技の分岐',
      '中堅層の高齢化と若手チャンス',
      '伝統技能の継承課題',
    ],
  },
  maint: {
    id: 'maint',
    ai_era_essay_ja:
      'メンテナンス・整備セクターは AI 時代の「縁の下」職業群。' +
      '自動車整備・建物管理・電気保守・機械修理など、現場の判断と手技を要する職業は' +
      'AI で代替されにくく、設備の高度化に伴って需要も継続。' +
      '故障予知 AI などのツールは登場するが、最終的な修理判断と作業は人間の役割。' +
      '実務経験が価値を持ち、独立・自営のルートも整備されている。',
    finding_hints_ja: [
      '故障予知 AI と最終判断の役割分担',
      '設備高度化に伴う技能ニーズ',
      '実務経験の市場価値',
    ],
  },
  kensetu: {
    id: 'kensetu',
    ai_era_essay_ja:
      '建設・土木セクターは AI 影響度が全業種で最も低い分野。' +
      '現場での身体作業・即興判断・チーム協働・天候対応は AI で代替不可能。' +
      'インフラ更新需要・災害復旧・都市再開発で需要は継続的に強い。' +
      '一方で就業者の高齢化と若手不足が深刻化しており、' +
      '電気工事士・配管工・大工等の技能職は売り手市場が長期化見込み。' +
      '無資格スタート + 実地訓練のルートが整備されている。',
    finding_hints_ja: [
      'AI 影響度の構造的低さ',
      '高齢化と需要強さの逆説',
      '技能職の独立ルート',
    ],
  },
  keiseki: {
    id: 'keiseki',
    ai_era_essay_ja:
      '軽作業・清掃セクターは AI と並存する低スキル現場職群。' +
      '清掃・配送・倉庫作業など物理的な仕事は AI で部分的に自動化されるが、' +
      '不規則な環境・例外対応・人ならではの柔軟性が必要な部分は残る。' +
      '高齢者・主婦・短期就労者の活躍場として社会的役割も大きい。' +
      'ロボット化の進展で業務内訳は変化するが、職業自体の消滅は限定的。',
    finding_hints_ja: [
      '物理作業の部分的 AI 化',
      '柔軟な就労形態',
      '社会的役割の大きさ',
    ],
  },
};

// ─── Pattern computation helpers ─────────────────────────────────────

export interface SectorOcc {
  id: number;
  title_ja: string | null;
  ai_risk: number | null;
  workers: number | null;
  salary: number | null;
  monthly_hours: number | null;
  average_age: number | null;
  recruit_ratio: number | null;
}

export interface SectorPatterns {
  /** AI risk distribution */
  ai_high_count: number; // >= 7
  ai_mid_count: number;  // 4-6
  ai_low_count: number;  // <= 3
  /** 比率 */
  ai_high_pct: number;
  ai_mid_pct: number;
  ai_low_pct: number;
  /** 全 site 平均との差 (positive = 高い) */
  ai_vs_site_diff: number;
  salary_vs_site_diff: number;
  age_vs_site_diff: number;
  hours_vs_site_diff: number;
  /** Auto-generated 3-5 件のパターン文 */
  observations: ReadonlyArray<string>;
}

interface SiteBaseline {
  ai_risk_mean: number;
  salary_mean: number;
  age_mean: number;
  hours_mean: number;
}

function safeMean<T>(items: ReadonlyArray<T>, getter: (o: T) => number | null | undefined): number {
  const vals = items.map(getter).filter((v): v is number => typeof v === 'number');
  return vals.length === 0 ? 0 : vals.reduce((s, v) => s + v, 0) / vals.length;
}

export function computeSiteBaseline(allOccs: ReadonlyArray<SectorOcc>): SiteBaseline {
  return {
    ai_risk_mean: safeMean(allOccs, (o) => o.ai_risk),
    salary_mean: safeMean(allOccs, (o) => o.salary),
    age_mean: safeMean(allOccs, (o) => o.average_age),
    hours_mean: safeMean(allOccs, (o) => o.monthly_hours),
  };
}

export function computeSectorPatterns(
  sectorOccs: ReadonlyArray<SectorOcc>,
  baseline: SiteBaseline,
  sectorJa: string,
): SectorPatterns {
  const risks = sectorOccs.map((o) => o.ai_risk).filter((r): r is number => typeof r === 'number');
  const aiHigh = risks.filter((r) => r >= 7).length;
  const aiMid = risks.filter((r) => r >= 4 && r <= 6).length;
  const aiLow = risks.filter((r) => r <= 3).length;
  const total = risks.length || 1;

  const sectorAiMean = safeMean(sectorOccs, (o) => o.ai_risk);
  const sectorSalaryMean = safeMean(sectorOccs, (o) => o.salary);
  const sectorAgeMean = safeMean(sectorOccs, (o) => o.average_age);
  const sectorHoursMean = safeMean(sectorOccs, (o) => o.monthly_hours);

  const aiDiff = sectorAiMean - baseline.ai_risk_mean;
  const salaryDiff = sectorSalaryMean - baseline.salary_mean;
  const ageDiff = sectorAgeMean - baseline.age_mean;
  const hoursDiff = sectorHoursMean - baseline.hours_mean;

  const observations: string[] = [];

  // AI risk pattern
  if (Math.abs(aiDiff) >= 0.8) {
    observations.push(
      aiDiff > 0
        ? `${sectorJa} の平均 AI 影響度は ${sectorAiMean.toFixed(1)}/10 で、全業種平均より <strong>+${aiDiff.toFixed(1)}</strong> 高い`
        : `${sectorJa} の平均 AI 影響度は ${sectorAiMean.toFixed(1)}/10 で、全業種平均より <strong>${aiDiff.toFixed(1)}</strong> 低い`,
    );
  }

  // Bimodal AI distribution
  if (aiHigh >= 3 && aiLow >= 3) {
    observations.push(
      `AI 影響度が <strong>二極化</strong>: 高暴露 ${aiHigh} 職業 (${((aiHigh / total) * 100).toFixed(0)}%) と低暴露 ${aiLow} 職業 (${((aiLow / total) * 100).toFixed(0)}%) が並存`,
    );
  }

  // Salary
  if (Math.abs(salaryDiff) >= 30) {
    observations.push(
      salaryDiff > 0
        ? `平均年収 ${Math.trunc(sectorSalaryMean)} 万円は全業種平均より <strong>+${Math.trunc(salaryDiff)} 万円</strong> 高い`
        : `平均年収 ${Math.trunc(sectorSalaryMean)} 万円は全業種平均より <strong>${Math.trunc(salaryDiff)} 万円</strong> 低い`,
    );
  }

  // Aging
  if (Math.abs(ageDiff) >= 2) {
    observations.push(
      ageDiff > 0
        ? `平均年齢 ${sectorAgeMean.toFixed(1)} 歳は全業種平均より <strong>+${ageDiff.toFixed(1)} 歳</strong> 高い (高齢化)`
        : `平均年齢 ${sectorAgeMean.toFixed(1)} 歳は全業種平均より <strong>${ageDiff.toFixed(1)} 歳</strong> 低い (若手中心)`,
    );
  }

  // Long hours
  if (hoursDiff >= 5) {
    observations.push(
      `月間労働時間 ${Math.trunc(sectorHoursMean)} 時間は全業種平均より <strong>+${Math.trunc(hoursDiff)} 時間</strong> 長い`,
    );
  } else if (hoursDiff <= -5) {
    observations.push(
      `月間労働時間 ${Math.trunc(sectorHoursMean)} 時間は全業種平均より <strong>${Math.trunc(hoursDiff)} 時間</strong> 短い`,
    );
  }

  // Recruit ratio (only if data uniform)
  const recruits = sectorOccs.map((o) => o.recruit_ratio).filter((r): r is number => typeof r === 'number');
  if (recruits.length > 0) {
    const avgRecruit = recruits.reduce((s, v) => s + v, 0) / recruits.length;
    if (avgRecruit >= 1.8) {
      observations.push(`平均求人倍率 ${avgRecruit.toFixed(2)} 倍 — 人手不足が顕著な売り手市場`);
    } else if (avgRecruit <= 0.8) {
      observations.push(`平均求人倍率 ${avgRecruit.toFixed(2)} 倍 — 採用競争が厳しい買い手市場`);
    }
  }

  return {
    ai_high_count: aiHigh,
    ai_mid_count: aiMid,
    ai_low_count: aiLow,
    ai_high_pct: (aiHigh / total) * 100,
    ai_mid_pct: (aiMid / total) * 100,
    ai_low_pct: (aiLow / total) * 100,
    ai_vs_site_diff: aiDiff,
    salary_vs_site_diff: salaryDiff,
    age_vs_site_diff: ageDiff,
    hours_vs_site_diff: hoursDiff,
    observations,
  };
}

export function getSectorEssay(sectorId: string): SectorEssay | null {
  const validIds: SectorId[] = [
    'iryo', 'fukushi', 'kyoiku', 'hoan', 'noringyo',
    'senmon', 'it', 'shigyo', 'creative', 'jimu',
    'hanbai', 'service', 'seizo', 'maint', 'kensetu', 'keiseki',
  ];
  if (validIds.includes(sectorId as SectorId)) {
    return SECTOR_ESSAYS[sectorId as SectorId];
  }
  return null;
}
