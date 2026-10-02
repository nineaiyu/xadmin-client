/** 个人文件统计与分类字典（自 useSystemUploadFile 抽出的共享类型与常量） */

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
