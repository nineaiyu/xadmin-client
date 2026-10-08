import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultFormState } from "./payload";

/** 内存版方案服务端桩：覆盖 CRUD 与同名覆盖语义（真实后端见 tests/unit/system/test_codegen_plan.py）。 */
const server = vi.hoisted(() => {
  type Row = {
    pk: string;
    name: string;
    payload: Record<string, unknown>;
    is_shared: boolean;
    created_time: string;
    updated_time: string;
  };
  const store: Row[] = [];
  let tick = 0;
  const nextTime = () => {
    tick += 1;
    return new Date(Date.UTC(2026, 0, 1, 0, 0, tick)).toISOString();
  };
  return { store, nextTime };
});

vi.mock("@/api/system/codegen", () => ({
  systemCodeGenApi: {
    planList: vi.fn(async () => ({
      code: 1000,
      detail: "",
      data: {
        total: server.store.length,
        results: server.store.map(row => ({ ...row }))
      }
    })),
    planSave: vi.fn(
      async (payload: {
        name: string;
        payload: Record<string, unknown>;
        is_shared?: boolean;
      }) => {
        const existing = server.store.find(row => row.name === payload.name);
        const now = server.nextTime();
        if (existing) {
          existing.payload = payload.payload;
          existing.is_shared = Boolean(payload.is_shared);
          existing.updated_time = now;
          return { code: 1000, detail: "", data: { ...existing } };
        }
        const row = {
          pk: `pk-${server.store.length + 1}`,
          name: payload.name,
          payload: payload.payload,
          is_shared: Boolean(payload.is_shared),
          created_time: now,
          updated_time: now
        };
        server.store.push(row);
        return { code: 1000, detail: "", data: { ...row } };
      }
    ),
    planRemove: vi.fn(async (pk: string) => {
      const index = server.store.findIndex(row => row.pk === pk);
      if (index >= 0) server.store.splice(index, 1);
      return { code: 1000, detail: "" };
    })
  }
}));

import { systemCodeGenApi } from "@/api/system/codegen";
import {
  exportPlan,
  importPlan,
  listPlans,
  removePlan,
  savePlan
} from "./plan-storage";

const state = () => ({ ...defaultFormState(), model: "demo.Book" });

beforeEach(() => {
  server.store.length = 0;
  vi.clearAllMocks();
});

describe("plan-storage", () => {
  it("保存并按时间倒序列出", async () => {
    await savePlan("方案A", state());
    await savePlan("方案B", state());
    const plans = await listPlans();
    expect(plans.map(plan => plan.name)).toEqual(["方案B", "方案A"]);
  });

  it("同名覆盖不重复", async () => {
    await savePlan("方案A", state());
    await savePlan("方案A", { ...state(), with_tests: true });
    const plans = await listPlans();
    expect(plans).toHaveLength(1);
    expect(plans[0].state.with_tests).toBe(true);
  });

  it("删除方案", async () => {
    await savePlan("方案A", state());
    const [plan] = await listPlans();
    const after = await removePlan(plan.pk);
    expect(after).toEqual([]);
  });

  it("空名保存抛错", async () => {
    await expect(savePlan("  ", state())).rejects.toThrow();
  });

  it("导出再导入还原（同名覆盖）", async () => {
    await savePlan("方案A", { ...state(), menu_icon: "ep:grid" });
    const [plan] = await listPlans();
    const json = exportPlan(plan);
    await removePlan(plan.pk);
    expect(await importPlan(json)).toBe(1);
    expect((await listPlans())[0].state.menu_icon).toBe("ep:grid");
  });

  it("共享开关随方案保存", async () => {
    await savePlan("共享方案", state(), true);
    await savePlan("私有方案", state());
    const plans = await listPlans();
    expect(plans.find(plan => plan.name === "共享方案")?.isShared).toBe(true);
    expect(plans.find(plan => plan.name === "私有方案")?.isShared).toBe(false);
  });

  it("接口失败按空处理", async () => {
    vi.mocked(systemCodeGenApi.planList).mockRejectedValueOnce(
      new Error("network")
    );
    expect(await listPlans()).toEqual([]);
  });

  it("服务端无条数上限（不再静默截断）", async () => {
    for (let index = 0; index < 60; index += 1) {
      await savePlan(`方案${index}`, state());
    }
    expect(await listPlans()).toHaveLength(60);
  });

  it("导入非法 JSON 抛错", async () => {
    await expect(importPlan("not json")).rejects.toThrow();
  });
});
