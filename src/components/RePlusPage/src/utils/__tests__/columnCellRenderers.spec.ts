import { describe, expect, it, vi } from "vitest";
import { ref, type Ref } from "vue";

// 列装配 / 开关文案会读 i18n：只覆盖 useI18n，保留 createI18n 供 plugins/i18n 初始化
vi.mock("vue-i18n", async importOriginal => {
  const actual = await importOriginal<typeof import("vue-i18n")>();
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key, te: () => false })
  };
});

import { applyBooleanColumnRenderers } from "../plusPageColumnInjection";
import { builtinFormRenderers } from "../renderers-form";
import type { PageColumn } from "../types";

const t = (key: string) => key;

/** 渲染器替身输出：只消费 children（VNode 文本或字符串） */
type Rendered = { children?: unknown } | string;
type CellRenderer = (scope: Record<string, unknown>) => Rendered;

/** VNode 文本：JSX 空白折叠后 children 可能是数组 */
const text = (vnode: Rendered) =>
  typeof vnode === "string"
    ? vnode
    : Array.isArray(vnode.children)
      ? vnode.children.join("")
      : vnode.children;
const ctx = () => ({
  t,
  te: () => false,
  localeName: "zh-CN",
  apiSearchComponents: new Map()
});

/** 逐列断言的单元格渲染（FE-COMP-P2-35）：列表读的是 cellRenderer 的输出文本/属性。 */
describe("date / datetime 单元格格式化", () => {
  const makeItem = () =>
    ({ fieldProps: {} }) as {
      fieldProps: Record<string, unknown>;
      cellRenderer: CellRenderer;
    };

  it("datetime 按 YYYY-MM-DD HH:mm:ss 输出", () => {
    const item = makeItem();
    builtinFormRenderers.datetime(
      item as never,
      {
        ...ctx(),
        column: { key: "created_time", input_type: "datetime" }
      } as never
    );

    const vnode = item.cellRenderer({
      row: { created_time: "2026-10-28 09:30:15" }
    });
    expect(text(vnode)).toBe("2026-10-28 09:30:15");
  });

  it("datetime 空值渲染空串（不出现 Invalid Date）", () => {
    const item = makeItem();
    builtinFormRenderers.datetime(
      item as never,
      {
        ...ctx(),
        column: { key: "created_time", input_type: "datetime" }
      } as never
    );

    expect(text(item.cellRenderer({ row: { created_time: null } }))).toBe("");
    expect(text(item.cellRenderer({ row: { created_time: "" } }))).toBe("");
  });

  it("date 只输出 YYYY-MM-DD", () => {
    const item = makeItem();
    builtinFormRenderers.date(
      item as never,
      {
        ...ctx(),
        column: { key: "birthday", input_type: "date" }
      } as never
    );

    expect(
      text(item.cellRenderer({ row: { birthday: "2026-10-28 09:30:15" } }))
    ).toBe("2026-10-28");
    expect(text(item.cellRenderer({ row: { birthday: null } }))).toBe("");
  });
});

describe("boolean 列开关", () => {
  const build = (
    auth: Record<string, unknown>,
    api: Record<string, unknown> = {}
  ) => {
    const listColumns = ref([
      {
        prop: "is_active",
        _column: { key: "is_active", input_type: "boolean" }
      }
    ]) as Ref<PageColumn[]>;
    applyBooleanColumnRenderers({
      listColumns,
      t: t as never,
      api: api as never,
      auth: auth as never,
      switchLoadMap: ref({}) as never,
      switchStyle: ref({}) as never
    });
    const renderer = listColumns.value[0].cellRenderer!;
    return (scope: Record<string, unknown>) => {
      const vnode = renderer(scope as never) as { props?: unknown };
      return { props: (vnode.props ?? {}) as Record<string, unknown> };
    };
  };

  const scope = () => ({
    props: {},
    row: { is_active: true },
    index: 0,
    column: { label: "启用" }
  });

  it("无 partialUpdate / update 权限：开关禁用（只读列表）", () => {
    const vnode = build({})(scope());
    expect(vnode.props.disabled).toBe(true);
  });

  it("有 update 权限：开关可切换", () => {
    const vnode = build({ update: true })(scope());
    expect(vnode.props.disabled).toBe(false);
  });

  it("有 partialUpdate 权限：开关可切换", () => {
    const vnode = build(
      { partialUpdate: true },
      { partialUpdate: vi.fn() }
    )(scope());
    expect(vnode.props.disabled).toBe(false);
  });
});
