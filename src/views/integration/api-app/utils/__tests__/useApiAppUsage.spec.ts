import { describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";

const mocks = vi.hoisted(() => ({
  stats: vi.fn(),
  message: vi.fn()
}));

vi.mock("@/api/identity/open", () => ({
  apiApplicationApi: { stats: mocks.stats }
}));
vi.mock("@/utils/message", () => ({ message: mocks.message }));

import { useApiAppUsage, USAGE_DAY_OPTIONS } from "../useApiAppUsage";

type Usage = Awaited<ReturnType<typeof mocks.stats>>;

const row = { pk: 9, name: "订单同步" } as never;

const usagePayload = (total: number) => ({
  code: 1000,
  data: {
    total,
    failed: 0,
    avg_duration: 0.12,
    daily: [],
    top_paths: [],
    status_codes: [],
    quota: { used_today: 1, daily_quota: 100, alert_percent: 80 }
  }
});

describe("useApiAppUsage", () => {
  it("openUsage 打开抽屉并拉取默认 7 天窗口", async () => {
    mocks.stats.mockResolvedValue(usagePayload(42));
    const usage = useApiAppUsage();

    expect(usage.usageVisible.value).toBe(false);
    await usage.openUsage(row);

    expect(usage.usageVisible.value).toBe(true);
    expect(mocks.stats).toHaveBeenCalledWith(9, 7);
    expect(usage.usage.value?.total).toBe(42);
    expect(usage.usageLoading.value).toBe(false);
  });

  it("切换统计窗口重拉数据；快速切换只采纳最后一次响应", async () => {
    let resolveSlow!: (value: Usage) => void;
    mocks.stats.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveSlow = resolve;
        })
    );
    const usage = useApiAppUsage();
    void usage.openUsage(row); // 默认 7 天请求挂起（不 await：该 Promise 要等慢响应）
    await Promise.resolve();

    mocks.stats.mockResolvedValueOnce(usagePayload(7));
    await usage.setUsageDays(30); // 慢请求未归时切窗口

    resolveSlow(usagePayload(1)); // 迟到的旧响应必须被丢弃
    await nextTick();
    await Promise.resolve();

    expect(usage.usageDays.value).toBe(30);
    expect(usage.usage.value?.total).toBe(7);
    expect(usage.usageLoading.value).toBe(false);
  });

  it("关闭抽屉清空上一次应用的数据（再次打开不残留）", async () => {
    mocks.stats.mockResolvedValue(usagePayload(3));
    const usage = useApiAppUsage();
    await usage.openUsage(row);
    expect(usage.usageRow.value).not.toBeNull();

    usage.usageVisible.value = false;
    await nextTick();

    expect(usage.usage.value).toBeNull();
    expect(usage.usageRow.value).toBeNull();
  });

  it("统计窗口候选覆盖 1/7/14/30 天", () => {
    expect(USAGE_DAY_OPTIONS).toEqual([1, 7, 14, 30]);
  });

  it("业务失败清空数据并提示原因", async () => {
    mocks.stats.mockResolvedValue({ code: 1001, detail: "无权查看" });
    const usage = useApiAppUsage();

    await usage.openUsage(row);

    expect(usage.usage.value).toBeNull();
    expect(mocks.message).toHaveBeenCalledWith("无权查看", { type: "warning" });
    expect(usage.usageLoading.value).toBe(false);
  });
});
