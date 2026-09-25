import { useSyncExternalStore } from 'react'
import { Capacitor } from '@capacitor/core'
import { Store, localStoragePersistence } from '../domain/store'
import { createSqlitePersistence } from '../domain/persistence/sqlite'

export function useStore() {
  return useSyncExternalStore(
    (fn) => store.subscribe(fn),
    () => store.state,
  )
}
 
export let store: Store

/** 实际用上的持久化后端：SQLite 建不起来时退回 localStorage（调试页读） */
export let persistenceKind: 'sqlite' | 'localStorage' | '' = ''

export async function initStore(): Promise<Store> {
  if (store) return store
  if (Capacitor.isNativePlatform()) {
    try {
      store = new Store(await createSqlitePersistence())
      persistenceKind = 'sqlite'
      return store
    } catch (e) {
      console.error('sqlite init failed, falling back to localStorage', e)
    }
  }
  store = new Store(localStoragePersistence)
  persistenceKind = 'localStorage'
  return store
}
