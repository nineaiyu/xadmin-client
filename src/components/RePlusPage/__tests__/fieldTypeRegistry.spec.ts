import { describe, expect, it, vi } from "vitest";

// 与 metadata-vocabulary.spec / registry.spec 同款隔离：渲染器映射文件的异步叶子组件在
// vitest SSR 链路会触发 router 循环导入崩溃；本测试只关心清单与映射键，无需真实组件
vi.mock("../src/components/UploadFiles.vue", () => ({ default: {} }));
vi.mock("../src/components/UploadFile.vue", () => ({ default: {} }));
vi.mock("../src/components/PhoneInput.vue", () => ({ default: {} }));
vi.mock("../src/components/JsonInput.vue", () => ({ default: {} }));
vi.mock("../src/components/SuggestSelect.vue", () => ({ default: {} }));

import {
  FIELD_TYPES,
  filterKindOf,
  pickRenderers
} from "../src/utils/fieldTypeRegistry";
import { builtinDetailRenderers } from "../src/utils/renderers-detail";
import { builtinFormRenderers } from "../src/utils/renderers-form";
import { builtinSearchRenderers } from "../src/utils/renderers-search";
import type { LookupFieldKind } from "../src/utils/fieldTypeRegistry";
import searchColumnsSchema from "../../../../contract/schema/search-columns.schema.json";

/**
 * 字段类型能力清单对账（单一事实源守护）。
 *
 * fieldTypeRegistry 是「每个 input_type 的完整能力」的唯一声明处，三处消费方
 * （registry 渲染表 / columnRules 校验规则 / advancedFilter 筛选形态）全部派生自它。
 * 本测试保证三方互不漂移：
 * - 清单键 ⊇ 契约词表（新增 input_type 漏登记即红）；
 * - 清单不得含词表外类型（历史筛选形态兼容项走显式白名单）；
 * - 三面渲染投影与 renderers-*.tsx 实现集合逐键一致（键与引用都不可漂移）；
 * - 筛选形态与迁移前行为逐键等价（冻结快照，防搬表抄错）。
 */

const vocabulary = new Set(
  (
    searchColumnsSchema.items.properties.input_type.anyOf?.[0] as {
      enum?: string[];
    }
  )?.enum ?? []
);

/** 词表外兼容项白名单（历史筛选形态登记，仅高级筛选使用；勿新增） */
const EXTRA_ALLOWED = new Set(["url", "password", "decimal", "switch", "time"]);

/** 迁移前 advancedFilter.ts KIND_BY_INPUT_TYPE 的冻结快照（行为等价回归基准） */
const LEGACY_KIND_BY_INPUT_TYPE: Record<string, LookupFieldKind> = {
  string: "text",
  text: "text",
  textarea: "text",
  email: "text",
  phone: "text",
  color: "text",
  url: "text",
  password: "text",
  integer: "number",
  number: "number",
  float: "number",
  decimal: "number",
  boolean: "boolean",
  switch: "boolean",
  date: "date",
  datetime: "datetime",
  datetimerange: "datetime",
  time: "time",
  select: "choice",
  "select-multiple": "choice",
  "select-ordering": "choice",
  labeled_choice: "choice",
  choice: "choice",
  labeled_multiple_choice: "choice",
  "multiple choice": "choice",
  object_related_field: "choice",
  m2m_related_field: "choice",
  object_related_field_file: "choice",
  m2m_related_field_file: "choice"
};

describe("字段类型能力清单 ⇄ 契约词表 对账", () => {
  it("词表内全部类型均有清单登记（漏登记即红）", () => {
    const missing = [...vocabulary].filter(
      type => !type.startsWith("api-") && !(type in FIELD_TYPES)
    );
    expect(
      missing,
      `词表类型未在 fieldTypeRegistry 登记：${missing.join("、")}——补清单登记（渲染面按需补 renderers-*.tsx 实现体）`
    ).toEqual([]);
  });

  it("清单不含词表外类型（兼容白名单除外）", () => {
    const undeclared = Object.keys(FIELD_TYPES).filter(
      type => !vocabulary.has(type) && !EXTRA_ALLOWED.has(type)
    );
    expect(
      undeclared,
      `清单存在契约词表未登记的类型：${undeclared.join("、")}——在服务端 DECLARED_INPUT_TYPES 登记或移入兼容白名单`
    ).toEqual([]);
  });

  it("三面渲染投影与 renderers-*.tsx 实现集合逐键一致", () => {
    expect(pickRenderers("search")).toEqual(builtinSearchRenderers);
    expect(pickRenderers("form")).toEqual(builtinFormRenderers);
    expect(pickRenderers("detail")).toEqual(builtinDetailRenderers);
  });

  it("筛选形态与迁移前行为逐键等价（冻结快照）", () => {
    for (const [type, kind] of Object.entries(LEGACY_KIND_BY_INPUT_TYPE)) {
      expect(filterKindOf(type), type).toBe(kind);
    }
  });

  it("迁移前未收录筛选形态的类型保持未收录（回落自由文本）", () => {
    for (const type of [
      "field",
      "file upload",
      "image upload",
      "input",
      "json",
      "list",
      "m2m_related_field_image",
      "object_related_field_image"
    ]) {
      expect(filterKindOf(type), type).toBeUndefined();
    }
    // 词表外未登记（如 api-* 前缀族）同样回落
    expect(filterKindOf("api-search-user")).toBeUndefined();
  });
});
