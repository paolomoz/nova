export interface IntentClassification {
  intentType: string;
  entities: string[];
  journeyStage: 'exploring' | 'comparing' | 'deciding' | 'supporting';
  confidence: number;
}

export interface ReasoningResult {
  selectedBlocks: SelectedBlock[];
  rationale: string;
  confidence: {
    intent: number;
    contentMatch: number;
  };
  followUpSuggestions?: string[];
}

export interface SelectedBlock {
  type: string;
  reason: string;
  sectionStyle?: string;
  dataRequirements?: Record<string, unknown>;
  priority: number;
}

export interface GenerativeConfig {
  id: string;
  projectId: string;
  pathPattern: string;
  deliveryMode: 'static' | 'generative' | 'hybrid';
  intentConfig: IntentConfig;
  confidenceThresholds: ConfidenceThresholds;
  signalConfig: SignalConfig;
  blockConstraints: BlockConstraints;
}

export interface IntentConfig {
  types: string[];
  customPrompts?: Record<string, string>;
}

export interface ConfidenceThresholds {
  minIntent: number;
  minContentMatch: number;
  fallbackBehavior: 'static' | 'generic' | 'error';
}

export interface SignalConfig {
  enabledSignals: string[];
  weights?: Record<string, number>;
}

export interface BlockConstraints {
  required?: string[];
  excluded?: string[];
  maxBlocks?: number;
  sequenceHints?: SequenceHint[];
}

export interface SequenceHint {
  block: string;
  position: 'early' | 'middle' | 'late';
  after?: string;
}

export interface BlockRule {
  id: string;
  name: string;
  category: string;
  triggers: TriggerCondition[];
  requires: string[];
  excludes: string[];
  enhances: string[];
  sequenceHints: SequenceHint[];
  contentGuidance?: string;
  priority: number;
}

export interface TriggerCondition {
  type: 'keyword' | 'intent' | 'signal' | 'audience';
  value: string;
}

export interface ModelPreset {
  reasoning: ModelConfig;
  content: ModelConfig;
  classification: ModelConfig;
}

export interface ModelConfig {
  provider: 'anthropic' | 'cerebras' | 'openai';
  model: string;
  maxTokens: number;
  temperature: number;
}

export type ModelRole = 'reasoning' | 'content' | 'classification';

export interface SSEEvent {
  event: string;
  data: Record<string, unknown>;
}

export interface SessionContext {
  previousQueries: QueryHistoryItem[];
  signals?: Signal[];
  profile?: VisitorProfile;
}

export interface QueryHistoryItem {
  query: string;
  intentType: string;
  timestamp: number;
}

export interface Signal {
  type: string;
  value: string;
  weight: number;
}

export interface VisitorProfile {
  segments?: string[];
  interests?: string[];
  journeyStage?: string;
}
