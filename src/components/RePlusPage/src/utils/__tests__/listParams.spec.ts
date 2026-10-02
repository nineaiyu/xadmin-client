import { describe, expect, it } from "vitest";

import {
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
