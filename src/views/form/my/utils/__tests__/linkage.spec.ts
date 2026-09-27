import { describe, expect, it } from "vitest";
import type { FormField, FormLinkage } from "@/api/dataset/dform";
import {
  evaluateLinkages,
  isFieldRequired,
  matchesLinkage,
  visibleFields
} from "../linkage";

const FIELDS: FormField[] = [
  {
    key: "kind",
    label: "类型",
    type: "select",
    options: ["A", "B"],
    required: true
  },
  { key: "amount", label: "金额", type: "number" },
  { key: "reason", label: "说明", type: "input", required: true },
  { key: "tags", label: "标签", type: "checkbox", options: ["x", "y"] }
];

const rule = (patch: Partial<FormLinkage>): FormLinkage => ({
  target: "reason",
  field: "kind",
  op: "eq",
  value: "A",
  effect: "hide",
  ...patch
});

describe("matchesLinkage", () => {
  it("按字符串标量比较标量与数字", () => {
    expect(matchesLinkage(rule({}), "A")).toBe(true);
    expect(matchesLinkage(rule({}), "B")).toBe(false);
    expect(
      matchesLinkage(rule({ target: "amount", op: "eq", value: 3 }), 3.0)
    ).toBe(true);
    expect(matchesLinkage(rule({ op: "ne" }), "B")).toBe(true);
  });

  it("in/notin 支持多值字段（交集判定）", () => {
    const inRule = rule({ field: "tags", op: "in", value: ["y"] });
    expect(matchesLinkage(inRule, ["x", "y"])).toBe(true);
    expect(matchesLinkage(inRule, ["x"])).toBe(false);
    const notinRule = rule({ field: "tags", op: "notin", value: ["y"] });
    expect(matchesLinkage(notinRule, ["x"])).toBe(true);
  });

  it("empty/notempty 覆盖空串、空数组与空对象", () => {
    expect(matchesLinkage(rule({ op: "empty" }), "")).toBe(true);
    expect(matchesLinkage(rule({ op: "empty" }), undefined)).toBe(true);
    expect(matchesLinkage(rule({ op: "empty" }), [])).toBe(true);
    expect(matchesLinkage(rule({ op: "empty" }), {})).toBe(true);
    expect(matchesLinkage(rule({ op: "notempty" }), 0)).toBe(true);
  });
});

describe("evaluateLinkages", () => {
  it("未命中规则时沿用字段定义", () => {
    const controls = evaluateLinkages(FIELDS, [rule({})], { kind: "B" });
    expect(controls.reason).toEqual({ hidden: false, required: null });
  });

  it("隐藏与必填维度独立覆盖，后者胜出", () => {
    const linkages: FormLinkage[] = [
      rule({ op: "notempty", effect: "hide" }),
      rule({ value: "B", effect: "show" }),
      rule({ value: "B", effect: "optional" })
    ];
    const controls = evaluateLinkages(FIELDS, linkages, { kind: "B" });
    expect(controls.reason).toEqual({ hidden: false, required: false });
  });

  it("未知字段引用被忽略（不抛错）", () => {
    const controls = evaluateLinkages(FIELDS, [rule({ target: "nope" })], {
      kind: "A"
    });
    expect(controls.nope).toBeUndefined();
    expect(controls.reason.hidden).toBe(false);
  });
});

describe("visibleFields / isFieldRequired", () => {
  it("隐藏字段不渲染，必填按联动覆盖", () => {
    const controls = evaluateLinkages(
      FIELDS,
      [
        rule({}),
        rule({ target: "amount", op: "eq", value: "A", effect: "require" })
      ],
      { kind: "A" }
    );
    expect(visibleFields(FIELDS, controls).map(item => item.key)).toEqual([
      "kind",
      "amount",
      "tags"
    ]);
    expect(isFieldRequired(FIELDS[1], controls)).toBe(true);
    expect(isFieldRequired(FIELDS[3], controls)).toBe(false);
  });

  it("optional 可放宽字段自身必填", () => {
    const controls = evaluateLinkages(FIELDS, [rule({ effect: "optional" })], {
      kind: "A"
    });
    expect(isFieldRequired(FIELDS[2], controls)).toBe(false);
    expect(isFieldRequired(FIELDS[0], controls)).toBe(true);
  });
});
