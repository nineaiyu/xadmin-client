import { describe, expect, it } from "vitest";
import {
  buildLookupParams,
  normalizeLookupValue,
  parseLookupConditions,
  stripLookupConditions
} from "../src/utils/advancedFilter";

describe("normalizeLookupValue（lookup 值规范化）", () => {
  it("isnull 只接受布尔字面量", () => {
    expect(normalizeLookupValue("isnull", "true")).toBe(true);
    expect(normalizeLookupValue("isnull", "false")).toBe(false);
    expect(normalizeLookupValue("isnull", "1")).toBeNull();
    expect(normalizeLookupValue("isnull", "")).toBeNull();
  });

  it("in 拆分为数组并过滤空项", () => {
    expect(normalizeLookupValue("in", "a, b ,,c")).toEqual(["a", "b", "c"]);
    expect(normalizeLookupValue("in", " , ")).toBeNull();
  });

  it("普通 lookup 去空白原样下发", () => {
    expect(normalizeLookupValue("icontains", " 张三 ")).toBe("张三");
    expect(normalizeLookupValue("exact", "  ")).toBeNull();
  });
});

describe("buildLookupParams（条件行 → 查询参数）", () => {
  it("逐行拼装 field__lookup 参数", () => {
    const { params, errors } = buildLookupParams([
      { field: "username", lookup: "icontains", value: "admin" },
      { field: "is_active", lookup: "isnull", value: "false" },
      { field: "pk", lookup: "in", value: "1,2" },
      { field: "nickname", lookup: "ne", value: "test" }
    ]);
    expect(errors).toEqual([]);
    expect(params).toEqual({
      username__icontains: "admin",
      is_active__isnull: false,
      pk__in: ["1", "2"],
      nickname__ne: "test"
    });
  });

  it("缺字段 / 缺值 / 重复条件逐行报错但不阻断其它行", () => {
    const { params, errors } = buildLookupParams([
      { field: "", lookup: "icontains", value: "x" },
      { field: "username", lookup: "icontains", value: "" },
      { field: "username", lookup: "icontains", value: "a" },
      { field: "username", lookup: "icontains", value: "b" },
      { field: "email", lookup: "exact", value: "e@x.com" }
    ]);
    expect(Object.keys(params)).toEqual([
      "username__icontains",
      "email__exact"
    ]);
    expect(errors).toHaveLength(3);
    expect(errors[0]).toContain("#1");
    expect(errors[2]).toContain("duplicated");
  });

  it("空行集合产出空参数", () => {
    expect(buildLookupParams([])).toEqual({ params: {}, errors: [] });
  });
});

describe("parseLookupConditions（条件快照 → 回显行）", () => {
  it("识别白名单 lookup 并还原值文本", () => {
    const rows = parseLookupConditions({
      page: 1,
      size: 15,
      ordering: "-created_time",
      username__icontains: "admin",
      pk__in: ["1", "2"],
      is_active__isnull: false
    });
    expect(rows).toEqual([
      { field: "username", lookup: "icontains", value: "admin" },
      { field: "pk", lookup: "in", value: "1,2" },
      { field: "is_active", lookup: "isnull", value: "false" }
    ]);
  });

  it("忽略非白名单 lookup（日期区间 _after/_before 等）与嵌套键", () => {
    const rows = parseLookupConditions({
      created_time__after: "2026-01-01",
      updated_time__before: "2026-02-01",
      user__dept__icontains: "x",
      ordering: "name"
    });
    expect(rows).toEqual([]);
  });
});

describe("stripLookupConditions（清除既有高级筛选键）", () => {
  it("只删 lookup 键，保留分页与普通条件", () => {
    const result = stripLookupConditions({
      page: 2,
      size: 15,
      ordering: "-created_time",
      username: "admin",
      nickname__icontains: "x",
      pk__in: ["1"]
    });
    expect(result).toEqual({
      page: 2,
      size: 15,
      ordering: "-created_time",
      username: "admin"
    });
  });
});
