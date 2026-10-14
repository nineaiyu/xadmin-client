import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * ECharts 按需注册的漂移守卫（静态解析，不 import echarts 本身）。
 *
 * 项目走 `echarts/core` + 显式 `use([...])` 的按需注册：选项里用到没注册的坐标系或
 * 图表类时，**构建不报错**——控制台只打一句 "Component polar is used but not
 * imported."，随后渲染期抛 `Cannot read properties of undefined (reading
 * 'findAxisModel')` 把图表彻底打崩（工作台趋势数据不足时的环形占位图即此现场）。
 * 因此把「src 中出现的坐标系 / 图表类型 ⊆ 已注册清单」固化为门禁。
 */

const PLUGINS_DIR = resolve(__dirname, "..");
const SRC_DIR = resolve(PLUGINS_DIR, "..");
const ECHARTS_FILE = join(PLUGINS_DIR, "echarts.ts");

/** 非笛卡尔坐标系 → 必须注册的组件（笛卡尔系由 grid 覆盖，见 GridComponent） */
const COORDINATE_COMPONENT: Record<string, string> = {
  cartesian2d: "GridComponent",
  polar: "PolarComponent",
  geo: "GeoComponent",
  calendar: "CalendarComponent",
  singleAxis: "SingleAxisComponent",
  parallel: "ParallelComponent",
  radar: "RadarComponent"
};

/**
 * series.type → 必须注册的图表类。只列真实图表类型，避免把 `type: "category"`
 * 之类的轴类型、以及业务自定义的 `type: "text"` 误判为图表。
 */
const SERIES_CHART: Record<string, string> = {
  line: "LineChart",
  bar: "BarChart",
  pie: "PieChart",
  scatter: "ScatterChart",
  effectScatter: "EffectScatterChart",
  radar: "RadarChart",
  gauge: "GaugeChart",
  funnel: "FunnelChart",
  heatmap: "HeatmapChart",
  treemap: "TreemapChart",
  sunburst: "SunburstChart",
  sankey: "SankeyChart",
  graph: "GraphChart",
  boxplot: "BoxplotChart",
  candlestick: "CandlestickChart",
  pictorialBar: "PictorialBarChart",
  themeRiver: "ThemeRiverChart",
  custom: "CustomChart"
};

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    if (
      entry === "node_modules" ||
      entry.startsWith(".") ||
      entry === "__tests__"
    )
      return [];
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    if (!/\.vue$|\.tsx?$/.test(entry) || /\.spec\.ts$|\.d\.ts$/.test(entry))
      return [];
    return [full];
  });
}

/** `core.use([charts.X, components.Y, renderers.Z])` 中的注册清单 */
function registeredEchartsComponents(source: string): Set<string> {
  const used = source.match(/core\.use\(\[([\s\S]*?)\]\)/);
  if (!used)
    throw new Error("未找到 core.use([...]) 注册块，echarts.ts 结构已变更");
  return new Set(
    [
      ...used[1].matchAll(/\b(?:charts|components|renderers)\.([A-Za-z0-9]+)/g)
    ].map(m => m[1])
  );
}

/** src 中显式声明的坐标系（`coordinateSystem: "polar"`） */
function usedCoordinateSystems(): string[] {
  const used = new Set<string>();
  for (const file of walk(SRC_DIR)) {
    const content = readFileSync(file, "utf-8");
    for (const match of content.matchAll(
      /coordinateSystem:\s*"([a-zA-Z0-9]+)"/g
    )) {
      used.add(match[1]);
    }
  }
  return [...used];
}

/** src 中出现的图表类型（`type: "bar"`，仅取 SERIES_CHART 白名单内取值） */
function usedSeriesTypes(): string[] {
  const used = new Set<string>();
  for (const file of walk(SRC_DIR)) {
    const content = readFileSync(file, "utf-8");
    for (const match of content.matchAll(/type:\s*"([a-zA-Z]+)"/g)) {
      if (match[1] in SERIES_CHART) used.add(match[1]);
    }
  }
  return [...used];
}

describe("echarts 按需注册", () => {
  const registered = registeredEchartsComponents(
    readFileSync(ECHARTS_FILE, "utf-8")
  );

  it("注册清单规模符合预期（防止误改整段）", () => {
    expect(registered.size).toBeGreaterThanOrEqual(8);
    expect(registered.has("SVGRenderer")).toBe(true);
  });

  it("src 中使用的坐标系均已注册", () => {
    const missing = usedCoordinateSystems()
      .filter(name => name in COORDINATE_COMPONENT)
      .filter(name => !registered.has(COORDINATE_COMPONENT[name]))
      .map(name => `${name} → ${COORDINATE_COMPONENT[name]}`);
    expect(
      missing,
      `以下坐标系在 src 中使用但未注册对应组件：${missing.join(", ")}`
    ).toEqual([]);
  });

  it("src 中使用的图表类型均已注册", () => {
    const missing = usedSeriesTypes()
      .filter(name => !registered.has(SERIES_CHART[name]))
      .map(name => `${name} → ${SERIES_CHART[name]}`);
    expect(
      missing,
      `以下图表类型在 src 中使用但未注册对应组件：${missing.join(", ")}`
    ).toEqual([]);
  });
});
