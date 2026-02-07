export interface Page {
  path: string;
  title: string;
  description?: string;
  lastModified?: string;
  deliveryMode: 'static' | 'generative' | 'hybrid';
  blocks?: Block[];
}

export interface Block {
  type: string;
  content: string;
  sectionStyle?: string;
  generativeZone?: boolean;
  metadata?: BlockMetadata;
}

export interface BlockMetadata {
  whenToUse?: string;
  dataRequirements?: string[];
  guardrails?: string[];
  audienceFit?: string[];
  engagementScore?: number;
  conversionScore?: number;
}

export interface Asset {
  path: string;
  name: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  altText?: string;
  tags?: string[];
  colors?: string[];
  lastModified?: string;
}

export interface DAListItem {
  name: string;
  path: string;
  lastModified?: string;
  ext?: string;
  isFolder: boolean;
}

export interface DASource {
  path: string;
  content: string;
  contentType: string;
  lastModified?: string;
}

export interface PageVersion {
  id: string;
  path: string;
  timestamp: string;
  user?: string;
  label?: string;
}
