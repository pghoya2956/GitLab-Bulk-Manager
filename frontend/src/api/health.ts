import axios from 'axios';

// Types
export interface ConnectionHealth {
  status: 'healthy' | 'unhealthy';
  latencyMs: number | null;
  gitlabVersion: string | null;
  gitlabRevision?: string | null;
  error?: string;
}

export interface UserHealth {
  status: 'healthy' | 'unhealthy';
  username?: string;
  name?: string;
  email?: string;
  isAdmin?: boolean;
  avatarUrl?: string;
  error?: string;
}

export interface StatsHealth {
  status: 'healthy' | 'unhealthy';
  projectCount?: number;
  groupCount?: number;
  error?: string;
}

export interface RateLimitHealth {
  status: 'healthy' | 'unhealthy' | 'unknown';
  limit: number | null;
  remaining: number | null;
  resetInSeconds: number | null;
  used: number | null;
  usagePercent: number | null;
  error?: string;
}

export interface SessionHealth {
  status: 'healthy' | 'unhealthy';
  gitlabUrl?: string;
  expiresInMinutes: number | null;
  isAuthenticated?: boolean;
  error?: string;
}

export interface QuickHealth {
  connection: ConnectionHealth;
  session: SessionHealth;
}

// Cache configuration
const CACHE_TTL = 30 * 1000; // 30초

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache: {
  connection?: CacheEntry<ConnectionHealth>;
  user?: CacheEntry<UserHealth>;
  stats?: CacheEntry<StatsHealth>;
  rateLimit?: CacheEntry<RateLimitHealth>;
  session?: CacheEntry<SessionHealth>;
} = {};

function isCacheValid<T>(entry: CacheEntry<T> | undefined): entry is CacheEntry<T> {
  return !!entry && Date.now() - entry.timestamp < CACHE_TTL;
}

// API Functions
export async function fetchConnectionHealth(useCache = true): Promise<ConnectionHealth> {
  if (useCache && isCacheValid(cache.connection)) {
    return cache.connection.data;
  }

  const response = await axios.get<ConnectionHealth>('/api/health/connection');
  cache.connection = { data: response.data, timestamp: Date.now() };
  return response.data;
}

export async function fetchUserHealth(useCache = true): Promise<UserHealth> {
  if (useCache && isCacheValid(cache.user)) {
    return cache.user.data;
  }

  const response = await axios.get<UserHealth>('/api/health/user');
  cache.user = { data: response.data, timestamp: Date.now() };
  return response.data;
}

export async function fetchStatsHealth(useCache = true): Promise<StatsHealth> {
  if (useCache && isCacheValid(cache.stats)) {
    return cache.stats.data;
  }

  const response = await axios.get<StatsHealth>('/api/health/stats');
  cache.stats = { data: response.data, timestamp: Date.now() };
  return response.data;
}

export async function fetchRateLimitHealth(useCache = true): Promise<RateLimitHealth> {
  if (useCache && isCacheValid(cache.rateLimit)) {
    return cache.rateLimit.data;
  }

  const response = await axios.get<RateLimitHealth>('/api/health/rate-limit');
  cache.rateLimit = { data: response.data, timestamp: Date.now() };
  return response.data;
}

export async function fetchSessionHealth(useCache = true): Promise<SessionHealth> {
  if (useCache && isCacheValid(cache.session)) {
    return cache.session.data;
  }

  const response = await axios.get<SessionHealth>('/api/health/session');
  cache.session = { data: response.data, timestamp: Date.now() };
  return response.data;
}

export async function fetchQuickHealth(): Promise<QuickHealth> {
  const response = await axios.get<QuickHealth>('/api/health/quick');
  return response.data;
}

// 캐시 무효화
export function invalidateHealthCache(): void {
  cache.connection = undefined;
  cache.user = undefined;
  cache.stats = undefined;
  cache.rateLimit = undefined;
  cache.session = undefined;
}

// 전체 상태를 병렬로 가져오기
export async function fetchAllHealth(useCache = false): Promise<{
  connection: ConnectionHealth;
  user: UserHealth;
  stats: StatsHealth;
  rateLimit: RateLimitHealth;
  session: SessionHealth;
}> {
  const [connection, user, stats, rateLimit, session] = await Promise.all([
    fetchConnectionHealth(useCache),
    fetchUserHealth(useCache),
    fetchStatsHealth(useCache),
    fetchRateLimitHealth(useCache),
    fetchSessionHealth(useCache),
  ]);

  return { connection, user, stats, rateLimit, session };
}
