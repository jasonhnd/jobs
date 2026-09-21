/**
 * Shapes of data.haid-<release>.json / data.haid-latest.json.
 * Written by src/data/projections/haid-release.ts, read by src/views/haid-release.ts.
 */
import type {
  HAID_BOUNDARIES,
  HAID_CERTAINTY_JA,
  HAID_GRADE_JA,
  HAID_RELATIONS,
} from './haid-spec.js';
import type { HaidRelease, HaidReleaseCertainty } from '../data/schema/haid-release.js';

export const HAID_RELEASE_BASE_PATH = '/aiadoption';

export interface HaidReleaseLevelOut {
  level: number;
  relation: string;
  ja: string;
  en: string;
  n_at_least: {
    certainty: HaidReleaseCertainty;
    low: number | null;
    mid: number | null;
    high: number | null;
    /** Value the page draws and quotes. null when データなし. */
    display: number | null;
    /** true when nesting raised display above the input (see file header). */
    clamped: boolean;
  };
  n: {
    certainty: HaidReleaseCertainty;
    display: number | null;
    /** display / population, 0..1. null when データなし. */
    share: number | null;
  };
  anchors: string[];
  overlap: string | null;
  method_ja: string;
}

export interface HaidReleasePayload {
  schema_version: string;
  standard: 'HAID';
  name_ja: string;
  spec_version: string;
  spec_url: string;
  license: string;
  license_url: string;
  release: string;
  label_ja: string;
  version: string;
  status: 'draft' | 'final';
  as_of: string;
  planned_publish: string;
  published_at: string | null;
  previous: string | null;
  url: string;
  population: number;
  levels: HaidReleaseLevelOut[];
  relations: typeof HAID_RELATIONS;
  boundaries: typeof HAID_BOUNDARIES;
  anchors: HaidRelease['anchors'];
  overlap: HaidRelease['overlap'];
  payment: HaidRelease['release']['payment'];
  certainty_labels_ja: typeof HAID_CERTAINTY_JA;
  grade_labels_ja: typeof HAID_GRADE_JA;
  /** Anchors still marked placeholder — non-empty only for a draft. */
  placeholder_anchors: string[];
}

export interface HaidLatestPayload extends HaidReleasePayload {
  releases: string[];
}

