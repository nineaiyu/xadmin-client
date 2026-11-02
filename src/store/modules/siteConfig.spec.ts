import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSiteConfigStoreHook } from "./siteConfig";
import { useAppStoreHook } from "./app";

/** vi.mock 工厂共享桩：PATCH 调用 / 提示调用 / 内存 storage */
const mocks = vi.hoisted(() => ({
  setSiteConfig: vi.fn(),
  getSiteConfig: vi.fn(),
  message: vi.fn(),
  storage: new Map<string, unknown>()
}));

vi.mock("@/api/config", () => ({
  configApi: {
    setSiteConfig: mocks.setSiteConfig,
    getSiteConfig: mocks.getSiteConfig,
    resetSiteConfig: vi.fn()
  }
}));

vi.mock("@/utils/message", () => ({
  message: mocks.message
}));

vi.mock("@/config", () => ({
  setConfig: vi.fn(),
  getConfig: () => ({ SidebarStatus: true, Layout: "vertical" }),
  responsiveStorageNameSpace: () => "responsive-"
}));

vi.mock("responsive-storage", () => ({
  default: {
    getData: (key: string, nameSpace?: string) =>
      mocks.storage.get(`${nameSpace ?? ""}${key}`),
    set: (key: string, val: unknown) => mocks.storage.set(key, val)
  }
}));

/** 与 injectResponsiveStorage 同形状的站点配置碎片（saveSiteConfig 的数据源） */
const seedStorage = () => {
  mocks.storage.set("responsive-locale", { locale: "zh" });
  mocks.storage.set("responsive-layout", {
    layout: "vertical",
    theme: "light",
    darkMode: false,
    sidebarStatus: true,
    epThemeColor: "#409EFF",
    themeColor: "light",
    themeMode: "light"
  });
  mocks.storage.set("responsive-configure", {
    grey: false,
    weak: false,
    hideTabs: false,
    hideFooter: true,
    showLogo: true,
    tagsStyle: "chrome",
    multiTagsCache: false,
    stretch: false
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  mocks.storage.clear();
  mocks.setSiteConfig.mockReset();
  mocks.getSiteConfig.mockReset();
  mocks.message.mockReset();
  mocks.setSiteConfig.mockResolvedValue({ code: 1000 });
  seedStorage();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("siteConfig 实时自动保存", () => {
  it("防抖：窗口内多次变更只发一次静默整包 PATCH", async () => {
    const store = useSiteConfigStoreHook();
    store.autoSaveSiteConfig();
    store.autoSaveSiteConfig();
    store.autoSaveSiteConfig();
    expect(mocks.setSiteConfig).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(600);
    expect(mocks.setSiteConfig).toHaveBeenCalledTimes(1);
    const payload = mocks.setSiteConfig.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(payload.Locale).toBe("zh");
    expect(payload.DarkMode).toBe(false);
    // 自动保存静默：不弹「项目配置保存成功」
    expect(mocks.message).not.toHaveBeenCalled();
  });

  it("无差异且没有待发保存时跳过自动保存（首屏回写不产生整包 PATCH）", () => {
    const store = useSiteConfigStoreHook();
    store.captureSyncedSnapshot();
    expect(store.shouldSkipAutoSave()).toBe(true);
  });

  it("保存待发/在途时禁止跳过；无本地差异时不发空 PATCH", async () => {
    const store = useSiteConfigStoreHook();
    store.captureSyncedSnapshot();
    // 模拟一次变更：此刻值仍与快照相等，但保存已排入防抖窗
    store.autoSaveSiteConfig();
    expect(store.autoSavePending).toBe(true);
    expect(store.shouldSkipAutoSave()).toBe(false);

    await vi.advanceTimersByTimeAsync(600);
    // 最小化载荷：没有差异就不发空请求（服务端已是这些值）
    expect(mocks.setSiteConfig).not.toHaveBeenCalled();
    // 保存完成：pending 复位，值未再变化 → 恢复「无差异跳过」
    expect(store.autoSavePending).toBe(false);
    expect(store.shouldSkipAutoSave()).toBe(true);
  });

  it("自动保存失败时提示一次，不静默丢配置", async () => {
    const configure = mocks.storage.get("responsive-configure") as Record<
      string,
      unknown
    >;
    mocks.storage.set("responsive-configure", {
      ...configure,
      hideTabs: true
    });
    mocks.setSiteConfig.mockRejectedValueOnce(new Error("network"));
    const store = useSiteConfigStoreHook();
    store.autoSaveSiteConfig();
    await vi.advanceTimersByTimeAsync(600);
    expect(mocks.message).toHaveBeenCalledTimes(1);
    expect(mocks.message.mock.calls[0][0]).toContain("自动保存失败");
  });

  it("手动保存成功弹提示（保留既有行为）", async () => {
    const configure = mocks.storage.get("responsive-configure") as Record<
      string,
      unknown
    >;
    mocks.storage.set("responsive-configure", {
      ...configure,
      hideTabs: true
    });
    const store = useSiteConfigStoreHook();
    await store.saveSiteConfig();
    expect(mocks.message).toHaveBeenCalledWith("项目配置保存成功", {
      type: "success"
    });
  });

  it("静默保存成功不弹提示（自动保存复用同一路径）", async () => {
    const store = useSiteConfigStoreHook();
    await store.saveSiteConfig(true);
    expect(mocks.message).not.toHaveBeenCalled();
  });
});

describe("siteConfig 站点配置完整性", () => {
  it("缺 Locale 时按注册表补默认值，不再整包 reject", async () => {
    mocks.getSiteConfig.mockResolvedValue({
      config: { Layout: "vertical", Theme: "light" } as never
    });
    const store = useSiteConfigStoreHook();
    await expect(store.getSiteConfig()).resolves.toMatchObject({
      Layout: "vertical"
    });
    expect(mocks.storage.get("responsive-locale")).toMatchObject({
      locale: "zh"
    });
  });

  it("非对象响应仍按失败处理", async () => {
    mocks.getSiteConfig.mockResolvedValue({ config: null as never });
    const store = useSiteConfigStoreHook();
    await expect(store.getSiteConfig()).rejects.toBeNull();
  });
});

describe("siteConfig 最小化 PATCH（并发管理员改动不被回滚）", () => {
  it("只提交本地实际变更的键，其他管理员改过的键不进入载荷", async () => {
    const store = useSiteConfigStoreHook();
    store.captureSyncedSnapshot();
    // 其他管理员在服务端改了站点标题 / Logo（本地存储没有这两个键的变更）
    // 本标签只把「选项卡风格」从 chrome 改成 card
    mocks.storage.set("responsive-configure", {
      ...(mocks.storage.get("responsive-configure") as Record<string, unknown>),
      hideTabs: true
    });
    await store.saveSiteConfig(true);
    expect(mocks.setSiteConfig).toHaveBeenCalledTimes(1);
    const payload = mocks.setSiteConfig.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(payload).toEqual({ HideTabs: true });
    // 全量载荷会携带的旧快照键（如 Title / LogoSource）不得出现
    expect(payload.Title).toBeUndefined();
    expect(payload.LogoSource).toBeUndefined();
  });

  it("保存后基线前移：改回原值只提交这一个键", async () => {
    const store = useSiteConfigStoreHook();
    store.captureSyncedSnapshot();
    const configure = mocks.storage.get("responsive-configure") as Record<
      string,
      unknown
    >;
    mocks.storage.set("responsive-configure", { ...configure, hideTabs: true });
    await store.saveSiteConfig(true);
    mocks.storage.set("responsive-configure", {
      ...configure,
      hideTabs: false
    });
    await store.saveSiteConfig(true);
    expect(mocks.setSiteConfig).toHaveBeenCalledTimes(2);
    expect(mocks.setSiteConfig.mock.calls[1][0]).toEqual({ HideTabs: false });
  });

  it("无本地变更时不发空 PATCH", async () => {
    const store = useSiteConfigStoreHook();
    store.captureSyncedSnapshot();
    await store.saveSiteConfig(true);
    expect(mocks.setSiteConfig).not.toHaveBeenCalled();
  });
});

describe("siteConfig 跨标签偏好同步", () => {
  it("收到其他标签的偏好后同步布局 store 并重捕快照", () => {
    const store = useSiteConfigStoreHook();
    mocks.storage.set("responsive-layout", {
      layout: "horizontal",
      sidebarStatus: false,
      theme: "dark"
    });
    store.applyRemotePreferences(["Layout", "SidebarStatus", "Theme"]);
    const app = useAppStoreHook();
    expect(app.layout).toBe("horizontal");
    expect(app.sidebar.opened).toBe(false);
    expect(store.syncedSnapshot?.layout).toMatchObject({
      layout: "horizontal",
      sidebarStatus: false
    });
    expect(store.syncedSnapshot?.locale).toEqual({ locale: "zh" });
  });
});

describe("siteConfig 面板级批量偏好落库（撤销 / 恢复站点默认共用）", () => {
  it("立即整包 PATCH 并弹自定义成功提示，同时捕获已同步快照", async () => {
    const store = useSiteConfigStoreHook();
    await store.persistPreferences("已撤销本次调整");
    expect(mocks.setSiteConfig).toHaveBeenCalledTimes(1);
    expect(mocks.message).toHaveBeenCalledWith("已撤销本次调整", {
      type: "success"
    });
    // 快照已同步：布局层常驻防抖监听据此判为无差异，不再重复 PATCH
    expect(store.syncedSnapshot).not.toBeNull();
    expect(store.syncedSnapshot?.configure).toMatchObject({
      tagsStyle: "chrome"
    });
  });

  it("落库失败弹失败提示，不抛错（调用方无需 catch）", async () => {
    const configure = mocks.storage.get("responsive-configure") as Record<
      string,
      unknown
    >;
    mocks.storage.set("responsive-configure", {
      ...configure,
      hideTabs: true
    });
    mocks.setSiteConfig.mockRejectedValueOnce(new Error("network"));
    const store = useSiteConfigStoreHook();
    await expect(
      store.persistPreferences("已撤销本次调整")
    ).resolves.toBeUndefined();
    expect(mocks.message).toHaveBeenCalledTimes(1);
    expect(mocks.message.mock.calls[0][0]).toContain("自动保存失败");
  });
});
