import { describe, expect, it } from "vitest";

import { FORM_SPAN_FIELD, FORM_SPAN_FULL } from "@/utils/formSpan";
import { resolveSettingFieldSpan } from "../settingLayout";

/**
 * 设置页字段宽度分档：多行 / 大块控件独占整行，其余单行控件（含开关）一律
 * 单行档（宽屏一行三个）；不再按 max_length 升整行——设置项 CharField 普遍
 * 声明 128~1024 上限，按长度判断会让几乎所有字段回到通栏。
 */
describe("resolveSettingFieldSpan 字段栅格分档", () => {
  it("多行 / 大块控件独占整行", () => {
    for (const inputType of [
      "textarea",
      "json",
      "image upload",
      "file upload",
      "m2m_related_field_file",
      "object_related_field_image"
    ]) {
      expect(resolveSettingFieldSpan({ input_type: inputType })).toBe(
        FORM_SPAN_FULL
      );
    }
  });

  it("单行控件（含开关）一律单行档：一行三个、中屏一行两个、小屏整行", () => {
    for (const inputType of [
      "string",
      "integer",
      "float",
      "boolean",
      "choice",
      "labeled_choice",
      "date",
      "datetime",
      "color",
      "list",
      "phone",
      "api-search-user"
    ]) {
      expect(resolveSettingFieldSpan({ input_type: inputType })).toBe(
        FORM_SPAN_FIELD
      );
    }

    expect(FORM_SPAN_FIELD.lg).toBe(8);
    expect(FORM_SPAN_FIELD.md).toBe(12);
    expect(FORM_SPAN_FIELD.xs).toBe(24);
    expect(FORM_SPAN_FULL.lg).toBe(24);
  });

  it("形态缺失或未知时同样按单行档（比整行紧凑，也不会把短控件压到不可用）", () => {
    expect(resolveSettingFieldSpan(undefined)).toBe(FORM_SPAN_FIELD);
    expect(resolveSettingFieldSpan(null)).toBe(FORM_SPAN_FIELD);
    expect(resolveSettingFieldSpan({})).toBe(FORM_SPAN_FIELD);
    expect(resolveSettingFieldSpan({ input_type: "unknown-type" })).toBe(
      FORM_SPAN_FIELD
    );
  });
});
