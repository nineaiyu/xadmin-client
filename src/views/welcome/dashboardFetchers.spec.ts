import { flushPromises } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  userLoginTotal: vi.fn(),
  userTotal: vi.fn(),
  userRegisterTrend: vi.fn(),
  userLoginTrend: vi.fn(),
  userActive: vi.fn(),
  todayOperateTotal: vi.fn(),
  operateLogList: vi.fn()
}));

vi.mock("@/api/system/dashboard", () => ({
  getDashBoardUserLoginTotalApi: () => api.userLoginTotal(),
  getDashBoardUserTotalApi: () => api.userTotal(),
  getDashBoardUserRegisterTrendApi: () => api.userRegisterTrend(),
  getDashBoardUserLoginTrendApi: () => api.userLoginTrend(),
  getDashBoardUserActiveApi: () => api.userActive(),
  getDashBoardTodayOperateTotalApi: () => api.todayOperateTotal()
}));
vi.mock("@/api/audit/logs/operation", () => ({
  operationLogApi: { list: () => api.operateLogList() }
}));

import { createDashboardFetchers } from "./dashboardFetchers";
import { createDashboardState } from "./dashboardState";

const t = (key: string) => key;

const resolveWith = (scopeLimited: boolean) => {
  const payload = {
    code: 1000,
    detail: "",
    percent: 0,
    count: 0,
    results: [],
    scope_limited: scopeLimited
  };
  api.userLoginTotal.mockResolvedValue(payload);
  api.userTotal.mockResolvedValue(payload);
  api.userRegisterTrend.mockResolvedValue({
    code: 1000,
    data: [],
    scope_limited: scopeLimited
  });
  api.userLoginTrend.mockResolvedValue({
    code: 1000,
    data: [],
    scope_limited: scopeLimited
  });
  api.userActive.mockResolvedValue({
    code: 1000,
    data: [[1, 0, 0]],
    scope_limited: scopeLimited
  });
  api.todayOperateTotal.mockResolvedValue(payload);
  api.operateLogList.mockResolvedValue({ code: 1000, data: { results: [] } });
};

const runAll = async () => {
  const state = createDashboardState(t);
  const fetchers = createDashboardFetchers({ t, state });
  fetchers.getUserTotal();
  fetchers.getUserLoginTotal();
  fetchers.getUserLoginList();
  fetchers.getUserRegisterList();
  fetchers.getUserActiveList();
  fetchers.getTodayOperateTotal();
  await flushPromises();
  return state;
};

describe("首页统计数据权限提示", () => {
  beforeEach(() => {
    Object.values(api).forEach(fn => fn.mockReset());
    resolveWith(false);
  });

  it("无数据授权（scope_limited=true）时置位提示", async () => {
    resolveWith(true);
    const state = await runAll();
    expect(state.scopeLimited.value).toBe(true);
  });

  it("有数据授权但真实为 0 时不误报", async () => {
    const state = await runAll();
    expect(state.scopeLimited.value).toBe(false);
  });

  it("初始预分配四档活跃用户卡，数据到达后原位回填", async () => {
    const state = createDashboardState(t);
    expect(state.userActiveList.value.map(item => item.value[0])).toEqual([
      1, 3, 7, 30
    ]);
    expect(
      state.userActiveList.value.every(
        item => item.value[1] === 0 && item.value[2] === 0
      )
    ).toBe(true);

    api.userActive.mockResolvedValue({
      code: 1000,
      data: [
        [1, 2, 3],
        [3, 4, 5],
        [7, 6, 7],
        [30, 8, 9]
      ],
      scope_limited: false
    });
    const fetchers = createDashboardFetchers({ t, state });
    fetchers.getUserActiveList();
    await flushPromises();
    expect(state.userActiveList.value.map(item => item.value)).toEqual([
      [1, 2, 3],
      [3, 4, 5],
      [7, 6, 7],
      [30, 8, 9]
    ]);
  });
});
