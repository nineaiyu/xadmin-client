import { describe, expect, it } from "vitest";

import { withFileUrlRequiredRule } from "../fileFormRules";
import { mapCategoryOptions } from "../fileStats";

const asRules = (rules: unknown) => rules as never;

const baseRules = () => ({
  file_url: [
    { required: true, message: "请填写合法地址", trigger: "blur" },
    { max: 500, message: "过长" }
  ],
  filename: [{ required: true, message: "必填" }]
});

describe("withFileUrlRequiredRule", () => {
  it("replaces file_url rule with URL validator when adding", () => {
    const rules = asRules(baseRules());
    const result = withFileUrlRequiredRule(rules, { isAdd: true });
    expect(result).toBe(rules);
    expect(rules["file_url"]).toHaveLength(1);
    const rule = rules["file_url"][0];
    expect(rule["required"]).toBe(true);
    expect(rule["trigger"]).toBe("blur");
  });

  it("keeps original rules for existing uploaded rows", () => {
    const rules = asRules(baseRules());
    withFileUrlRequiredRule(rules, {
      isAdd: false,
      rawRow: { is_upload: true }
    });
    expect(rules["file_url"]).toHaveLength(2);
    expect(rules["file_url"][0]["message"]).toBe("请填写合法地址");
  });

  it("replaces rule for existing rows that are not uploaded yet", () => {
    const rules = asRules(baseRules());
    withFileUrlRequiredRule(rules, {
      isAdd: false,
      rawRow: { is_upload: false }
    });
    expect(rules["file_url"]).toHaveLength(1);
  });

  it("validator fails non-URL values with the original message", () => {
    const rules = asRules(baseRules());
    withFileUrlRequiredRule(rules, { isAdd: true });
    const validator = rules["file_url"][0]["validator"] as (
      _rule: unknown,
      value: string,
      callback: (error?: Error) => void
    ) => void;
    let error: Error | undefined;
    validator({}, "not a url", e => {
      error = e;
    });
    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toBe("请填写合法地址");

    let error2: Error | undefined;
    validator({}, "https://example.com/a.pdf", e => {
      error2 = e;
    });
    expect(error2).toBeUndefined();
  });
});

describe("mapCategoryOptions", () => {
  it("maps dict items to label/value options (label kept as-is when empty)", () => {
    expect(
      mapCategoryOptions([
        { label: "合同", value: "contract" },
        { label: null, value: "misc" },
        { value: "only" }
      ])
    ).toEqual([
      { label: "合同", value: "contract" },
      { label: "misc", value: "misc" },
      { label: "only", value: "only" }
    ]);
  });
});
