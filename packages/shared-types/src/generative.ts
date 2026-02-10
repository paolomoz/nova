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

// ── Block content shapes (JSON output from LLM → deterministic builders) ──

export interface HeroContent {
  headline: string;
  subheadline?: string;
  ctaText?: string;
  ctaUrl?: string;
  imageAlt?: string;
}

export interface CardsContent {
  cards: Array<{
    title: string;
    description: string;
    imageAlt?: string;
    linkText?: string;
    linkUrl?: string;
  }>;
}

export interface ColumnsContent {
  columns: Array<{
    headline?: string;
    text: string;
  }>;
}

export interface AccordionContent {
  items: Array<{
    question: string;
    answer: string;
  }>;
}

export interface TabsContent {
  tabs: Array<{
    label: string;
    content: string;
  }>;
}

export interface TableContent {
  headers: string[];
  rows: Array<string[]>;
}

export interface TestimonialsContent {
  testimonials: Array<{
    quote: string;
    author: string;
    role?: string;
  }>;
}

export interface CTAContent {
  headline: string;
  text?: string;
  buttonText: string;
  buttonUrl: string;
}

export type BlockContent =
  | HeroContent
  | CardsContent
  | ColumnsContent
  | AccordionContent
  | TabsContent
  | TableContent
  | TestimonialsContent
  | CTAContent;
