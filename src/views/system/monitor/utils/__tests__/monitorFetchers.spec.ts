import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMock = vi.hoisted(() => ({
  overview: vi.fn(),
  services: vi.fn(),
  redisInfo: vi.fn(),
  celery: vi.fn(),
  slow: vi.fn(),
  taskHealth: vi.fn(),
  thresholds: vi.fn(),
  events: vi.fn()
}));

vi.mock("@/api/system/monitor", () => ({ monitorApi: apiMock }));

import { createMonitorState } from "../monitorState";
import { createMonitorFetchers } from "../monitorFetchers";

const ok = (data: unknown) => Promise.resolve({ code: 1000, data });

function stubAllOk() {
  apiMock.overview.mockImplementation(() =>
    ok({ live: null, latest: null, trend: [], health: null })
  );
  apiMock.services.mockImplementation(() => ok(null));
  apiMock.redisInfo.mockImplementation(() => ok({}));
  apiMock.celery.mockImplementation(() => ok({ workers: [], total: 0 }));
  apiMock.slow.mockImplementation(() => ok({ threshold: 1, results: [] }));
  apiMock.taskHealth.mockImplementation(() => ok(null));
  apiMock.thresholds.mockImplementation(() => ok(null));
  apiMock.events.mockImplementation(() =>
    ok({ results: [], counts: { firing: 0, total_24h: 0, resolved_24h: 0 } })
  );
}

describe("监控区块失败留痕", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubAllOk();
  });

  it("单个接口失败只标记该区块，并带出可读原因", async () => {
    apiMock.overview.mockRejectedValue({
      response: { data: { detail: "无监控查看权限" } }
    });
    const state = createMonitorState();
    await createMonitorFetchers(state).fetchAll();

    expect(state.sectionErrors.value.overview).toBe("无监控查看权限");
    expect(state.sectionErrors.value.services).toBeUndefined();
  });

  it("业务码失败（HTTP 200）同样标记区块且保留旧值", async () => {
    const state = createMonitorState();
    const previous = state.overview.value;
    apiMock.overview.mockResolvedValue({
      code: 1001,
      detail: "无监控查看权限",
      data: null
    });
    await createMonitorFetchers(state).fetchAll();

    expect(state.sectionErrors.value.overview).toBe("无监控查看权限");
    expect(state.overview.value).toBe(previous);
  });

  it("后续刷新成功时清除失败标记", async () => {
    apiMock.services.mockRejectedValueOnce(new Error("boom"));
    const state = createMonitorState();
    const fetchers = createMonitorFetchers(state);

    await fetchers.fetchAll();
    expect(state.sectionErrors.value.services).toBe("boom");

    await fetchers.fetchAll();
    expect(state.sectionErrors.value.services).toBeUndefined();
  });
});
