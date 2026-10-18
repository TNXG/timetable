import type { PluginListenerHandle } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
/** 跨日与对时：所有页面共用一个整分钟时钟，后台与无订阅时停止计时。 */
import { useSyncExternalStore } from "react";
import { nowMinutes, todayStr } from "../semester";

const listeners = new Set<() => void>();
let today = todayStr();
let now = nowMinutes();
let timer: number | undefined;
let resume: Promise<PluginListenerHandle> | undefined;
const getToday = () => today;
const getNow = () => now;

function checkClock() {
  window.clearTimeout(timer);
  timer = undefined;
  if (document.hidden || listeners.size === 0)
    return;
  const nextToday = todayStr();
  const nextNow = nowMinutes();
  if (nextToday !== today || nextNow !== now) {
    today = nextToday;
    now = nextNow;
    for (const listener of listeners)
      listener();
  }
  timer = window.setTimeout(checkClock, 60_000 - Date.now() % 60_000);
}

function subscribeClock(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    document.addEventListener("visibilitychange", checkClock);
    resume = CapApp.addListener("resume", checkClock);
    checkClock();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size !== 0)
      return;
    window.clearTimeout(timer);
    timer = undefined;
    document.removeEventListener("visibilitychange", checkClock);
    void resume?.then(handle => handle.remove());
    resume = undefined;
  };
}

/** 当前日期：跨零点、回前台、页面可见时重算。 */
export function useToday(): string {
  return useSyncExternalStore(subscribeClock, getToday);
}

/** 当前时刻（分）：整分钟刷新，回前台立即对时。 */
export function useNowMinutes(): number {
  return useSyncExternalStore(subscribeClock, getNow);
}
