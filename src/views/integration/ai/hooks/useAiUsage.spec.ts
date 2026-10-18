import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h } from "vue";
import { useAiUsage } from "./useAiUsage";

const { usageMock } = vi.hoisted(() => ({ usageMock: vi.fn() }));

vi.mock("@/api/ai/ai", () => ({
  aiAssistantApi: { usage: usageMock }
}));

/** 在真实组件实例内挂载 hook（onMounted/onActivated 需要生命周期上下文） */
function mountHook(days?: number) {
  let api: ReturnType<typeof useAiUsage> | null = null;
  const Comp = defineComponent({
    setup() {
      api = useAiUsage(days);
      return () => h("div");
    }
  });
  const app = createApp(Comp);
  app.mount(document.createElement("div"));
  return { api: api!, unmount: () => app.unmount() };
}

const summary = {
  days: 7,
  total_calls: 12,
  total_tokens: 1024,
  failed: 2,
  success: 10,
  success_rate: 83.3,
  avg_latency_ms: 320,
  p95_latency_ms: 900,
  latency_samples: 12,
  by_day: [],
  by_feature: [],
  by_track: [],
  by_profile: [],
  by_model: [],
  top_users: [],
  quota: { daily_calls: 0, daily_tokens: 0, concurrent_streams: 20 },
  stream_slots: 1
};

/** 等一个宏任务：让挂载时的异步 loadUsage（await）落定 */
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

beforeEach(() => {
  usageMock.mockReset();
  usageMock.mockResolvedValue({ code: 1000, data: summary });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useAiUsage", () => {
  it("挂载即拉取一次，缺省周期 7 天", async () => {
    const { api } = mountHook();
    await flush();
    expect(usageMock).toHaveBeenCalledTimes(1);
    expect(usageMock).toHaveBeenCalledWith(7);
    expect(api.usage.value?.total_calls).toBe(12);
  });

  it("显式周期入参透传（30 天）", async () => {
    const { api } = mountHook(30);
    await flush();
    expect(usageMock).toHaveBeenCalledWith(30);
    expect(api.usageDays.value).toBe(30);
  });

  it("切换周期只按新值重拉一次（单数据源口径）", async () => {
    const { api } = mountHook();
    await flush();
    await api.loadUsageWithDays(30);
    expect(usageMock).toHaveBeenLastCalledWith(30);
    expect(usageMock).toHaveBeenCalledTimes(2);
    expect(api.usageDays.value).toBe(30);
  });

  it("初始周期失败保留已渲染数据（重访刷新失败不打成空态）", async () => {
    const { api } = mountHook();
    await flush();
    expect(api.usage.value).not.toBeNull();

    usageMock.mockResolvedValue(null);
    await api.loadUsage();
    expect(api.usage.value).not.toBeNull();
  });

  it("切换周期失败清空，避免旧周期数据挂在新周期标题下", async () => {
    const { api } = mountHook();
    await flush();
    expect(api.usage.value).not.toBeNull();

    usageMock.mockResolvedValue(null);
    await api.loadUsageWithDays(30);
    expect(api.usage.value).toBeNull();
  });

  it("加载中状态在请求前后正确翻转", async () => {
    let resolve: (value: unknown) => void = () => undefined;
    usageMock.mockReturnValue(new Promise(r => (resolve = r)));
    const { api } = mountHook();
    expect(api.loading.value).toBe(true);
    resolve({ code: 1000, data: summary });
    await flush();
    expect(api.loading.value).toBe(false);
  });
});
