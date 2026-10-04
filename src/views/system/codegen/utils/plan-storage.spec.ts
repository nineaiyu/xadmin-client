import { beforeEach, describe, expect, it } from "vitest";
import { defaultFormState } from "./payload";
import {
  exportPlan,
  importPlan,
  listPlans,
  removePlan,
  savePlan
} from "./plan-storage";

const state = () => ({ ...defaultFormState(), model: "demo.Book" });

beforeEach(() => {
  localStorage.clear();
});

describe("plan-storage", () => {
  it("保存并按时间倒序列出", () => {
    savePlan("方案A", state());
    savePlan("方案B", state());
    const plans = listPlans();
    expect(plans.map(plan => plan.name)).toEqual(["方案B", "方案A"]);
  });

  it("同名覆盖不重复", () => {
    savePlan("方案A", state());
    savePlan("方案A", { ...state(), with_tests: true });
    const plans = listPlans();
    expect(plans).toHaveLength(1);
    expect(plans[0].state.with_tests).toBe(true);
  });

  it("删除方案", () => {
    savePlan("方案A", state());
    removePlan("方案A");
    expect(listPlans()).toEqual([]);
  });

  it("空名保存抛错", () => {
    expect(() => savePlan("  ", state())).toThrow();
  });

  it("导出再导入还原（同名覆盖）", () => {
    savePlan("方案A", { ...state(), menu_icon: "ep:grid" });
    const json = exportPlan(listPlans()[0]);
    removePlan("方案A");
    expect(importPlan(json)).toBe(1);
    expect(listPlans()[0].state.menu_icon).toBe("ep:grid");
  });

  it("损坏的存储内容按空处理", () => {
    localStorage.setItem("xadmin-codegen-plans", "{oops");
    expect(listPlans()).toEqual([]);
  });

  it("导入非法 JSON 抛错", () => {
    expect(() => importPlan("not json")).toThrow();
  });
});
