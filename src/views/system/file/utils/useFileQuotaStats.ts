import { computed, onMounted, ref } from "vue";
import { SUCCESS_CODE } from "@/api/types";
import { systemUploadFileApi } from "@/api/system/file";
import { getDictItems } from "@/utils/dict";
import type { PageColumn } from "@/components/RePlusPage";
import { UPLOAD_CATEGORY_DICT, type FileStats } from "./fileStats";

/**
 * 文件配额统计与分类下拉选项。
 * 自 useSystemUploadFile 拆出（行为不变）：顶部使用率卡片数据源（服务端 10s 短缓存）
 * 与 category 搜索下拉（upload_category 字典，与表单下拉同源）。
 */
export function useFileQuotaStats({ hasListAuth }: { hasListAuth: boolean }) {
  // 个人配额统计：顶部使用率卡片数据源（服务端 10s 短缓存）
  const stats = ref<FileStats | null>(null);
  const loadStats = (fresh = false) => {
    // 无列表权限时页面不渲染，也不发起统计请求（避免无谓的 403 提示）
    if (!hasListAuth) return;
    // fresh=true 走 ?no_cache=1 旁路服务端短缓存（上传后立即刷新场景）
    systemUploadFileApi
      .stats(fresh ? { no_cache: "1" } : undefined)
      .then(res => {
        if (res.code === SUCCESS_CODE) stats.value = res.data as FileStats;
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
