import { Capacitor } from "@capacitor/core";
import { useSyncExternalStore } from "react";
import { createSqlitePersistence } from "../domain/persistence/sqlite";
import { localStoragePersistence, Store } from "../domain/store";

/** 单例：initStore() 里异步建好，之后全应用只读它 */
// eslint-disable-next-line import/no-mutable-exports -- 懒初始化的模块单例，只在 initStore 里赋值
export let store: Store;

/** 实际用上的持久化后端：SQLite 建不起来时退回 localStorage（调试页读） */
// eslint-disable-next-line import/no-mutable-exports -- 同上，随 store 一起定下来
export let persistenceKind: "sqlite" | "localStorage" | "" = "";

export function useStore() {
  return useSyncExternalStore(
    fn => store.subscribe(fn),
    () => store.state,
  );
}

export async function initStore(): Promise<Store> {
  if (store)
    return store;
  if (Capacitor.isNativePlatform()) {
    try {
      store = new Store(await createSqlitePersistence());
      persistenceKind = "sqlite";
      return store;
    } catch (e) {
      console.error("sqlite init failed, falling back to localStorage", e);
    }
  }
  store = new Store(localStoragePersistence);
  persistenceKind = "localStorage";
  return store;
}
