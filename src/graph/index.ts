/**
 * src/graph/ — Layer 2 of the architecture: the knowledge graph.
 *
 * Public surface — views (src/views/) import from here. Nothing else does.
 *
 * See docs/architecture.md §2.2 for the layer contract.
 */

export { loadGraph } from './loader.js';

export type {
  KnowledgeGraph,
  // Node types
  OccupationNode,
  SectorNode,
  SkillNode,
  KnowledgeNode,
  AbilityNode,
  InterestNode,
  WorkValueNode,
  WorkCharacteristicNode,
  WorkActivityNode,
  // Shared shapes
  AiRiskScore,
  HueBand,
  OccupationStats,
  OccupationClassifications,
  OccupationDescription,
  DimensionLabel,
  // Edge types
  WeightedEdge,
  OccupationSkillEdge,
  OccupationKnowledgeEdge,
  OccupationAbilityEdge,
  OccupationInterestEdge,
  OccupationWorkValueEdge,
  OccupationWorkCharacteristicEdge,
  OccupationWorkActivityEdge,
} from './types.js';

export type {
  OccupationId,
  SectorId,
  SkillId,
  KnowledgeId,
  AbilityId,
  InterestId,
  WorkValueId,
  WorkCharacteristicId,
  WorkActivityId,
} from './ids.js';

export {
  asOccupationId,
  asSectorId,
  asSkillId,
  asKnowledgeId,
  asAbilityId,
  asInterestId,
  asWorkValueId,
  asWorkCharacteristicId,
  asWorkActivityId,
} from './ids.js';
