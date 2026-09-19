import { describe, expect, it } from "vitest";
import type { MonitorHistory } from "@/api/system/monitor";
import {
  DEFAULT_METRICS,
  buildSeries,
  buildShareQuery,
  formatComparePercent,
  formatHistoryTime,
  formatMetricValue,
  formatRate,
  metricLabelKey,
  metricStat,
  parseShareQuery
} from "../format";

function makeHistory(): MonitorHistory {
  return {
    range: {
      start: "2026-09-19T00:00:00+08:00",
      end: "2026-09-19T06:00:00+08:00",
      interval: "5m",
      interval_seconds: 300,
      range_key: "6h"
    },
    metrics: ["cpu_percent", "net_sent_rate"],
    points: [
      {
        time: "2026-09-19T00:00:00+08:00",
        cpu_percent: 10,
        net_sent_rate: 512
      },
      { time: "2026-09-19T00:05:00+08:00", cpu_percent: 20 },
      {
        time: "2026-09-19T00:10:00+08:00",
        cpu_percent: 30,
        net_sent_rate: 2048
      }
    ],
    summary: {
      cpu_percent: { min: 10, max: 30, avg: 20, last: 30 }
    },
    compare: {
      cpu_percent: { prev_avg: 16, delta: 4, percent: 25 }
    },
    raw_points: 36
  };
}

describe("formatHistoryTime", () => {
  it("按跨度切换精度（时分 / 日期时分 / 日期）", () => {
    expect(formatHistoryTime("2026-09-19T08:30:00+08:00", 3600)).toBe("08:30");
    expect(formatHistoryTime("2026-09-19T08:30:00+08:00", 86400)).toBe(
      "09-19 08:30"
    );
    expect(formatHistoryTime("2026-09-19T08:30:00+08:00", 2592000)).toBe(
      "09-19"
    );
    expect(formatHistoryTime("", 3600)).toBe("");
  });
});

describe("formatRate / formatMetricValue / formatComparePercent", () => {
  it("速率自适应单位", () => {
    expect(formatRate(512)).toBe("512 KB/s");
    expect(formatRate(2048)).toBe("2.00 MB/s");
    expect(formatRate(null)).toBe("—");
  });

  it("指标值带单位、空值为破折号", () => {
    expect(formatMetricValue("cpu_percent", 42.5)).toBe("42.5%");
    expect(formatMetricValue("cpu_load", 0.7)).toBe("0.7");
    expect(formatMetricValue("disk_used", null)).toBe("—");
  });

  it("环比带符号、无基线不展示", () => {
    expect(formatComparePercent(12.3)).toBe("+12.3%");
    expect(formatComparePercent(-5)).toBe("-5%");
    expect(formatComparePercent(null)).toBeNull();
  });
});

describe("metricStat / buildSeries", () => {
  it("缺失统计回落空值，序列跳过缺失点", () => {
    const history = makeHistory();
    expect(metricStat(history, "cpu_percent").avg).toBe(20);
    expect(metricStat(history, "disk_used").avg).toBeNull();
    expect(buildSeries(history, "cpu_percent")).toEqual([10, 20, 30]);
    expect(buildSeries(history, "net_sent_rate")).toEqual([512, null, 2048]);
    expect(buildSeries(null, "cpu_percent")).toEqual([]);
  });
});

describe("分享链接参数", () => {
  it("生成与解析往返一致", () => {
    const query = buildShareQuery({
      range: "7d",
      interval: "1h",
      metrics: ["cpu_percent", "net_recv_rate"]
    });
    const parsed = parseShareQuery(
      Object.fromEntries(new URLSearchParams(query))
    );
    expect(parsed.range).toBe("7d");
    expect(parsed.interval).toBe("1h");
    expect(parsed.metrics).toEqual(["cpu_percent", "net_recv_rate"]);
  });

  it("非法值回退默认", () => {
    const parsed = parseShareQuery({
      range: "10y",
      interval: "3s",
      metrics: "unknown,"
    });
    expect(parsed.range).toBe("24h");
    expect(parsed.interval).toBe("auto");
    expect(parsed.metrics).toEqual(DEFAULT_METRICS);
  });
});

describe("metricLabelKey", () => {
  it("已知指标映射到 i18n key，未知键原样返回", () => {
    expect(metricLabelKey("cpu_percent")).toBe("systemMonitor.metricCpu");
    expect(metricLabelKey("net_sent_rate")).toBe("systemMonitor.metricNetSent");
    expect(metricLabelKey("custom_item")).toBe("custom_item");
  });
});
