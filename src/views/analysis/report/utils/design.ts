import type {
  ReportComponentType,
  ReportDesign,
  ReportDesignComponent
} from "@/api/dataset/analysis";
import type { DashboardCard, DatasetItem } from "@/api/dataset/datasets";

/**
 * 报表设计的纯口径（设计器与单测共用，服务端同口径见 `dataset/utils/report_design.py`）。
 *
 * 设计器只操作纯数据：组件增删改走本地纯函数，落库前 `normalizeDesign` 收敛一次，
 * 服务端仍会再校验（未知列/未知组件类型/图表缺分组/行数越界一律 400）。
 */

export const REPORT_COMPONENT_TYPES: ReportComponentType[] = [
  "number",
  "bar",
  "line",
  "pie"
];
export const REPORT_MAX_COMPONENTS = 12;
export const REPORT_TABLE_LIMIT = { min: 10, max: 500, default: 100 };
export const REPORT_SPANS = [12, 6] as const;
/** 组件默认宽度：指标卡半行（两列并排），图表整行 */
export const DEFAULT_SPAN: Record<ReportComponentType, 12 | 6> = {
  number: 6,
  bar: 12,
  line: 12,
  pie: 12
};

/** 报表模板：一套现成的「列 + 组件」组合（模板 = 起始骨架，之后可自由改） */
export type ReportTemplate = {
  code: string;
  labelKey: string;
  build: (dataset: DatasetItem) => ReportDesign;
};

const takeColumns = (columns: string[], count: number) =>
  columns.slice(0, count);

/** 前 N 列里第一个数值列（sum/avg 的取值字段候选） */
const firstNumeric = (dataset: DatasetItem) => {
  const numeric = new Set(dataset.numeric_columns ?? []);
  return (dataset.columns ?? []).find(column => numeric.has(column)) ?? "";
};

export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    code: "detail",
    labelKey: "dataReport.templateDetail",
    // 明细表：全列 + 无聚合组件（等价存量口径，作为设计起点）
    build: dataset => ({
      columns: [...(dataset.columns ?? [])],
      table_limit: REPORT_TABLE_LIMIT.default,
      components: []
    })
  },
  {
    code: "summary",
    labelKey: "dataReport.templateSummary",
    // 分组统计：明细收窄到前 4 列 + 两个分组图表（首个分组列 + 次个分组列）
    build: dataset => {
      const columns = takeColumns(dataset.columns ?? [], 4);
      const [first, second] = columns;
      const components: ReportDesignComponent[] = [];
      if (first) {
        components.push({
          id: genComponentId(),
          type: "bar",
          span: 6,
          metric: "count",
          group_by: first
        });
      }
      if (second) {
        components.push({
          id: genComponentId(),
          type: "pie",
          span: 6,
          metric: "count",
          group_by: second
        });
      }
      return { columns, table_limit: 100, components };
    }
  },
  {
    code: "trend",
    labelKey: "dataReport.templateTrend",
    // 趋势看板：数据集配置的日期字段按天折线 + 数值列合计指标卡
    build: dataset => {
      const columns = takeColumns(dataset.columns ?? [], 4);
      const dateField = dataset.config?.date_field ?? "";
      const numeric = firstNumeric(dataset);
      const components: ReportDesignComponent[] = [];
      if (dateField) {
        components.push({
          id: genComponentId(),
          type: "line",
          span: 12,
          metric: "count",
          group_by: dateField,
          date_trunc: "day"
        });
      }
      if (numeric) {
        components.push({
          id: genComponentId(),
          type: "number",
          span: 6,
          metric: "sum",
          value_field: numeric
        });
      }
      return { columns, table_limit: 100, components };
    }
  }
];

/** 组件标识：仅用于定位与列表 key */
export function genComponentId(): string {
  const random = globalThis.crypto?.randomUUID?.();
  return random
    ? `cmp-${random}`
    : `cmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** 明细列：design.columns 命中数据集列的保序子集；设计为空/列空 = 数据集全部列 */
export function designColumns(
  design: ReportDesign | undefined,
  dataset: DatasetItem | null
): string[] {
  const all = dataset?.columns ?? [];
  if (!design?.columns?.length) return all;
  const known = new Set(all);
  return design.columns.filter(column => known.has(column));
}

/** 明细行数上限（与服务端读侧同款宽容：非法/缺省回落默认值） */
export function designTableLimit(design: ReportDesign | undefined): number {
  const value = design?.table_limit;
  if (typeof value !== "number" || Number.isNaN(value)) {
    return REPORT_TABLE_LIMIT.default;
  }
  if (value < REPORT_TABLE_LIMIT.min || value > REPORT_TABLE_LIMIT.max) {
    return REPORT_TABLE_LIMIT.default;
  }
  return value;
}

/**
 * 组件 → 看板卡片形态：图表渲染直接复用一期 `ChartCard`（同一套主题/刷新/导出内核），
 * 组件与看板卡片的字段口径本就同源（dataset + chart_type + group_by/metric/...）。
 */
export function componentToCard(
  component: ReportDesignComponent,
  datasetPk: string,
  title: string
): DashboardCard {
  return {
    id: component.id,
    dataset: datasetPk,
    title,
    chart_type: component.type,
    group_by: component.group_by ?? "",
    metric: component.metric ?? "count",
    date_trunc: component.date_trunc,
    value_field: component.value_field ?? ""
  };
}

/** 落库前收敛：列去重并按数据集列白名单过滤；组件补齐 span/metric；丢空 id */
export function normalizeDesign(
  design: ReportDesign,
  dataset: DatasetItem | null
): ReportDesign {
  const known = new Set(dataset?.columns ?? []);
  const columns = [
    ...new Set((design.columns ?? []).filter(column => known.has(column)))
  ];
  const components = (design.components ?? [])
    .filter(component => Boolean(component.id && component.type))
    .slice(0, REPORT_MAX_COMPONENTS)
    .map(component => ({
      ...component,
      span: REPORT_SPANS.includes(component.span as 12)
        ? component.span
        : DEFAULT_SPAN[component.type],
      metric: component.metric ?? "count",
      ...(component.type === "number"
        ? { group_by: "", date_trunc: undefined }
        : {})
    }));
  return {
    columns,
    table_limit: designTableLimit(design),
    components
  };
}
