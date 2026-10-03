import { describe, expect, it } from "vitest";
import type {
  ReportDesign,
  ReportDesignComponent
} from "@/api/dataset/analysis";
import type { DatasetItem } from "@/api/dataset/datasets";
import {
  DEFAULT_SPAN,
  REPORT_MAX_COMPONENTS,
  REPORT_TABLE_LIMIT,
  REPORT_TEMPLATES,
  componentToCard,
  designColumns,
  designTableLimit,
  duplicateComponent,
  genComponentId,
  moveComponent,
  normalizeDesign
} from "../design";

const dataset = (overrides: Partial<DatasetItem> = {}): DatasetItem => ({
  pk: "ds-1",
  name: "用户清单",
  description: "",
  bound_model: "system.userinfo",
  columns: ["username", "gender", "mfa_level", "date_joined"],
  numeric_columns: ["gender", "mfa_level"],
  filters: [],
  ordering: "",
  row_limit: 1000,
  config: {},
  visibility: "shared",
  ...overrides
});

const component = (
  patch: Partial<ReportDesignComponent> = {}
): ReportDesignComponent => ({
  id: "c1",
  type: "bar",
  metric: "count",
  group_by: "gender",
  ...patch
});

describe("明细列口径", () => {
  it("设计为空 / 列空 → 数据集全部列", () => {
    expect(designColumns(undefined, dataset())).toEqual([
      "username",
      "gender",
      "mfa_level",
      "date_joined"
    ]);
    expect(designColumns({ columns: [] }, dataset())).toEqual([
      "username",
      "gender",
      "mfa_level",
      "date_joined"
    ]);
    expect(designColumns(undefined, null)).toEqual([]);
  });

  it("按数据集列白名单过滤且保持设计顺序", () => {
    expect(
      designColumns({ columns: ["gender", "username", "gone"] }, dataset())
    ).toEqual(["gender", "username"]);
  });

  it("行数上限：非法值回落默认值", () => {
    expect(designTableLimit(undefined)).toBe(REPORT_TABLE_LIMIT.default);
    expect(designTableLimit({ table_limit: 20 })).toBe(20);
    expect(designTableLimit({ table_limit: 5 })).toBe(
      REPORT_TABLE_LIMIT.default
    );
    expect(designTableLimit({ table_limit: 9999 })).toBe(
      REPORT_TABLE_LIMIT.default
    );
  });
});

describe("组件 → 看板卡片映射（复用 ChartCard）", () => {
  it("图表组件映射字段与看板卡片同源", () => {
    expect(
      componentToCard(
        component({ type: "line", date_trunc: "day" }),
        "ds-9",
        "趋势"
      )
    ).toEqual({
      id: "c1",
      dataset: "ds-9",
      title: "趋势",
      chart_type: "line",
      group_by: "gender",
      metric: "count",
      date_trunc: "day",
      value_field: ""
    });
  });

  it("指标卡不带分组", () => {
    const card = componentToCard(
      component({
        type: "number",
        group_by: "",
        metric: "sum",
        value_field: "mfa_level"
      }),
      "ds-9",
      "合计"
    );
    expect(card.chart_type).toBe("number");
    expect(card.group_by).toBe("");
    expect(card.value_field).toBe("mfa_level");
  });
});

describe("落库前收敛", () => {
  it("列去重并按白名单过滤，组件补齐默认宽度", () => {
    const design: ReportDesign = {
      columns: ["gender", "gender", "gone", "username"],
      table_limit: 30,
      components: [component({ span: undefined })]
    };
    expect(normalizeDesign(design, dataset())).toEqual({
      columns: ["gender", "username"],
      table_limit: 30,
      components: [
        { id: "c1", type: "bar", metric: "count", group_by: "gender", span: 12 }
      ]
    });
  });

  it("指标卡清掉分组与时间粒度（服务端同样拒绝带分组的指标卡）", () => {
    const normalised = normalizeDesign(
      {
        columns: [],
        components: [
          component({ type: "number", group_by: "gender", date_trunc: "day" })
        ]
      },
      dataset()
    );
    expect(normalised.components?.[0].group_by).toBe("");
    expect(normalised.components?.[0].date_trunc).toBeUndefined();
  });

  it("组件数量截断到上限", () => {
    const components = Array.from(
      { length: REPORT_MAX_COMPONENTS + 3 },
      (_, i) => component({ id: `c${i}` })
    );
    const normalised = normalizeDesign({ columns: [], components }, dataset());
    expect(normalised.components).toHaveLength(REPORT_MAX_COMPONENTS);
  });

  it("丢弃空 id / 空类型的脏组件", () => {
    const normalised = normalizeDesign(
      {
        columns: [],
        components: [
          component(),
          component({ id: "" }),
          component({ id: "c3", type: undefined as never })
        ]
      },
      dataset()
    );
    expect(normalised.components).toHaveLength(1);
  });
});

describe("模板预设", () => {
  it("明细表模板 = 全列 + 无组件", () => {
    const built = REPORT_TEMPLATES[0].build(dataset());
    expect(built.columns).toEqual(dataset().columns);
    expect(built.components).toEqual([]);
  });

  it("分组统计模板 = 前 4 列 + 两个分组图表", () => {
    const built = REPORT_TEMPLATES[1].build(dataset());
    expect(built.columns).toEqual([
      "username",
      "gender",
      "mfa_level",
      "date_joined"
    ]);
    expect(built.components?.map(item => item.group_by)).toEqual([
      "username",
      "gender"
    ]);
    expect(built.components?.every(item => Boolean(item.id))).toBe(true);
  });

  it("趋势看板模板：日期字段折线（按天）+ 数值列合计卡；缺字段时退化", () => {
    const withDate = REPORT_TEMPLATES[2].build(
      dataset({ config: { date_field: "date_joined" } })
    );
    expect(withDate.components?.[0]).toMatchObject({
      type: "line",
      group_by: "date_joined",
      date_trunc: "day",
      span: 12
    });
    expect(withDate.components?.[1]).toMatchObject({
      type: "number",
      metric: "sum",
      value_field: "gender",
      span: 6
    });

    const withoutHints = REPORT_TEMPLATES[2].build(
      dataset({ config: {}, numeric_columns: [] })
    );
    expect(withoutHints.components).toEqual([]);
  });

  it("模板组件默认宽度合法", () => {
    REPORT_TEMPLATES.forEach(template => {
      template.build(dataset()).components?.forEach(item => {
        expect([12, 6]).toContain(item.span ?? DEFAULT_SPAN[item.type]);
      });
    });
  });

  it("genComponentId 生成唯一标识", () => {
    expect(genComponentId()).not.toBe(genComponentId());
    expect(genComponentId().startsWith("cmp-")).toBe(true);
  });
});

describe("组件排序 / 复制", () => {
  const base = (): ReportDesignComponent[] => [
    { id: "a", type: "number", span: 6, metric: "count" },
    { id: "b", type: "bar", span: 12, metric: "count", group_by: "username" },
    { id: "c", type: "pie", span: 12, metric: "count", group_by: "gender" }
  ];

  it("moveComponent 与相邻组件互换位置", () => {
    expect(moveComponent(base(), "b", -1).map(item => item.id)).toEqual([
      "b",
      "a",
      "c"
    ]);
    expect(moveComponent(base(), "b", 1).map(item => item.id)).toEqual([
      "a",
      "c",
      "b"
    ]);
  });

  it("moveComponent 在边界时原样返回（不产生新引用）", () => {
    const panes = base();
    expect(moveComponent(panes, "a", -1)).toBe(panes);
    expect(moveComponent(panes, "c", 1)).toBe(panes);
    expect(moveComponent(panes, "missing", -1)).toBe(panes);
  });

  it("duplicateComponent 紧随原组件插入同配置副本", () => {
    const next = duplicateComponent(base(), "b");
    expect(next).toHaveLength(4);
    expect(next?.[2]).toMatchObject({
      type: "bar",
      span: 12,
      group_by: "username",
      metric: "count"
    });
    expect(next?.[2].id).not.toBe("b");
    expect(next?.[1].id).toBe("b");
  });

  it("duplicateComponent 未知 id / 达到数量上限时返回 null", () => {
    expect(duplicateComponent(base(), "missing")).toBeNull();
    const full = Array.from({ length: REPORT_MAX_COMPONENTS }, (_, index) => ({
      id: `c${index}`,
      type: "number" as const,
      metric: "count" as const
    }));
    expect(duplicateComponent(full, "c0")).toBeNull();
  });

  it("指标汇总模板：行数卡 + 数值列合计卡（半行并排）", () => {
    const built = REPORT_TEMPLATES[3].build(dataset());
    expect(built.components?.[0]).toMatchObject({
      type: "number",
      metric: "count",
      span: 6
    });
    expect(built.components?.[1]).toMatchObject({
      type: "number",
      metric: "sum",
      value_field: "gender",
      span: 6
    });
    expect(built.components?.every(item => Boolean(item.id))).toBe(true);
  });
});
