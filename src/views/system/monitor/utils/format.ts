import type {
  MonitorHistory,
  MonitorMetric,
  MonitorMetricStat
} from "@/api/system/monitor";

/** 指标元数据：单位 / 语义色（EP 变量名，null 表示走固定色值）/ 渲染轴（百分比类与数值类分轴） */
export const METRIC_META: Record<
  MonitorMetric,
  {
    unit: string;
    color: "primary" | "success" | "warning" | "info" | "danger" | null;
    axis: "percent" | "value";
  }
> = {
  cpu_percent: { unit: "%", color: "primary", axis: "percent" },
  memory_used: { unit: "%", color: "success", axis: "percent" },
  disk_used: { unit: "%", color: "warning", axis: "percent" },
  cpu_load: { unit: "", color: "info", axis: "value" },
  net_sent_rate: { unit: "KB/s", color: "danger", axis: "value" },
  net_recv_rate: { unit: "KB/s", color: null, axis: "value" }
};

export const METRIC_OPTIONS: MonitorMetric[] = [
  "cpu_percent",
  "memory_used",
  "disk_used",
  "cpu_load",
  "net_sent_rate",
  "net_recv_rate"
];

export const DEFAULT_METRICS: MonitorMetric[] = [
  "cpu_percent",
  "memory_used",
  "disk_used"
];

/** 时间范围预设（键 → 秒），与后端 HISTORY_RANGES 同口径 */
export const RANGE_SECONDS: Record<string, number> = {
  "1h": 3600,
  "6h": 21600,
  "24h": 86400,
  "7d": 604800,
  "30d": 2592000
};

/** 聚合粒度选项（auto 由后端按窗口长度推导） */
export const INTERVAL_OPTIONS = ["auto", "1m", "5m", "15m", "1h", "1d"];

export function rangeSpanSeconds(rangeKey: string): number {
  return RANGE_SECONDS[rangeKey] ?? RANGE_SECONDS["24h"];
}

/** 趋势 x 轴时间标签：跨度越大越粗（>2 天仅日期，>1 天带日期，其余时分） */
export function formatHistoryTime(iso: string, spanSeconds: number): string {
  if (!iso) return "";
  const date = iso.slice(5, 10);
  const time = iso.slice(11, 16);
  if (spanSeconds > 172800) return date;
  // 24 小时窗口会跨天，标签必须带日期避免歧义
  if (spanSeconds >= 86400) return `${date} ${time}`;
  return time;
}

/** 网络速率自适应单位：<1024 显示 KB/s，否则 MB/s */
export function formatRate(value: number | null | undefined): string {
  if (value == null) return "—";
  if (value < 1024) return `${value} KB/s`;
  return `${(value / 1024).toFixed(2)} MB/s`;
}

/** 指标数值展示：带单位；空值用破折号 */
export function formatMetricValue(
  metric: MonitorMetric,
  value: number | null | undefined
): string {
  if (value == null) return "—";
  const unit = METRIC_META[metric]?.unit ?? "";
  return `${value}${unit}`;
}

/** 环比展示：+x% / -x%，无基线时返回 null 表示不展示 */
export function formatComparePercent(
  percent: number | null | undefined
): string | null {
  if (percent == null) return null;
  const sign = percent > 0 ? "+" : "";
  return `${sign}${percent}%`;
}

/** 取某指标的汇总统计（缺失时返回空统计） */
export function metricStat(
  history: MonitorHistory | null,
  metric: MonitorMetric
): MonitorMetricStat {
  const fallback: MonitorMetricStat = {
    min: null,
    max: null,
    avg: null,
    last: null
  };
  return history?.summary?.[metric] ?? fallback;
}

/** 指标 x 轴点序列（缺失点跳过，保持与 labels 对齐的另一份索引） */
export function buildSeries(
  history: MonitorHistory | null,
  metric: MonitorMetric
): (number | null)[] {
  return (history?.points ?? []).map(point => point[metric] ?? null);
}

/** 分享链接查询串：仅保留可复现视图的筛选参数 */
export function buildShareQuery(state: {
  range: string;
  interval: string;
  metrics: MonitorMetric[];
}): string {
  const params = new URLSearchParams();
  params.set("range", state.range);
  params.set("interval", state.interval);
  params.set("metrics", state.metrics.join(","));
  return params.toString();
}

/** 解析分享链接查询参数（非法值回退默认） */
export function parseShareQuery(query: Record<string, unknown>): {
  range: string;
  interval: string;
  metrics: MonitorMetric[];
} {
  const range =
    typeof query.range === "string" && query.range in RANGE_SECONDS
      ? query.range
      : "24h";
  const interval =
    typeof query.interval === "string" &&
    INTERVAL_OPTIONS.includes(query.interval)
      ? query.interval
      : "auto";
  const rawMetrics = typeof query.metrics === "string" ? query.metrics : "";
  const metrics = rawMetrics
    .split(",")
    .map(item => item.trim())
    .filter((item): item is MonitorMetric =>
      METRIC_OPTIONS.includes(item as MonitorMetric)
    );
  return {
    range,
    interval,
    metrics: metrics.length ? metrics : [...DEFAULT_METRICS]
  };
}

const ITEM_LABEL_KEYS: Record<string, string> = {
  cpu_percent: "systemMonitor.metricCpu",
  cpu_load: "systemMonitor.metricCpuLoad",
  memory_used: "systemMonitor.metricMemory",
  disk_used: "systemMonitor.metricDisk",
  net_sent_rate: "systemMonitor.metricNetSent",
  net_recv_rate: "systemMonitor.metricNetRecv"
};

/** 指标/告警项的 i18n key（未知键回退原文，保证不出现空文案） */
export function metricLabelKey(key: string): string {
  return ITEM_LABEL_KEYS[key] ?? key;
}
