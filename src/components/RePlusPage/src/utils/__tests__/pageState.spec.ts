import { describe, expect, it } from "vitest";
import { resolveFrameworkState } from "../pageState";

describe("RePlusPage 框架态", () => {
  it("无 list 权限 → denied（不再整页空白）", () => {
    expect(resolveFrameworkState({ hasList: false, loadError: "" })).toBe(
      "denied"
    );
  });

  it("请求失败 → error；有权限且无错误 → ready", () => {
    expect(resolveFrameworkState({ hasList: true, loadError: "boom" })).toBe(
      "error"
    );
    expect(resolveFrameworkState({ hasList: true, loadError: "" })).toBe(
      "ready"
    );
  });

  it("legacy 保持旧行为（不做框架态拦截）", () => {
    expect(
      resolveFrameworkState({
        statePolicy: "legacy",
        hasList: false,
        loadError: "boom"
      })
    ).toBe("ready");
  });

  it("无权限优先于请求错误（避免对无权用户暴露错误细节）", () => {
    expect(resolveFrameworkState({ hasList: false, loadError: "boom" })).toBe(
      "denied"
    );
  });
});
