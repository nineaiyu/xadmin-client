import { describe, expect, it } from "vitest";
import type { TableColumnRenderer } from "@pureadmin/table";
import { builtinDetailRenderers } from "../renderers-detail";
import { builtinFormRenderers } from "../renderers-form";
import { builtinSearchRenderers } from "../renderers-search";
import {
  getDetailRenderer,
  getFormRenderer,
  getSearchRenderer
} from "../registry";
import type { PageColumn, PlusColumnContext } from "../types";

/**
 * 「列表 / 详情渲染器成对」守护（Q6）。
 *
 * 背景：详情（PlusDescriptions）只认 `render` / `valueType`，列表（pure-table）只认
 * `cellRenderer`，两者互不兜底。历史上多次出现只写一侧的问题：
 * - labeled_choice 缺 `cellRenderer` → 列表渲染 `[object Object]`；
 * - labeled_choice / color 缺 `render` → 详情空白或退化成纯文本色值。
 *
 * 本测试对唯一注册表 `builtinDetailRenderers` 做分类校验：注册表新增 input_type
 * 时必须同步本清单（并按下述类别补齐成对渲染），否则失败。
 * 同步文档：xadmin-server `docs/architecture/framework-cookbook.md`「新增 input_type 检查清单」。
 */

/** 值为对象/数组或需定制展示：必须同时提供详情 render 与列表 cellRenderer */
const CUSTOM_RENDER_TYPES = [
  "labeled_choice",
  "color",
  "json",
  "list",
  "m2m_related_field",
  "labeled_multiple_choice",
  "object_related_field_file",
  "m2m_related_field_file",
  "m2m_related_field_image",
  "file upload"
] as const;

/** 详情走 valueType / options 通道（select / img / text），列表仍需 cellRenderer */
const VALUE_TYPE_TYPES = [
  "object_related_field",
  "object_related_field_image",
  "image upload"
] as const;

/** 仅配置选项/字段行为（渲染由框架通道处理），不强制 render/cellRenderer */
const OPTIONS_ONLY_TYPES = ["boolean"] as const;

const CLASSIFIED = new Set<string>([
  ...CUSTOM_RENDER_TYPES,
  ...VALUE_TYPE_TYPES,
  ...OPTIONS_ONLY_TYPES
]);

/**
 * 表单通道豁免登记：详情有渲染器但表单无需对应编辑器的类型（须写明理由）。
 * 未登记且表单缺失 → 编辑弹窗退化为默认输入框，对象值会被写成 `[object Object]`。
 */
const FORM_EXEMPT_TYPES: string[] = [];

/** 搜索通道注册表分类清单（搜索侧有 `api-*` 兜底，不强制与详情/表单对齐，只防无登记新增） */
const SEARCH_REGISTRY_TYPES = [
  "text",
  "datetime",
  "datetimerange",
  "number",
  "select",
  "select-multiple",
  "select-ordering"
] as const;

const SEARCH_CLASSIFIED = new Set<string>([...SEARCH_REGISTRY_TYPES]);

function makeColumn(inputType: string): PageColumn {
  return {
    key: "field_a",
    label: "A",
    prop: "field_a",
    input_type: inputType,
    choices: [{ value: "a", label: "A", color: "#f00" }]
  } as unknown as PageColumn;
}

function makeContext(column: PageColumn): PlusColumnContext {
  return {
    column: column as unknown as PlusColumnContext["column"],
    t: (key: string) => key,
    te: () => false,
    localeName: "zh",
    apiSearchComponents: {}
  };
}

/** 对全新建的列执行注册表处理器，返回配置后的列 */
function apply(inputType: string): Record<string, unknown> {
  const handler = builtinDetailRenderers[inputType];
  expect(handler, `渲染器注册表缺少 ${inputType}`).toBeTypeOf("function");
  const item = makeColumn(inputType);
  handler(item, makeContext(item));
  return item as unknown as Record<string, unknown>;
}

describe("RePlusPage 详情/列表渲染器成对守护", () => {
  it("注册表新增 input_type 必须先在分类清单中登记", () => {
    const unclassified = Object.keys(builtinDetailRenderers).filter(
      key => !CLASSIFIED.has(key)
    );
    expect(
      unclassified,
      `以下 input_type 未分类：${unclassified.join(", ")}；` +
        "新增渲染器时请在本文件登记类别并补齐成对渲染，同步 framework-cookbook 检查清单"
    ).toEqual([]);
  });

  it("分类清单中的类型都必须在注册表存在（防改名漂移）", () => {
    const missing = [...CLASSIFIED].filter(key => !builtinDetailRenderers[key]);
    expect(
      missing,
      `分类清单引用了不存在的渲染器：${missing.join(", ")}`
    ).toEqual([]);
  });

  it.each(CUSTOM_RENDER_TYPES)(
    "%s：同时提供详情 render 与列表 cellRenderer",
    inputType => {
      const item = apply(inputType);
      expect(typeof item.render, `${inputType} 缺详情 render`).toBe("function");
      expect(typeof item.cellRenderer, `${inputType} 缺列表 cellRenderer`).toBe(
        "function"
      );
    }
  );

  it.each(VALUE_TYPE_TYPES)(
    "%s：详情通道（valueType / options）已建立且列表有 cellRenderer",
    inputType => {
      const item = apply(inputType);
      // object_related_field 双分支：choices 非空走 options（select .pk）、
      // 为空走 valueType=text（.label）——两者必有其一，否则详情无取值通道
      expect(
        item.valueType || item.options,
        `${inputType} 未建立详情取值通道（valueType / options 均为空）`
      ).toBeTruthy();
      expect(typeof item.cellRenderer, `${inputType} 缺列表 cellRenderer`).toBe(
        "function"
      );
    }
  );

  it("labeled_choice：列表读对象 label（防 [object Object]）、详情 prop 指向 value", () => {
    const item = apply("labeled_choice");
    expect(item.prop).toBe("field_a.value");
    const cellRenderer = item.cellRenderer as (
      ctx: TableColumnRenderer
    ) => unknown;
    const vnode = cellRenderer({
      row: { field_a: { value: "a", label: "A", color: "#f00" } }
    } as unknown as TableColumnRenderer);
    expect(vnode, "列表渲染器对 {value,label} 行数据不应产出空值").toBeTruthy();
  });

  it("未注册的 input_type：详情返回 undefined、搜索/表单回退默认分支", () => {
    const unknown = "__not_a_real_input_type__";
    expect(getDetailRenderer(unknown)).toBeUndefined();
    expect(getSearchRenderer(unknown)).toBeTypeOf("function");
    expect(getFormRenderer(unknown)).toBeTypeOf("function");
    expect(getDetailRenderer("labeled_choice")).toBeTypeOf("function");
  });
});

/**
 * 四通道契约守护扩展（§3.3）：元数据的 input_type 同时驱动「搜索 / 列表 / 详情 / 表单」，
 * 除详情/列表成对外，表单与搜索通道的注册表同样纳入分类守护，防「只补一侧」的静默退化。
 */
describe("渲染器四通道契约守护（表单 / 搜索通道）", () => {
  it("详情注册表的 input_type 必须能在表单通道编辑（或登记 FORM_EXEMPT_TYPES）", () => {
    const missing = Object.keys(builtinDetailRenderers).filter(
      key => !builtinFormRenderers[key] && !FORM_EXEMPT_TYPES.includes(key)
    );
    expect(
      missing,
      `以下类型缺表单渲染器：${missing.join(", ")}；` +
        "请在 renderers-form.tsx 补齐，或在 FORM_EXEMPT_TYPES 登记豁免理由（详情专用/只读展示）"
    ).toEqual([]);
  });

  it("搜索注册表新增 input_type 必须先在 SEARCH_REGISTRY_TYPES 登记", () => {
    const unclassified = Object.keys(builtinSearchRenderers).filter(
      key => !SEARCH_CLASSIFIED.has(key)
    );
    expect(
      unclassified,
      `以下搜索 input_type 未登记：${unclassified.join(", ")}；` +
        "请在 SEARCH_REGISTRY_TYPES 登记并同步 framework-cookbook 检查清单"
    ).toEqual([]);
  });

  it("SEARCH_REGISTRY_TYPES 中登记的键都必须在搜索注册表存在（防改名漂移）", () => {
    const missing = [...SEARCH_CLASSIFIED].filter(
      key => !builtinSearchRenderers[key]
    );
    expect(
      missing,
      `分类清单引用了不存在的搜索渲染器：${missing.join(", ")}`
    ).toEqual([]);
  });
});
