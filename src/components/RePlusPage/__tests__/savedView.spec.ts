import { describe, expect, it } from "vitest";
import {
  cleanViewConditions,
  hasViewConditions,
  isViewOwner,
  sortViews,
  type SavedViewRow
} from "../src/utils/savedView";

describe("cleanViewConditions（视图条件快照清洗）", () => {
  it("剔除分页 / 排序 / 空值与空数组", () => {
    expect(
      cleanViewConditions({
        page: 1,
        size: 15,
        ordering: "-created_time",
        username: "admin",
        nickname: "",
        roles: [],
        is_active: false
      })
    ).toEqual({ username: "admin", is_active: false });
  });

  it("深拷贝取值（后续改动不回写原对象）", () => {
    const source = { roles: ["r1"] };
    const result = cleanViewConditions(source);
    (result.roles as string[]).push("r2");
    expect(source.roles).toEqual(["r1"]);
  });

  it("hasViewConditions 判定", () => {
    expect(hasViewConditions({ page: 1, username: "" })).toBe(false);
    expect(hasViewConditions({ gender__exact: "1" })).toBe(true);
  });
});

describe("isViewOwner（归属判定）", () => {
  const row = {
    pk: "1",
    name: "v",
    owner: { username: "admin" }
  } as SavedViewRow;
  it("用户名一致为本人", () => {
    expect(isViewOwner(row, "admin")).toBe(true);
    expect(isViewOwner(row, "other")).toBe(false);
    expect(isViewOwner({ pk: "2", name: "v" }, "admin")).toBe(false);
  });
});

describe("sortViews（默认 → 我的 → 共享）", () => {
  const rows = [
    {
      pk: "1",
      name: "共享视图",
      owner: { username: "other" },
      updated_time: "2026-01-03"
    },
    {
      pk: "2",
      name: "我的视图",
      owner: { username: "admin" },
      updated_time: "2026-01-02"
    },
    {
      pk: "3",
      name: "默认视图",
      owner: { username: "admin" },
      is_default: true,
      updated_time: "2026-01-01"
    }
  ] as SavedViewRow[];

  it("默认最前、我的其次、共享最后", () => {
    expect(sortViews(rows, "admin").map(row => row.pk)).toEqual([
      "3",
      "2",
      "1"
    ]);
  });

  it("同组按更新时间倒序", () => {
    const sameGroup = [
      {
        pk: "a",
        name: "a",
        owner: { username: "admin" },
        updated_time: "2026-01-01"
      },
      {
        pk: "b",
        name: "b",
        owner: { username: "admin" },
        updated_time: "2026-02-01"
      }
    ] as SavedViewRow[];
    expect(sortViews(sameGroup, "admin").map(row => row.pk)).toEqual([
      "b",
      "a"
    ]);
  });
});
