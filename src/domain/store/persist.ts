import { STATE_VERSION, hydrate, type State } from './state'

export interface Persistence {
  load(): State | null
  save(s: State): void
}

export const serializeState = (s: State): string => JSON.stringify(s, (_, v) => (typeof v === 'bigint' ? v.toString() : v))

/** 读回并迁移。结构版本升级时先把迁移前的原文交给 backup 留底，迁移出错还能找回 */
export function restoreState(raw: string, backup?: (json: string, fromVersion: number) => void): State {
  const parsed = JSON.parse(raw) as State
  const v = parsed.version ?? 1
  if (v < STATE_VERSION) backup?.(raw, v)
  return hydrate(parsed)
}

const KEY = 'timetable.v1'

export const localStoragePersistence: Persistence = {
  load() {
    try {
      const raw = localStorage.getItem(KEY)
      return raw ? restoreState(raw, (json, v) => localStorage.setItem(`${KEY}.bak.v${v}`, json)) : null
    } catch {
      return null
    }
  },
  save(s) {
    localStorage.setItem(KEY, serializeState(s))
  },
}

export const memoryPersistence = (): Persistence => {
  let mem: string | null = null
  return {
    load: () => (mem ? restoreState(mem) : null),
    save: (s) => {
      mem = serializeState(s)
    },
  }
}

