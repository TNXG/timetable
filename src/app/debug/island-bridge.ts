import { Capacitor, registerPlugin } from "@capacitor/core";


export interface IslandDiagnostics {
  permission: string;
  posted: boolean;
  message: string;
  details: string[];
  androidVersion: number;
  liveSupported: boolean;
  focusModuleActive: boolean;
  moduleHandshake: boolean;
  moduleSettingsHook: boolean;
  moduleAuthHook: boolean;
  moduleVersion: number;
  moduleReason: string;
  checkedAt: number;
  focusPayloadPresent: boolean;
  promotedDeclared: boolean;
  canPostPromoted: boolean | null;
  notificationPromotable: boolean | null;
  promoted: boolean | null;
  notificationsEnabled: boolean;
  channelEnabled: boolean | null;
  channelId: string;
  channelName: string;
}

interface IslandDebugPlugin {
  inspect: () => Promise<IslandDiagnostics>;
  requestPermission: () => Promise<IslandDiagnostics>;
  openPromotedSettings: () => Promise<IslandDiagnostics>;
  send: (options: { updated: boolean }) => Promise<IslandDiagnostics>;
  cancel: () => Promise<IslandDiagnostics>;
}

const plugin = registerPlugin<IslandDebugPlugin>("TtIslandDebug");

export function islandDebugAvailable(): boolean {
  return Capacitor.getPlatform() === "android" && Capacitor.isPluginAvailable("TtIslandDebug");
}

function nativeCall(call: () => Promise<IslandDiagnostics>): Promise<IslandDiagnostics> {
  if (!islandDebugAvailable())
    return Promise.reject(new Error("仅支持已注册超级岛调试插件的 Android 应用，浏览器不支持"));
  return call();
}

export const islandDebug: IslandDebugPlugin = {
  inspect: () => nativeCall(() => plugin.inspect()),
  requestPermission: () => nativeCall(() => plugin.requestPermission()),
  openPromotedSettings: () => nativeCall(() => plugin.openPromotedSettings()),
  send: options => nativeCall(() => plugin.send(options)),
  cancel: () => nativeCall(() => plugin.cancel()),
};
