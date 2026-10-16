import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, reactive } from "vue";
import { useSplitPaneConfig } from "./useSplitPaneConfig";

/** vi.mock 工厂（hoisted）共享的可变桩：内存存储 / PATCH 调用记录 / store 桩 */
const mocks = vi.hoisted(() => ({
  storage: new Map<string, unknown>(),
  setSiteConfig: vi.fn(),
  siteStore: null as { config: Record<string, unknown> } | null
}));

vi.mock("responsive-storage", () => ({
  // hook 显式 stringify 写入、getData 自动 parse 读取，与真实运行时行为对齐；
  // getData(key, nameSpace) 与 set(全键) 的键拼接口径同真实库（nameSpace+key）
  default: {
    getData: (key: string, nameSpace?: string) => {
      const raw = mocks.storage.get(`${nameSpace ?? ""}${key}`);
      return typeof raw === "string" ? JSON.parse(raw) : raw;
    },
    set: (key: string, val: unknown) => {
      mocks.storage.set(key, val);
    }
  }
}));

vi.mock("@/api/config", () => ({
  configApi: { setSiteConfig: mocks.setSiteConfig }
}));

vi.mock("@/store/utils", () => ({
  responsiveStorageNameSpace: () => "responsive-"
}));

vi.mock("@/store/modules/siteConfig", () => ({
  useSiteConfigStoreHook: () => mocks.siteStore
}));

const STORAGE_FULL_KEY = "responsive-splitPanes";

/** 在真实组件实例内挂载 hook（onBeforeUnmount/watch 需要组件上下文） */
function mountHook(
  pageKey: string,
  options: { defaultPercent: number; minPercent: number }
) {
  let api: ReturnType<typeof useSplitPaneConfig> | null = null;
  const Comp = defineComponent({
    setup() {
      api = useSplitPaneConfig(pageKey, options);
      return () => h("div");
    }
  });
  const app = createApp(Comp);
  app.mount(document.createElement("div"));
  return { api: api!, unmount: () => app.unmount() };
}

const readLocalMap = (): Record<string, number> =>
  JSON.parse(mocks.storage.get(STORAGE_FULL_KEY) as string);

beforeEach(() => {
  vi.useFakeTimers();
  mocks.storage.clear();
  mocks.setSiteConfig.mockClear();
  mocks.siteStore = { config: reactive({}) };
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useSplitPaneConfig", () => {
  it("本地缓存优先：初始化采用本地已保存的比例", () => {
    mocks.storage.set(STORAGE_FULL_KEY, JSON.stringify({ "system/user": 30 }));
    const { api } = mountHook("system/user", {
      defaultPercent: 20,
      minPercent: 10
    });
    expect(api.percent.value).toBe(30);
  });

  it("本地越界值被 clamp 到 minPercent 边界", () => {
    mocks.storage.set(STORAGE_FULL_KEY, JSON.stringify({ systemUser: 99 }));
    const { api } = mountHook("systemUser", {
      defaultPercent: 20,
      minPercent: 10
    });
    expect(api.percent.value).toBe(90);
  });

  it("本地无值时用默认值，远端晚到后采用远端值（跨设备兜底）", async () => {
    const { api } = mountHook("system/user", {
      defaultPercent: 20,
      minPercent: 10
    });
    expect(api.percent.value).toBe(20);
    (mocks.siteStore!.config as Record<string, unknown>).SplitPanes = {
      "system/user": 35
    };
    await nextTick();
    expect(api.percent.value).toBe(35);
  });

  it("远端权威：本机旧缓存被服务器新值覆盖并回写本地（跨设备同步）", async () => {
    mocks.storage.set(STORAGE_FULL_KEY, JSON.stringify({ "system/user": 30 }));
    const { api } = mountHook("system/user", {
      defaultPercent: 20,
      minPercent: 10
    });
    // 服务器新值（另一设备保存）晚到
    (mocks.siteStore!.config as Record<string, unknown>).SplitPanes = {
      "system/user": 35
    };
    await nextTick();
    expect(api.percent.value).toBe(35);
    // 同时回写本地，下次刷新首帧即新值
    expect(readLocalMap()).toEqual({ "system/user": 35 });
  });

  it("挂载时服务器值直接覆盖本地旧缓存（刷新即见新值）", () => {
    mocks.storage.set(STORAGE_FULL_KEY, JSON.stringify({ "system/user": 30 }));
    (mocks.siteStore!.config as Record<string, unknown>).SplitPanes = {
      "system/user": 45
    };
    const { api } = mountHook("system/user", {
      defaultPercent: 20,
      minPercent: 10
    });
    expect(api.percent.value).toBe(45);
    expect(readLocalMap()).toEqual({ "system/user": 45 });
  });

  it("用户拖拽后（待 PATCH 期间）远端旧值不覆盖本地新值", async () => {
    const { api } = mountHook("system/user", {
      defaultPercent: 20,
      minPercent: 10
    });
    api.handleDragEnd(60);
    // 远端旧值晚到，不得把刚拖的值拉回去
    (mocks.siteStore!.config as Record<string, unknown>).SplitPanes = {
      "system/user": 25
    };
    await nextTick();
    expect(api.percent.value).toBe(60);
  });

  it("远端值为非 number（脏数据）时不应用", async () => {
    const { api } = mountHook("system/user", {
      defaultPercent: 20,
      minPercent: 10
    });
    (mocks.siteStore!.config as Record<string, unknown>).SplitPanes = {
      "system/user": "60"
    };
    await nextTick();
    expect(api.percent.value).toBe(20);
  });

  it("拖拽结束：clamp 后本地立即落盘并合并其他页面键，store 快照同步", () => {
    mocks.storage.set(STORAGE_FULL_KEY, JSON.stringify({ "system/menu": 54 }));
    const { api } = mountHook("system/user", {
      defaultPercent: 20,
      minPercent: 10
    });
    api.handleDragEnd(95);
    expect(api.percent.value).toBe(90);
    expect(readLocalMap()).toEqual({ "system/menu": 54, "system/user": 90 });
    // store.config 是主题整包保存的数据源，必须同步 SplitPanes，否则被旧值回滚
    expect(mocks.siteStore!.config.SplitPanes).toEqual({
      "system/menu": 54,
      "system/user": 90
    });
  });

  it("PATCH 远端 debounce：窗口内多次拖拽只发一次，载荷为最终值", async () => {
    const { api } = mountHook("system/user", {
      defaultPercent: 20,
      minPercent: 10
    });
    api.handleDragEnd(30);
    await vi.advanceTimersByTimeAsync(100);
    api.handleDragEnd(40);
    await vi.advanceTimersByTimeAsync(100);
    api.handleDragEnd(50);
    expect(mocks.setSiteConfig).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(800);
    expect(mocks.setSiteConfig).toHaveBeenCalledTimes(1);
    expect(mocks.setSiteConfig).toHaveBeenCalledWith({
      SplitPanes: { "system/user": 50 }
    });
  });

  it("拖完立刻卸载组件：待保存变更立即落盘，不丢配置", async () => {
    const { api, unmount } = mountHook("system/user", {
      defaultPercent: 20,
      minPercent: 10
    });
    api.handleDragEnd(44);
    unmount();
    expect(mocks.setSiteConfig).toHaveBeenCalledTimes(1);
    expect(mocks.setSiteConfig).toHaveBeenCalledWith({
      SplitPanes: { "system/user": 44 }
    });
    expect(readLocalMap()).toEqual({ "system/user": 44 });
  });
});
