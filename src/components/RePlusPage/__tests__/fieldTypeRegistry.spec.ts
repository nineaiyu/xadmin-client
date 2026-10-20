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
import { buildColumnRule } from "../src/utils/columnRules";
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
const EXTRA_ALLOWED = new Set(["switch"]);

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
  m2m_related_field_file: "choice",
  object_related_field_image: "choice",
  m2m_related_field_image: "choice"
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

  it("time：表单通道为 time-picker 且提交格式与后端同口径", () => {
    const fieldProps: Record<string, unknown> = {};
    const column: Record<string, unknown> = {
      key: "start_time",
      label: "开始时间",
      prop: "start_time",
      input_type: "time",
      fieldProps
    };
    pickRenderers("form").time(column as never, {
      column: column as never,
      t: (key: string) => key,
      te: () => false,
      localeName: "zh",
      apiSearchComponents: {}
    });
    expect(column.valueType).toBe("time-picker");
    expect(fieldProps.valueFormat).toBe("HH:mm:ss");
  });

  it("迁移前未收录筛选形态的类型保持未收录（回落自由文本）", () => {
    for (const type of [
      "field",
      "file upload",
      "image upload",
      "input",
      "json",
      "list"
    ]) {
      expect(filterKindOf(type), type).toBeUndefined();
    }
    // 词表外未登记（如 api-* 前缀族）同样回落
    expect(filterKindOf("api-search-user")).toBeUndefined();
  });

  it("phone：表单渲染器不篡改 column.default（国家显示名不得混入字段值）", () => {
    const column: Record<string, unknown> = {
      key: "phone",
      label: "手机号",
      prop: "phone",
      input_type: "phone"
    };
    pickRenderers("form").phone(column as never, {
      column: column as never,
      t: (key: string) => key,
      te: () => false,
      localeName: "zh",
      apiSearchComponents: {}
    });
    expect("default" in column).toBe(false);
  });

  it("phone：对象值穿透取 .phone 判必填与格式", () => {
    const column = {
      key: "phone",
      label: "手机号",
      input_type: "phone",
      required: true
    };
    const rules = buildColumnRule(column as never, "手机号");
    const validate = (value: unknown) =>
      new Promise<Error | undefined>(resolve => {
        (rules[0].validator as (...args: unknown[]) => void)(
          rules[0],
          value,
          (error?: Error) => resolve(error)
        );
      });

    return Promise.all([
      validate({ code: "+86", phone: "" }),
      validate({ code: "+86", phone: "13800138000" }),
      validate({ code: "+86", phone: "123" })
    ]).then(([empty, valid, invalid]) => {
      expect(empty).toBeInstanceOf(Error);
      expect(valid).toBeUndefined();
      expect(invalid).toBeInstanceOf(Error);
    });
  });

  it("color：非法色值拒绝、空值按 required 语义", () => {
    const rules = buildColumnRule(
      {
        key: "color",
        label: "颜色",
        input_type: "color",
        required: false
      } as never,
      "颜色"
    );
    const validate = (value: unknown) =>
      new Promise<Error | undefined>(resolve => {
        (rules[0].validator as (...args: unknown[]) => void)(
          rules[0],
          value,
          (error?: Error) => resolve(error)
        );
      });
    return Promise.all([
      validate(""),
      validate("#409EFF"),
      validate("409EFF")
    ]).then(([empty, valid, invalid]) => {
      expect(empty).toBeUndefined();
      expect(valid).toBeUndefined();
      expect(invalid).toBeInstanceOf(Error);
    });
  });

  it("color：元数据 predefine 优先于内置 9 色兜底", () => {
    const fieldProps: Record<string, unknown> = {};
    const column: Record<string, unknown> = {
      key: "color",
      label: "颜色",
      prop: "color",
      input_type: "color",
      predefine: ["#111111", "#222222"],
      fieldProps
    };
    pickRenderers("form").color(column as never, {
      column: column as never,
      t: (key: string) => key,
      te: () => false,
      localeName: "zh",
      apiSearchComponents: {}
    });
    expect(fieldProps.predefine).toEqual(["#111111", "#222222"]);
  });

  it("decimal：按 decimal_places 推导 step 与 precision", () => {
    const fieldProps: Record<string, unknown> = {};
    const column: Record<string, unknown> = {
      key: "days",
      label: "天数",
      prop: "days",
      input_type: "decimal",
      decimal_places: 1,
      fieldProps
    };
    pickRenderers("form").decimal(column as never, {
      column: column as never,
      t: (key: string) => key,
      te: () => false,
      localeName: "zh",
      apiSearchComponents: {}
    });
    expect(column.valueType).toBe("input-number");
    expect(fieldProps.step).toBe(0.1);
    expect(fieldProps.precision).toBe(1);
  });

  it("url：非法链接拒绝、空值放行", () => {
    const rules = buildColumnRule(
      {
        key: "site",
        label: "站点",
        input_type: "url",
        required: false
      } as never,
      "站点"
    );
    const validate = (value: unknown) =>
      new Promise<Error | undefined>(resolve => {
        (rules[0].validator as (...args: unknown[]) => void)(
          rules[0],
          value,
          (error?: Error) => resolve(error)
        );
      });
    return Promise.all([
      validate(""),
      validate("https://example.com"),
      validate("not a url")
    ]).then(([empty, valid, invalid]) => {
      expect(empty).toBeUndefined();
      expect(valid).toBeUndefined();
      expect(invalid).toBeInstanceOf(Error);
    });
  });
});
