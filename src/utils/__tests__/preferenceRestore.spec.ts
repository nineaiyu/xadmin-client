import { describe, expect, it } from "vitest";

import { buildRestorePayload } from "../preferenceRestore";

/**
 * 「撤销本次调整」回填值纯函数域：三命名空间整包恢复 + 侧栏折叠态保留 +
 * 深拷贝隔离（回填对象会被面板按字段就地改写，不能改坏基线）。
 */

const baseline = {
  locale: { locale: "zh" },
  layout: {
    layout: "vertical",
    theme: "light",
    sidebarStatus: true,
    epThemeColor: "#006BE6"
  },
  configure: { compactMode: true, tagsStyle: "chrome", navbarOrder: ["a"] }
};

describe("buildRestorePayload", () => {
  it("基线缺失时返回 null（调用方跳过撤销）", () => {
    expect(buildRestorePayload(null, { sidebarStatus: false })).toBeNull();
    expect(buildRestorePayload(undefined, undefined)).toBeNull();
  });

  it("三命名空间整包恢复到基线值", () => {
    const payload = buildRestorePayload(baseline, { sidebarStatus: true });
    expect(payload).toMatchObject({
      locale: { locale: "zh" },
      configure: { compactMode: true, tagsStyle: "chrome" }
    });
    expect(payload?.layout.layout).toBe("vertical");
  });

  it("侧栏折叠态保留当前值（由交互驱动，不计入偏好差异）", () => {
    const payload = buildRestorePayload(baseline, { sidebarStatus: false });
    expect(payload?.layout.sidebarStatus).toBe(false);
    // 其余 layout 键仍回基线
    expect(payload?.layout.epThemeColor).toBe("#006BE6");
  });

  it("深拷贝：改写回填值不污染基线（否则脏标记失去比对基准）", () => {
    const payload = buildRestorePayload(baseline, { sidebarStatus: true })!;
    payload.configure.compactMode = false;
    payload.configure.navbarOrder = ["a", "b"];
    expect(baseline.configure.compactMode).toBe(true);
    expect(baseline.configure.navbarOrder).toEqual(["a"]);
  });

  it("基线命名空间为空对象时给出空对象（不抛错、不回填 undefined）", () => {
    const payload = buildRestorePayload({}, { sidebarStatus: true });
    expect(payload).toEqual({
      locale: {},
      layout: { sidebarStatus: true },
      configure: {}
    });
  });
});
