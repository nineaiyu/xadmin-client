import { describe, expect, it } from "vitest";

import { filterAnimates } from "../filter";

describe("filterAnimates", () => {
  const list = ["bounce", "fadeIn", "fadeOut", "zoomIn"];

  it("按子串过滤并保持原顺序", () => {
    expect(filterAnimates(list, "fade")).toEqual(["fadeIn", "fadeOut"]);
    expect(filterAnimates(list, "In")).toEqual(["fadeIn", "zoomIn"]);
  });

  it("空关键字返回全量，无命中返回空数组", () => {
    expect(filterAnimates(list, "")).toEqual(list);
    expect(filterAnimates(list, "none")).toEqual([]);
  });
});
