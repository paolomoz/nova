export interface ValueScore {
  id: string;
  projectId: string;
  path: string;
  audience?: string;
  situation?: string;
  outcome?: string;
  engagementScore: number;
  conversionScore: number;
  seoScore: number;
  cwvScore: number;
  compositeScore: number;
  sampleSize: number;
  updatedAt: string;
}

export interface TelemetryDaily {
  id: string;
  projectId: string;
  path: string;
  date: string;
  pageViews: number;
  lcpP75?: number;
  inpP75?: number;
  clsP75?: number;
  engagementCheckpoints: Record<string, number>;
  conversionEvents: number;
  isGenerated: boolean;
}

export interface BrandProfile {
  id: string;
  projectId: string;
  name: string;
  voice: BrandVoice;
  visual: BrandVisual;
  contentRules: ContentRules;
  designTokens: Record<string, string>;
}

export interface BrandVoice {
  tone?: string[];
  personality?: string;
  dos?: string[];
  donts?: string[];
}

export interface BrandVisual {
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  spacing?: string;
}

export interface ContentRules {
  guidelines?: string[];
  constraints?: string[];
  terminology?: Record<string, string>;
}
