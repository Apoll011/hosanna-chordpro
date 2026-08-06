export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "leader" | "musician";
}

export interface LoginParams {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface CreateMusicianTokenParams {
  name: string;
  expiresAt?: string;
  allowedServices?: string[];
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  song_number?: number;
  content: string; // ChordPro text format
  folderId?: string | null;
  path: string; // e.g., "Hymns/Amazing Grace.pro" or "Amazing Grace.pro"
  tags: string[];
  createdAt?: string;
  updatedAt: string;
}

export interface ParsedSong extends Song {
  folder: string; // e.g. "Worship" or "" (root)
  fileName: string; // e.g. "Digno_es_Tu.chopro"
  metadata: {
    title?: string;
    subtitle?: string;
    artist?: string;
    composer?: string;
    copyright?: string;
    album?: string;
    key?: string;
    originalKey?: string;
    tempo?: string;
    time?: string;
    capo?: string;
    songNumber?: string;
    youtube?: string;
    ccli?: string;
    duration?: string;
    [key: string]: string | undefined;
  };
}

export interface SongsResponse {
  songs: Song[];
  total: number;
  page: number;
  totalPages: number;
}

export interface Folder {
  id: string;
  name: string;
  parentId?: string | null;
  songCount?: number;
  folderCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface FoldersResponse {
  folders: Folder[];
  rootSongsCount: number;
}

export interface ServiceElement {
  id: string;
  type:
    | "welcome"
    | "scripture"
    | "message"
    | "reading"
    | "announcement"
    | "custom"
    | "song"
    | string;
  title: string;
  content?: string;
  position?: number;
  songId?: string;
  notes?: string;
  passage?: string;
  duration?: number;
}

export interface Service {
  id: string;
  name: string;
  date: string;
  archived: boolean;
  notes?: string; // Service-wide planning notes
  elements?: ServiceElement[];
  createdAt?: string;
  updatedAt?: string;
}

export interface MusicianToken {
  id: string;
  name: string;
  token?: string; // Only present in create/regenerate response
  tokenPreview: string;
  status: "active" | "revoked" | "expired";
  expiresAt: string;
  revokedAt?: string | null;
  lastUsedAt?: string | null;
  allowedServices: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ServerSettings {
  id: string;
  serverName: string;
  defaultKey: string;
  syncIntervalSeconds: number;
  allowPublicRead: boolean;
  autoBackupEnabled: boolean;
  maxUploadMB: number;
  showChordsDefault?: boolean;
  updatedAt: string;
}

export interface AdminUser {
  id: string;
  tenantId?: string;
  email: string;
  name: string;
  role: string;
  isApproved: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface RegisterTenantParams {
  tenantName: string;
  tenantSlug: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}

export interface EditTenantParams {
  logo?: string;
  name?: string;
  active?: boolean;
}

export interface RegisterUserParams {
  tenantSlug: string;
  name: string;
  email: string;
  password: string;
}

export interface CreateAdminParams {
  email: string;
  password: string;
  name: string;
  role?: string;
}

export interface SyncStatusResponse {
  versionHash: string;
  timestamp: string;
  timestamps: {
    songs: string;
    folders: string;
    services: string;
    musicians: string;
    settings: string;
    admins: string;
  };
}

export type PrintModelType = "service" | "folder" | "song";

export interface Template {
  id: string;
  model: PrintModelType;
  name: string;
  description: string;
  defaultSettings: Record<string, any>;
}

export interface UpdateTemplateSettings {
  model: PrintModelType;
  templateId: string;
  settings: Record<string, any>;
}

export interface Templates {
  activeSettings: {
    service: {
      id: string;
      config: Record<string, any>;
    };
    folder: {
      id: string;
      config: Record<string, any>;
    };
    song: {
      id: string;
      config: Record<string, any>;
    };
  };
  registry: Template[];
}

export interface GetSongsParams {
  search?: string;
  folder?: string;
  sortBy?: "title" | "artist" | "updatedAt";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
  key?: string;
  tag?: string;
  searchFields?: {
    title: boolean;
    artist: boolean;
    content: boolean;
    tags: boolean;
  };
}
