import { describe, expect, it } from "vitest";
import { hexToHslTriplet } from "@/utils/color";
import {
  SCREEN_LIGHT_CLASS,
  applyScreenTheme,
  normalizeScreenTheme,
  resetScreenAccent,
  resolveScreenTheme
} from "./screenTheme";

/**
 * 大屏主题解析与应用（设计器 / 投屏共用）：
 * 主题枚举 → 实际明暗的映射是「所见即所得」的前提，浅色类与主色覆写是换肤的全部动作。
 */
describe("normalizeScreenTheme", () => {
  it("labeled choice 取 value、标量直取、空值回落深色", () => {
    expect(normalizeScreenTheme({ value: "light", label: "浅色" })).toBe(
      "light"
    );
    expect(normalizeScreenTheme("auto")).toBe("auto");
    expect(normalizeScreenTheme(null)).toBe("dark");
    expect(normalizeScreenTheme(undefined)).toBe("dark");
  });
});

describe("resolveScreenTheme", () => {
  it("缺省 / dark 恒深色（存量观感不随站点变）", () => {
    expect(resolveScreenTheme(undefined, false)).toBe(true);
    expect(resolveScreenTheme("dark", false)).toBe(true);
    expect(resolveScreenTheme("dark", true)).toBe(true);
  });

  it("light 恒浅色（站点暗色也不跟随）", () => {
    expect(resolveScreenTheme("light", true)).toBe(false);
    expect(resolveScreenTheme("light", false)).toBe(false);
  });

  it("auto 跟随站点明暗", () => {
    expect(resolveScreenTheme("auto", true)).toBe(true);
    expect(resolveScreenTheme("auto", false)).toBe(false);
  });
});

describe("applyScreenTheme", () => {
  it("深色缺省态不挂浅色类，且无内联主色覆写", () => {
    const root = document.createElement("div");
    applyScreenTheme(root, true, "");

    expect(root.classList.contains(SCREEN_LIGHT_CLASS)).toBe(false);
    expect(root.style.getPropertyValue("--primary")).toBe("");
    expect(root.style.getPropertyValue("--el-color-primary")).toBe("");
  });

  it("浅色态挂浅色类（令牌成对覆写的开关）", () => {
    const root = document.createElement("div");
    applyScreenTheme(root, false, "");

    expect(root.classList.contains(SCREEN_LIGHT_CLASS)).toBe(true);
  });

  it("主题色：覆写 --primary 与 --el-color-primary（图表 / 色条取的是后者）", () => {
    const root = document.createElement("div");
    applyScreenTheme(root, true, "#006BE6");

    const triplet = hexToHslTriplet("#006BE6");
    expect(root.style.getPropertyValue("--primary")).toBe(triplet);
    expect(root.style.getPropertyValue("--el-color-primary")).toBe(
      "hsl(var(--primary))"
    );
    expect(root.style.getPropertyValue("--screen-glow-primary")).toContain(
      "rgba("
    );
  });

  it("清空主题色：恢复站点主色（撤除内联覆写）", () => {
    const root = document.createElement("div");
    applyScreenTheme(root, true, "#006BE6");
    applyScreenTheme(root, true, "");

    expect(root.style.getPropertyValue("--primary")).toBe("");
    expect(root.style.getPropertyValue("--el-color-primary")).toBe("");
    expect(root.style.getPropertyValue("--screen-glow-primary")).toBe("");
  });

  it("非法主题色不写入（服务端已校验，前端仅兜底）", () => {
    const root = document.createElement("div");
    applyScreenTheme(root, true, "not-a-color");

    expect(root.style.getPropertyValue("--primary")).toBe("");
  });

  it("重复应用幂等（切换主题/主题色反复调用不叠加）", () => {
    const root = document.createElement("div");
    applyScreenTheme(root, false, "#006BE6");
    applyScreenTheme(root, false, "#006BE6");

    expect(root.classList.contains(SCREEN_LIGHT_CLASS)).toBe(true);
    expect(root.style.getPropertyValue("--el-color-primary")).toBe(
      "hsl(var(--primary))"
    );
  });

  it("resetScreenAccent 只撤主色，不动浅色类", () => {
    const root = document.createElement("div");
    applyScreenTheme(root, false, "#006BE6");
    resetScreenAccent(root);

    expect(root.style.getPropertyValue("--primary")).toBe("");
    expect(root.classList.contains(SCREEN_LIGHT_CLASS)).toBe(true);
  });

  it("根元素为空时静默跳过（详情未加载完成）", () => {
    expect(() => applyScreenTheme(null, false, "#006be6")).not.toThrow();
  });
});
