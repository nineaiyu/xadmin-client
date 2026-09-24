import { describe, expect, it } from "vitest";

import {
  fromSecondsEditor,
  isEmptyValue,
  objectValueCount,
  parseObjectValue,
  parseRangeValue,
  serializeObjectValue,
  toSecondsEditor
} from "./ruleValue";

describe("ruleValue 规则取值归一", () => {
  it("parseObjectValue：JSON 字符串 / 对象数组 / 标量统一解析为对象数组", () => {
    expect(parseObjectValue("")).toEqual([]);
    expect(parseObjectValue(null)).toEqual([]);
    expect(parseObjectValue('[{"pk": "u-1"}, {"pk": "u-2"}]')).toEqual([
      { pk: "u-1" },
      { pk: "u-2" }
    ]);
    expect(parseObjectValue([{ pk: 3, username: "zhangsan" }])).toEqual([
      { pk: 3, username: "zhangsan" }
    ]);
    expect(parseObjectValue("u-9")).toEqual([{ pk: "u-9" }]);
    expect(parseObjectValue(7)).toEqual([{ pk: 7 }]);
    // 空项与缺 pk 的项被剔除（避免把空值写进规则）
    expect(parseObjectValue([{ pk: "" }, null, { pk: "a" }])).toEqual([
      { pk: "a" }
    ]);
  });

  it("serializeObjectValue：只保留 pk，避免把展示字段写进规则", () => {
    expect(serializeObjectValue([{ pk: "u-1", username: "zhangsan" }])).toBe(
      '[{"pk":"u-1"}]'
    );
    expect(serializeObjectValue("")).toBe("[]");
  });

  it("objectValueCount：统计有效对象数", () => {
    expect(objectValueCount('[{"pk":"a"},{"pk":"b"}]')).toBe(2);
    expect(objectValueCount(null)).toBe(0);
  });

  it("toSecondsEditor / fromSecondsEditor：过去窗口为负、单位按整除推断", () => {
    expect(toSecondsEditor(-604800)).toEqual({
      amount: 7,
      unit: 86400,
      future: false
    });
    expect(toSecondsEditor(7200)).toEqual({
      amount: 2,
      unit: 3600,
      future: true
    });
    expect(toSecondsEditor(-1800)).toEqual({
      amount: 30,
      unit: 60,
      future: false
    });
    // 空值给默认窗口（过去 7 天），保存时始终是可用值
    expect(toSecondsEditor("")).toEqual({
      amount: 7,
      unit: 86400,
      future: false
    });
    expect(fromSecondsEditor({ amount: 7, unit: 86400, future: false })).toBe(
      -604800
    );
    expect(fromSecondsEditor({ amount: 2, unit: 3600, future: true })).toBe(
      7200
    );
  });

  it("parseRangeValue：两元素数组 / JSON 字符串，非法返回 null", () => {
    expect(
      parseRangeValue(["2026-01-01 00:00:00", "2026-01-02 00:00:00"])
    ).toEqual(["2026-01-01 00:00:00", "2026-01-02 00:00:00"]);
    expect(
      parseRangeValue('["2026-01-01 00:00:00","2026-01-02 00:00:00"]')
    ).toEqual(["2026-01-01 00:00:00", "2026-01-02 00:00:00"]);
    expect(parseRangeValue("not-json")).toBeNull();
    expect(parseRangeValue(["only-one"])).toBeNull();
  });

  it("isEmptyValue：按控件形态判定空值（运行期注入不算空）", () => {
    expect(isEmptyValue("none", "")).toBe(false);
    expect(isEmptyValue("text", "")).toBe(true);
    expect(isEmptyValue("text", "active")).toBe(false);
    expect(isEmptyValue("user", "[]")).toBe(true);
    expect(isEmptyValue("user", '[{"pk":"u-1"}]')).toBe(false);
    expect(isEmptyValue("datetimerange", [])).toBe(true);
    expect(isEmptyValue("seconds", -86400)).toBe(false);
  });
});
