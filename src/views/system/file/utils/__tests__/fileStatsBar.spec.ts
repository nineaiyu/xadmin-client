import { formatBytes } from "@pureadmin/utils";
import { describe, expect, it } from "vitest";

import { buildFileStatsBarData, type FileStats } from "../fileStats";

/** 统计载荷工厂：只声明本用例关心的字段 */
const makeStats = (patch: Partial<FileStats> = {}): FileStats => ({
  count: 0,
  total_size: 0,
  quota_mb: 0,
  usage_rate: 0,
  remaining_size: null,
  avg_size: 0,
  category_stats: [],
  recent_trend: [],
  top_files: [],
  ...patch
});

describe("buildFileStatsBarData", () => {
  it("有配额：使用率取整、已用/剩余按字节格式化", () => {
    const data = buildFileStatsBarData(
      makeStats({
        count: 12,
        total_size: 3 * 1024 * 1024,
        quota_mb: 100,
        usage_rate: 3.2,
        remaining_size: 97 * 1024 * 1024,
        avg_size: 256 * 1024
      })
    );
    expect(data.hasQuota).toBe(true);
    expect(data.percent).toBe(3);
    expect(data.used).toBe(formatBytes(3 * 1024 * 1024));
    expect(data.remaining).toBe(formatBytes(97 * 1024 * 1024));
    expect(data.count).toBe("12");
    expect(data.avg).toBe(formatBytes(256 * 1024));
  });

  it("无配额（0=不限）：percent 恒 0、remaining 为 null（组件显示「不限」）", () => {
    const data = buildFileStatsBarData(
      makeStats({
        total_size: 1024,
        usage_rate: 0,
        quota_mb: 0,
        remaining_size: null
      })
    );
    expect(data.hasQuota).toBe(false);
    expect(data.percent).toBe(0);
    expect(data.remaining).toBeNull();
  });

  it("超配额：percent 钳到 100（进度条不会溢出）", () => {
    const data = buildFileStatsBarData(
      makeStats({ quota_mb: 10, usage_rate: 137.5, remaining_size: 0 })
    );
    expect(data.percent).toBe(100);
    // 剩余 0 与「无配额」语义不同：仍按数值格式化，不显示「不限」
    expect(data.remaining).toBe(formatBytes(0));
  });

  it("缺失/异常字段按 0 兜底，不产生 NaN", () => {
    // 宽松载荷：模拟后端字段缺失或为 null（类型面按真实载荷声明，取值面按运行时兜底）
    const loose: Record<string, unknown> = {
      ...makeStats(),
      count: null,
      total_size: null,
      usage_rate: undefined,
      avg_size: null
    };
    const data = buildFileStatsBarData(loose as FileStats);
    expect(data.count).toBe("0");
    expect(data.used).toBe(formatBytes(0));
    expect(data.avg).toBe(formatBytes(0));
    expect(data.percent).toBe(0);
  });
});
