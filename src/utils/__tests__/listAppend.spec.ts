import { describe, expect, it } from "vitest";
import { appendOnlyAddedKeys, isTailAppend } from "../listAppend";

describe("isTailAppend", () => {
  it("recognizes a strict tail append", () => {
    expect(isTailAppend(["a", "b"], ["a", "b", "c"])).toBe(true);
  });

  it("rejects first fill / replace / prepend / delete", () => {
    expect(isTailAppend([], ["a"])).toBe(false);
    expect(isTailAppend(["a"], ["a"])).toBe(false);
    expect(isTailAppend(["a", "b"], ["c", "d"])).toBe(false);
    expect(isTailAppend(["a", "b"], ["x", "a", "b"])).toBe(false);
    expect(isTailAppend(["a", "b"], ["a"])).toBe(false);
  });

  it("rejects in-place updates that keep the length", () => {
    expect(isTailAppend(["a", "b"], ["a", "c"])).toBe(false);
  });
});

describe("appendOnlyAddedKeys", () => {
  it("returns the appended keys only", () => {
    expect(appendOnlyAddedKeys(["a"], ["a", "b", "c"])).toEqual(["b", "c"]);
  });

  it("returns an empty list for non-append shapes", () => {
    expect(appendOnlyAddedKeys([], ["a"])).toEqual([]);
    expect(appendOnlyAddedKeys(["a", "b"], ["c", "d"])).toEqual([]);
    expect(appendOnlyAddedKeys(["a", "b"], ["a"])).toEqual([]);
  });
});
