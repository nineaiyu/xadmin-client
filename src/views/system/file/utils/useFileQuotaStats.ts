import { computed, onMounted, ref } from "vue";
import { isSuccess } from "@/api/types";
import { normalizeError } from "@/utils/apiError";
import { systemUploadFileApi } from "@/api/file/file";
import { getDictItems } from "@/utils/dict";
import type { PageColumn } from "@/components/RePlusPage";
import { UPLOAD_CATEGORY_DICT, type FileStats } from "./fileStats";

/**
 * 文件配额统计与分类下拉选项。
 * 自 useSystemUploadFile 拆出：顶部使用率卡片数据源（服务端 10s 短缓存）
 * 与 category 搜索下拉（upload_category 字典，与表单下拉同源）。
 */
export function useFileQuotaStats({ hasStatsAuth }: { hasStatsAuth: boolean }) {
  // 个人配额统计：顶部使用率卡片数据源（服务端 10s 短缓存）
  const stats = ref<FileStats | null>(null);
  const loadStats = (fresh = false) => {
    // 统计端点由 retrieve:SystemUploadFile 权限点覆盖（详情同权，服务端权限链
    // 按路径匹配）：无该权限时不发起请求（否则必然 403 提示）
    if (!hasStatsAuth) return;
    // fresh=true 走 ?no_cache=1 旁路服务端短缓存（上传后立即刷新场景）
    systemUploadFileApi
      .stats(fresh ? { no_cache: "1" } : undefined)
      .catch(normalizeError)
      .then(res => {
        if (isSuccess(res)) stats.value = res.data as FileStats;
      });
  };
  onMounted(loadStats);

  // 分类下拉选项：category 在后端是 CharFilter（search-fields 元数据无 choices），
  // 选项来源与 DictChoiceField 保持同源（upload_category 字典），保证与表单下拉一致
  const categoryOptions = ref<Array<{ label: string; value: unknown }>>([]);
  getDictItems(UPLOAD_CATEGORY_DICT).then(items => {
    categoryOptions.value = items.map(item => ({
      label: String(item.label ?? item.value ?? ""),
      value: item.value
    }));
  });

  /** 搜索区 category 列：改为下拉（选项与上传表单同源） */
  const searchColumnsFormat = (columns: PageColumn[]) => {
    columns.forEach(column => {
      if (column._column?.key === "category") {
        column.valueType = "select";
        column.fieldProps = {
          teleported: false,
          filterable: true,
          clearable: true
        };
        column.options = computed(() => categoryOptions.value);
      }
    });
    return columns;
  };

  return {
    stats,
    loadStats,
    searchColumnsFormat
  };
}
