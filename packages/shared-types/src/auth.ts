export interface User {
  id: string;
  githubId?: string;
  imsId?: string;
  email: string;
  name: string;
  avatarUrl?: string;
  preferences: UserPreferences;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  theme?: 'light' | 'dark' | 'system';
  expertiseLevel?: 'beginner' | 'intermediate' | 'expert';
  defaultView?: 'tree' | 'column' | 'list';
}

export interface Org {
  id: string;
  name: string;
  slug: string;
  githubOrg?: string;
  settings: OrgSettings;
  createdAt: string;
  updatedAt: string;
}

export interface OrgSettings {
  defaultDeliveryMode?: DeliveryMode;
  aiEnabled?: boolean;
}

export interface OrgMember {
  orgId: string;
  userId: string;
  role: 'admin' | 'author' | 'reviewer';
}

export interface Session {
  id: string;
  userId: string;
  orgId: string;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
}

export interface Project {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  daOrg: string;
  daRepo: string;
  githubOrg?: string;
  githubRepo?: string;
  deliveryConfig: DeliveryConfig;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryConfig {
  defaultMode: DeliveryMode;
}

export type DeliveryMode = 'static' | 'generative' | 'hybrid';

export interface AuthProvider {
  getAuthUrl(state: string): string;
  exchangeCode(code: string): Promise<UserProfile>;
  refreshToken?(token: string): Promise<string>;
}

export interface UserProfile {
  providerId: string;
  email: string;
  name: string;
  avatarUrl?: string;
}
