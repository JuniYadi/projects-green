export type CacheConfig = {
  ttl: number
}

export interface CacheStore {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T, ttl: number): Promise<void>
  del(key: string): Promise<void>
}

export interface GateStore {
  acquireLock(key: string, ttl: number): Promise<boolean>
  releaseLock(key: string): Promise<void>
}
