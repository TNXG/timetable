import type { IslandDiagnostics } from "./island-bridge";
import { App as CapApp } from "@capacitor/app";
import { useEffect, useRef, useState } from "react";
import { Page, PrimaryButton, TextAction, TopBar } from "../ui";
import { islandDebug, islandDebugAvailable } from "./island-bridge";
import { Failed, Group, KV } from "./kit";
import { copyText } from "../widgets";

const stateText = (value: boolean | null, yes: string, no: string) => value === null ? "未知 / 无活动通知" : value ? yes : no;

/** 独立测试通知，不读取课表或启动后台任务。 */
export function IslandPage({ onBack }: { onBack: () => void }) {
  const [diagnostics, setDiagnostics] = useState<IslandDiagnostics | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [copyState, setCopyState] = useState("");
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const available = islandDebugAvailable();
  const disabled = !available || !!busy;
  const canSend = !disabled && !!diagnostics && diagnostics.permission === "granted"
    && diagnostics.notificationsEnabled && diagnostics.channelEnabled !== false
    && (diagnostics.focusModuleActive || (diagnostics.liveSupported && diagnostics.promotedDeclared && diagnostics.canPostPromoted === true));

  async function run(label: string, action: () => Promise<IslandDiagnostics>) {
    if (inFlight.current || !available)
      return;
    inFlight.current = true;
    setBusy(label);
    setError("");
    try {
      const result = await action();
      if (mounted.current)
        setDiagnostics(result);
    }
    catch (cause) {
      if (mounted.current) {
        setDiagnostics(null);
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    }
    finally {
      inFlight.current = false;
      if (mounted.current)
        setBusy("");
    }
  }

  useEffect(() => {
    mounted.current = true;
    if (!available)
      return;
    void run("检查", islandDebug.inspect);
    const listener = CapApp.addListener("resume", () => void run("刷新状态", islandDebug.inspect));
    return () => {
      mounted.current = false;
      void listener.then(handle => handle.remove());
    };
  }, [available]);

  function send(updated: boolean) {
    if (canSend)
      void run(updated ? "更新通知" : "发送通知", () => islandDebug.send({ updated }));
  }

  return (
    <Page>
      <div className="flex-1 overflow-y-auto px-5 pb-10 scrollbar-none" aria-busy={!!busy}>
        <TopBar title="超级岛测试" onBack={onBack} />
        {!available && <Failed text="仅 Android 应用支持原生通知测试，浏览器不可用。" />}
        <Group title="检查与权限">
          <div className="flex flex-wrap gap-x-5 gap-y-3 py-4">
            <TextAction disabled={disabled} onClick={() => void run("检查", islandDebug.inspect)}>刷新</TextAction>
            <TextAction disabled={disabled} onClick={() => void run("通知授权", islandDebug.requestPermission)}>通知授权</TextAction>
            <TextAction disabled={disabled} onClick={() => void run("打开设置", islandDebug.openPromotedSettings)}>提升通知设置</TextAction>
          </div>
          <KV k="状态" v={busy || diagnostics?.message || "待检查"} />
          <div className="pb-3 text-[12px] tabular-nums text-(--c-ink4)" role="status">{diagnostics ? `检查于 ${new Date(diagnostics.checkedAt).toLocaleTimeString("zh-CN", { hour12: false })}` : "尚未检查"}</div>
        </Group>
        <Group title="课程实时通知">
          <KV k="路径" v={!diagnostics ? "待检查" : diagnostics.focusModuleActive ? "小米超级岛" : diagnostics.liveSupported ? "Live Updates" : "不支持"} />
          <div className="flex items-center justify-between gap-3 py-4">
            <TextAction disabled={!canSend || !diagnostics?.posted} onClick={() => send(true)}>更新</TextAction>
            <TextAction disabled={disabled} tone="danger" onClick={() => void run("取消通知", islandDebug.cancel)}>取消</TextAction>
          </div>
        </Group>
        {error && <div role="alert"><Failed text={error} /></div>}
        <div aria-live="polite">
          {diagnostics && (
            <Group title="诊断">
              <details>
                <summary className="cursor-pointer py-3.5 text-[13px] font-semibold text-(--c-ink)">详细状态</summary>
                <KV k="模块握手" v={diagnostics.moduleHandshake ? "已连接" : "未连接"} />
                <KV k="资格检查" v={diagnostics.moduleSettingsHook ? "就绪" : "未就绪"} />
                <KV k="鉴权回调" v={diagnostics.moduleAuthHook ? "就绪" : "未就绪"} />
              <KV k="Android API" v={String(diagnostics.androidVersion)} />
              <KV k="通知权限" v={diagnostics.permission} />
              <KV k="通知总开关" v={diagnostics.notificationsEnabled ? "开启" : "关闭"} />
              <KV k="通知渠道" v={diagnostics.channelName} sub={diagnostics.channelId} />
              <KV k="渠道开关" v={stateText(diagnostics.channelEnabled, "开启", "关闭")} />
              <KV k="Live Updates" v={diagnostics.liveSupported ? "API 支持" : "API 不支持"} />
              <KV k="提升权限声明" v={diagnostics.promotedDeclared ? "已声明" : "缺失"} />
              <KV k="提升通知开关" v={stateText(diagnostics.canPostPromoted, "允许", "不允许")} />
              <KV k="通知提升特征" v={stateText(diagnostics.notificationPromotable, "满足", "不满足")} />
              <KV k="系统提升标记" v={stateText(diagnostics.promoted, "已提升", "未提升")} />
              <KV k="通知提交" v={diagnostics.posted ? "已提交 / 活动中" : "无活动通知"} />
              <KV k="小米焦点参数" v={diagnostics.focusPayloadPresent ? "活动通知已携带" : "活动通知未携带"} />
              <KV k="详情" v={`${diagnostics.details.length} 项`} sub={diagnostics.details.join("\n")} />
              </details>
              <div className="flex items-center justify-between gap-3 py-4"><TextAction onClick={() => void copyText(JSON.stringify(diagnostics, null, 2)).then(ok => setCopyState(ok ? "已复制" : "复制失败"))}>复制诊断</TextAction><span role="status" className="text-[12px] text-(--c-ink4)">{copyState}</span></div>
            </Group>
          )}
        </div>
        <div className="mt-6">
          <PrimaryButton disabled={!canSend} onClick={() => send(false)}>发送测试通知</PrimaryButton>
        </div>
      </div>
    </Page>
  );
}
