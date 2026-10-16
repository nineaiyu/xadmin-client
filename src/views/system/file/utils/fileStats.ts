/** 个人文件统计与分类字典（自 useSystemUploadFile 抽出的共享类型与常量） */
import { formatBytes } from "@pureadmin/utils";

/** 分类分布项（stats.category_stats）：value 为 null 表示未分类 */
export type FileCategoryStat = {
  value: string | null;
  /** 分类展示名来自 upload_category 字典；未分类为 null（前端 i18n 兜底） */
  label: string | null;
  color: string | null;
  count: number;
  size: number;
};

/** 单日上传趋势（stats.recent_trend，后端已补齐缺失日期） */
export type FileTrendPoint = {
  date: string;
  count: number;
  size: number;
};

/** 占用空间最大的文件（stats.top_files） */
export type FileTopItem = {
  pk: string;
  filename: string;
  filesize: number;
};

/** 个人文件统计载荷（system/views/admin/file.py::stats） */
export type FileStats = {
  count: number;
  total_size: number;
  quota_mb: number;
  usage_rate: number;
  /** 剩余空间：无配额（0=不限）时为 null，前端显示「不限」 */
  remaining_size: number | null;
  avg_size: number;
  category_stats: FileCategoryStat[];
  recent_trend: FileTrendPoint[];
  top_files: FileTopItem[];
};

/** 顶部紧凑指标条的展示口径（纯函数，便于单测边界） */
export type FileStatsBarData = {
  /** 是否配置了配额（0 = 不限） */
  hasQuota: boolean;
  /** 使用率（0~100 取整；无配额恒 0，超配额钳到 100） */
  percent: number;
  used: string;
  /** 剩余空间文案值：无配额时为 null，由组件显示「不限」 */
  remaining: string | null;
  count: string;
  avg: string;
};

/**
 * 统计载荷 → 指标条取值。
 *
 * 无配额（quota_mb=0）时后端 usage_rate 恒 0、remaining_size 为 null：此处保持
 * 「不显示 0%」的既有口径（组件按 hasQuota 分支），避免把「不限」误读为「未使用」。
 */
export function buildFileStatsBarData(stats: FileStats): FileStatsBarData {
  const quota = Number(stats.quota_mb) || 0;
  const count = Number(stats.count) || 0;
  return {
    hasQuota: quota > 0,
    percent: quota
      ? Math.min(100, Math.round(Number(stats.usage_rate) || 0))
      : 0,
    used: formatBytes(Number(stats.total_size) || 0),
    remaining:
      stats.remaining_size == null ? null : formatBytes(stats.remaining_size),
    count: String(count),
    avg: formatBytes(Number(stats.avg_size) || 0)
  };
}

/** 分类字典 code：与 UploadFileSerializer.category 的 DictChoiceField 同源 */
export const UPLOAD_CATEGORY_DICT = "upload_category";

/** 分类下拉条目（label 取字典 label，缺省回退 value） */
export const mapCategoryOptions = (
  items: Array<{ label?: unknown; value?: unknown }>
): Array<{ label: string; value: unknown }> =>
  items.map(item => ({
    label: String(item.label ?? item.value ?? ""),
    value: item.value
  }));
