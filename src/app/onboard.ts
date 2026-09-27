import type { Route } from "./routes";
/** 首次引导的状态机：完成条件、退回时的同帧隐藏、去向分发、清除后的重置 */
import { useEffect, useRef, useState } from "react";
import { SLIDE } from "./ui";

const ONBOARD_KEY = "tt.onboarded.v1";

export function useOnboard(opts: {
  /** 已有课：引导视为完成 */
  hasCourses: boolean;
  /** 已有学期：snap 就绪 */
  hasSemester: boolean;
  /** 内页栈长度：非 0 时引导被内页盖住 */
  stackLen: number;
  /** 回到刚安装的样子：清栈回今天 */
  resetToHome: () => void;
  push: (r: Route) => void;
  openEduLogin: () => void;
}) {
  const { hasCourses, hasSemester, stackLen, resetToHome, push, openEduLogin } = opts;
  const [onboarded, setOnboarded] = useState(() => {
    try {
      return localStorage.getItem(ONBOARD_KEY) === "1" || hasCourses;
    } catch {
      return hasCourses;
    }
  });
  /** 引导选了去向时：内页从右侧推入盖住引导；内页退回后有课才算完成，否则回到引导 */
  const [onboardUnder, setOnboardUnder] = useState(false);
  /* 内页退回的同一帧就把引导隐藏（visibility），不等 effect，避免退场动画期间露出引导页 */
  const onboardDone = onboardUnder && stackLen === 0 && hasCourses;
  /** 完成判定：本地标记，或「内页退回且已有课」——后者在渲染期直接算，不在 effect 里同步落状态 */
  const onboardedNow = onboarded || onboardDone;
  const showOnboard = !onboardedNow || !hasSemester;
  const onboardBackRef = useRef<() => boolean>(() => false);

  useEffect(() => {
    if (!onboardUnder || stackLen > 0)
      return;
    if (!hasCourses) {
      /* 没有课就回到引导：等内页滑出后再升回顶层，否则会盖住退场动画 */
      const t = window.setTimeout(setOnboardUnder, SLIDE.duration * 1000, false);
      return () => window.clearTimeout(t);
    }
    try {
      localStorage.setItem(ONBOARD_KEY, "1");
    } catch {
      /* 忽略 */
    }
  }, [onboardUnder, stackLen, hasCourses]);

  const onOnboardDone = (ruleId: string | null) => {
    if (!ruleId) {
      try {
        localStorage.setItem(ONBOARD_KEY, "1");
      } catch {
        /* 忽略 */
      }
      setOnboarded(true);
      return;
    }
    setOnboardUnder(true);
    if (ruleId === "manual")
      push({ k: "manual" });
    else openEduLogin();
  };

  /* 清除完：回到刚安装的样子，重新走引导 */
  const eraseDone = () => {
    try {
      localStorage.removeItem(ONBOARD_KEY);
    } catch {
      /* 忽略 */
    }
    setOnboardUnder(false);
    setOnboarded(false);
    resetToHome();
  };

  return { onboarded: onboardedNow, onboardUnder, onboardDone, showOnboard, onboardBackRef, onOnboardDone, eraseDone };
}
