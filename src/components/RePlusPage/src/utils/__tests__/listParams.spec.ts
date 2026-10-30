import { describe, expect, it } from "vitest";

import {
  applySelectedExportScope,
  buildExportSearchParams,
  buildListParams,
  flattenPkCollections,
  splitDateRangeFields
} from "../listParams";

describe("splitDateRangeFields", () => {
  it("splits two-item date arrays into _after/_before params", () => {
    const fields: Record<string, unknown> = {
      created_time: ["2026-01-01", "2026-01-31"],
      updated_time: ["2026-02-01", "2026-02-28"]
    };
    splitDateRangeFields(fields);
    expect(fields.created_time_after).toBe("2026-01-01");
    expect(fields.created_time_before).toBe("2026-01-31");
    expect(fields.updated_time_after).toBe("2026-02-01");
    expect(fields.updated_time_before).toBe("2026-02-28");
  });

  it("clears range params when the value is not a two-item array", () => {
    const fields: Record<string, unknown> = {
      created_time: null,
      updated_time: ["only"]
    };
    splitDateRangeFields(fields);
    expect(fields.created_time_after).toBe("");
    expect(fields.created_time_before).toBe("");
    expect(fields.updated_time_after).toBe("");
    expect(fields.updated_time_before).toBe("");
  });
});

describe("flattenPkCollections", () => {
  it("flattens [{pk}] / [{id}] arrays into identifier lists", () => {
    const params: Record<string, unknown> = {
      dept: [{ pk: 1 }, { pk: 2 }],
      users: [{ id: "a" }, { id: "b" }]
    };
    flattenPkCollections(params);
    expect(params.dept).toEqual([1, 2]);
    expect(params.users).toEqual(["a", "b"]);
  });

  it("keeps arrays without valid identifiers untouched", () => {
    const params: Record<string, unknown> = {
      tags: ["red", "blue"],
      empty: []
    };
    flattenPkCollections(params);
    expect(params.tags).toEqual(["red", "blue"]);
    expect(params.empty).toEqual([]);
  });

  it("leaves scalar values untouched", () => {
    const params: Record<string, unknown> = { keyword: "x", page: 1 };
    flattenPkCollections(params);
    expect(params.keyword).toBe("x");
    expect(params.page).toBe(1);
  });
});

describe("buildListParams", () => {
  it("merges query params over search fields and flattens pks", () => {
    const params = buildListParams(
      { keyword: "a", dept: [{ pk: 1 }] } as Record<string, unknown>,
      { page: 2 } as Record<string, unknown>
    );
    expect(params).toEqual({ keyword: "a", dept: [1], page: 2 });
  });

  it("returns a detached copy (mutating result does not affect source)", () => {
    const raw = { nested: { a: 1 } } as Record<string, unknown>;
    const params = buildListParams(raw, {});
    (params.nested as { a: number }).a = 99;
    expect((raw.nested as { a: number }).a).toBe(1);
  });
});

describe("buildExportSearchParams（按搜索条件导出：与列表请求同口径）", () => {
  it("区间数组补出 _after/_before（少了这对键后端只当无条件 → 导出比列表多）", () => {
    const params = buildExportSearchParams(
      { created_time: ["2026-01-01", "2026-01-31"], keyword: "x" },
      "xlsx"
    );
    expect(params.created_time_after).toBe("2026-01-01");
    expect(params.created_time_before).toBe("2026-01-31");
    expect(params.keyword).toBe("x");
  });

  it("pk 集合扁平化、剔 page/size（导出端点不分页）但保留 ordering", () => {
    const params = buildExportSearchParams(
      {
        dept: [{ pk: 1 }, { pk: 2 }],
        page: 3,
        size: 20,
        ordering: "-created_time"
      },
      "csv"
    );
    expect(params.dept).toEqual([1, 2]);
    expect(params).not.toHaveProperty("page");
    expect(params).not.toHaveProperty("size");
    expect(params.ordering).toBe("-created_time");
    expect(params.type).toBe("csv");
  });

  it("在副本上变换：不写回 searchFields（列表页查询不被污染）", () => {
    const searchFields = { created_time: ["2026-01-01", "2026-01-31"] };
    buildExportSearchParams(searchFields, "xlsx");
    expect(searchFields.created_time).toEqual(["2026-01-01", "2026-01-31"]);
    expect(searchFields).not.toHaveProperty("created_time_after");
  });
});

describe("applySelectedExportScope（导出选中行：spm 缺失不得放大为全量）", () => {
  it("换到 spm 时下发 spm 并剔掉一次性 pks", () => {
    const formData = { range: "selected", pks: ["1", "2"], type: "xlsx" };
    const scope = applySelectedExportScope(formData, "spm-token");
    expect(scope.ok).toBe(true);
    expect(scope.params).toEqual({
      range: "selected",
      type: "xlsx",
      spm: "spm-token"
    });
  });

  it("spm 缺失时 ok=false 且原样保留 pks（供重试）", () => {
    const formData = { range: "selected", pks: ["1"], type: "xlsx" };
    const scope = applySelectedExportScope(formData, undefined);
    expect(scope.ok).toBe(false);
    expect(scope.params).toBe(formData);
    expect(formData.pks).toEqual(["1"]);
    expect(formData).not.toHaveProperty("spm");
  });
});
