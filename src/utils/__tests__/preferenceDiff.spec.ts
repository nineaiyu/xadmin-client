import { describe, expect, it } from "vitest";
import {
  buildPreferenceDiff,
  diffNamespace,
  hasPreferenceDiff
} from "@/utils/preferenceDiff";

describe("diffNamespace（单命名空间差异）", () => {
  it("检出变更的键，未变更的键不计入", () => {
    expect(diffNamespace({ a: 1, b: 2 }, { a: 1, b: 3 })).toEqual({ b: 2 });
  });

  it("当前值缺失计为差异，仅存在于当前值的新增键不计入", () => {
    expect(diffNamespace({}, { a: 1 })).toStrictEqual({ a: undefined });
    expect(diffNamespace({ extra: 1 }, {})).toEqual({});
  });

  it("数组顺序敏感（diffStrict 口径）", () => {
    expect(diffNamespace({ list: ["a", "b"] }, { list: ["b", "a"] })).toEqual({
      list: ["a", "b"]
    });
    expect(diffNamespace({ list: ["a", "b"] }, { list: ["a", "b"] })).toEqual(
      {}
    );
  });

  it("嵌套对象按结构比较", () => {
    expect(diffNamespace({ map: { x: 1 } }, { map: { x: 1 } })).toEqual({});
    expect(diffNamespace({ map: { x: 2 } }, { map: { x: 1 } })).toEqual({
      map: { x: 2 }
    });
  });

  it("排除键跳过比对（纯交互状态不进差异）", () => {
    expect(diffNamespace({ a: 1, b: 2 }, { a: 9, b: 2 }, ["a"])).toEqual({});
  });

  it("空入参不抛错", () => {
    expect(diffNamespace(undefined, undefined)).toEqual({});
  });
});

describe("buildPreferenceDiff（三命名空间差异）", () => {
  const baseline = {
    locale: { locale: "zh" },
    layout: { theme: "light", sidebarStatus: true },
    configure: { radius: "default", grey: false }
  };

  it("按 locale / layout / configure 分组检出差异", () => {
    const diff = buildPreferenceDiff(
      {
        locale: { locale: "en" },
        layout: { theme: "dark", sidebarStatus: true },
        configure: { radius: "lg", grey: false }
      },
      baseline
    );
    expect(diff.locale).toEqual({ locale: "en" });
    expect(diff.layout).toEqual({ theme: "dark" });
    expect(diff.configure).toEqual({ radius: "lg" });
    expect(hasPreferenceDiff(diff)).toBe(true);
  });

  it("sidebarStatus（侧栏折叠态，纯交互状态）不计入差异", () => {
    const diff = buildPreferenceDiff(
      {
        ...baseline,
        layout: { ...baseline.layout, sidebarStatus: false }
      },
      baseline
    );
    expect(hasPreferenceDiff(diff)).toBe(false);
  });

  it("无差异时三个命名空间均为空", () => {
    const diff = buildPreferenceDiff(baseline, baseline);
    expect(diff).toEqual({ locale: {}, layout: {}, configure: {} });
    expect(hasPreferenceDiff(diff)).toBe(false);
  });

  it("基线缺失（尚未捕获）时返回空差异", () => {
    const diff = buildPreferenceDiff(
      { locale: {}, layout: {}, configure: {} },
      null
    );
    expect(hasPreferenceDiff(diff)).toBe(false);
  });
});
