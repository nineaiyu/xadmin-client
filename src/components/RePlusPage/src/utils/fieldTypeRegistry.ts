/**
 * 字段类型能力清单：每个 input_type 的完整能力在**本文件一处声明**。
 *
 * 一个类型的完整能力此前分散在四个互相独立、且规则 / 筛选两面无门禁的认知源：
 * 三张渲染实现表（renderers-search / form / detail.tsx）、表单校验规则 switch
 * （columnRules.ts）、高级筛选取值形态表（advancedFilter.ts）。本清单把它们收敛为：
 * - search / form / detail：渲染面（引用 renderers-*.tsx 的实现体，键与实现集合一一对应）；
 * - rule：新建 / 编辑表单的校验规则工厂（缺省 = 通用 required 规则）；
 * - filterKind：高级筛选取值形态（缺省 = 自由文本处理）。
 *
 * 消费方全部派生自本清单（对外导出 API 与行为不变）：
 * - `registry.ts` 三张渲染器表按面投影（register*Renderer 运行期覆盖语义不变）；
 * - `columnRules.ts::buildColumnRule` 按 rule 面查表（缺省兜底通用 required）；
 * - `advancedFilter.ts::buildLookupFields` 按 filterKind 面推导字段能力。
 *
 * 扩展流程（新增 input_type）：服务端词表登记 → `pnpm sync:contract` →
 * renderers-*.tsx 按需补实现体 → 在本清单补登记一行 → 门禁
 * `fieldTypeRegistry.spec.ts` 自动对账（清单键 ⊇ 契约词表；渲染面 ≡ 实现集合）。
 */

import { isNumber } from "@pureadmin/utils";
import { buildEmailRule } from "@/utils/rules/email";
import { builtinDetailRenderers } from "./renderers-detail";
import { builtinFormRenderers } from "./renderers-form";
import { builtinSearchRenderers } from "./renderers-search";
import type { SearchColumnsResult, SearchFieldsResult } from "@/api/types";
import type { PlusColumnHandler, PlusColumnRegistry } from "./types";

/** 列元数据：同时兼容 search-fields 与 search-columns 接口返回（与 PlusColumnMeta 同口径） */
export type ColumnMeta = SearchFieldsResult["data"][0] &
  Partial<SearchColumnsResult["data"][0]>;

/** 高级筛选取值控件形态（由字段 input_type / choices 推导） */
export type LookupFieldKind =
  "text" | "number" | "boolean" | "date" | "datetime" | "time" | "choice";

/** 表单校验规则工厂：按列元数据生成 Element Plus 校验规则（空值语义由工厂自持） */
export type FieldRuleFactory = (
  column: ColumnMeta,
  message: string
) => Record<string, unknown>[];

/** 单个 input_type 的能力规格；未声明某面 = 该面走兜底（回退渲染 / 通用 required / 自由文本） */
export type FieldTypeSpec = {
  /** 搜索区渲染器 */
  search?: PlusColumnHandler;
  /** 表单区（新建 / 编辑）渲染器 */
  form?: PlusColumnHandler;
  /** 详情 / 表格渲染器 */
  detail?: PlusColumnHandler;
  /** 表单校验规则工厂 */
  rule?: FieldRuleFactory;
  /** 高级筛选取值形态 */
  filterKind?: LookupFieldKind;
};

/** email 字段校验规则（空值放行，由 required 声明接管；实现见 @/utils/rules/email） */
const emailRuleFactory: FieldRuleFactory = (column, message) => [
  { ...buildEmailRule({ required: column.required, formatMessage: message }) }
];

/** integer 字段校验规则（非数字拒绝，空值放行） */
const integerRuleFactory: FieldRuleFactory = (column, message) => [
  {
    required: column.required,
    validator: (
      rule: unknown,
      value: unknown,
      callback: (error?: Error) => void
    ) => {
      if (value && !isNumber(value)) {
        callback(new Error(message));
      } else {
        callback();
      }
    },
    trigger: "blur"
  }
];

/**
 * 字段类型能力清单。
 *
 * 键集合 ⊇ 契约词表（`contract/schema/search-columns.schema.json` 的 input_type，
 * 单一事实源在服务端 `common/core/modelset/input_types.py`）；
 * 词表外键仅限文末「词表外兼容项」（历史筛选形态登记，勿新增）。
 */
export const FIELD_TYPES: Record<string, FieldTypeSpec> = {
  boolean: {
    form: builtinFormRenderers.boolean,
    detail: builtinDetailRenderers.boolean,
    filterKind: "boolean"
  },
  choice: {
    form: builtinFormRenderers.choice,
    filterKind: "choice"
  },
  color: {
    form: builtinFormRenderers.color,
    detail: builtinDetailRenderers.color,
    filterKind: "text"
  },
  date: {
    form: builtinFormRenderers.date,
    filterKind: "date"
  },
  datetime: {
    search: builtinSearchRenderers.datetime,
    form: builtinFormRenderers.datetime,
    filterKind: "datetime"
  },
  datetimerange: {
    search: builtinSearchRenderers.datetimerange,
    filterKind: "datetime"
  },
  email: {
    // 渲染走回退登记（x-fallback-rendered），仅校验与筛选形态在此声明
    rule: emailRuleFactory,
    filterKind: "text"
  },
  field: {
    form: builtinFormRenderers.field
  },
  "file upload": {
    form: builtinFormRenderers["file upload"],
    detail: builtinDetailRenderers["file upload"]
  },
  float: {
    form: builtinFormRenderers.float,
    filterKind: "number"
  },
  "image upload": {
    form: builtinFormRenderers["image upload"],
    detail: builtinDetailRenderers["image upload"]
  },
  // 渲染走回退登记（x-fallback-rendered），且无专属校验 / 筛选形态
  input: {},
  integer: {
    form: builtinFormRenderers.integer,
    rule: integerRuleFactory,
    filterKind: "number"
  },
  json: {
    form: builtinFormRenderers.json,
    detail: builtinDetailRenderers.json
  },
  labeled_choice: {
    form: builtinFormRenderers.labeled_choice,
    detail: builtinDetailRenderers.labeled_choice,
    filterKind: "choice"
  },
  labeled_multiple_choice: {
    form: builtinFormRenderers.labeled_multiple_choice,
    detail: builtinDetailRenderers.labeled_multiple_choice,
    filterKind: "choice"
  },
  list: {
    form: builtinFormRenderers.list,
    detail: builtinDetailRenderers.list
  },
  m2m_related_field: {
    form: builtinFormRenderers.m2m_related_field,
    detail: builtinDetailRenderers.m2m_related_field,
    filterKind: "choice"
  },
  m2m_related_field_file: {
    form: builtinFormRenderers.m2m_related_field_file,
    detail: builtinDetailRenderers.m2m_related_field_file,
    filterKind: "choice"
  },
  m2m_related_field_image: {
    form: builtinFormRenderers.m2m_related_field_image,
    detail: builtinDetailRenderers.m2m_related_field_image
  },
  "multiple choice": {
    form: builtinFormRenderers["multiple choice"],
    filterKind: "choice"
  },
  number: {
    search: builtinSearchRenderers.number,
    filterKind: "number"
  },
  object_related_field: {
    form: builtinFormRenderers.object_related_field,
    detail: builtinDetailRenderers.object_related_field,
    filterKind: "choice"
  },
  object_related_field_file: {
    form: builtinFormRenderers.object_related_field_file,
    detail: builtinDetailRenderers.object_related_field_file,
    filterKind: "choice"
  },
  object_related_field_image: {
    form: builtinFormRenderers.object_related_field_image,
    detail: builtinDetailRenderers.object_related_field_image
  },
  phone: {
    form: builtinFormRenderers.phone,
    filterKind: "text"
  },
  select: {
    search: builtinSearchRenderers.select,
    filterKind: "choice"
  },
  "select-multiple": {
    search: builtinSearchRenderers["select-multiple"],
    filterKind: "choice"
  },
  "select-ordering": {
    search: builtinSearchRenderers["select-ordering"],
    filterKind: "choice"
  },
  string: {
    form: builtinFormRenderers.string,
    filterKind: "text"
  },
  text: {
    search: builtinSearchRenderers.text,
    filterKind: "text"
  },
  textarea: {
    form: builtinFormRenderers.textarea,
    filterKind: "text"
  },
  // —— 词表外兼容项（契约词表不含；仅高级筛选形态的历史登记，勿新增）——
  url: { filterKind: "text" },
  password: { filterKind: "text" },
  decimal: { filterKind: "number" },
  switch: { filterKind: "boolean" },
  time: { filterKind: "time" }
};

/** input_type → 高级筛选取值形态（未登记返回 undefined，由消费方回落自由文本） */
export function filterKindOf(inputType: string): LookupFieldKind | undefined {
  return FIELD_TYPES[inputType]?.filterKind;
}

/** 按面投影出渲染器映射（registry.ts 内置表派生入口；键与 renderers-*.tsx 实现集合一致） */
export function pickRenderers(
  face: "search" | "form" | "detail"
): PlusColumnRegistry {
  const picked: PlusColumnRegistry = {};
  for (const [inputType, spec] of Object.entries(FIELD_TYPES)) {
    const handler = spec[face];
    if (handler) picked[inputType] = handler;
  }
  return picked;
}
