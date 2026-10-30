import { computed, type Ref } from "vue";
import type { BaseApi } from "@/api/base";
import type { PageColumn, RecycleBinColumn, RePlusPageProps } from "./types";

/**
 * 内建回收站入口（自 index.vue 抽出，行数门禁）：`recycleBin` prop 开启且具备
 * recycleList 权限时渲染通用回收站抽屉，数据变动直接联动列表刷新，调用方无需
 * 再经 barButtons 插槽自行接线。
 *
 * `recycleBin` 传数组 = 自定义列；传 true = 与主列表同字段展示（回收站接口与
 * list 同口径序列化，剔除多选/操作列、透传 cellRenderer）。
 */
export function useRecycleBin(
  props: RePlusPageProps,
  listColumns: Ref<PageColumn[]>
) {
  const recycleBinEnabled = computed(
    () => !!props.recycleBin && !!props.auth?.recycleList
  );
  const canRestore = computed(() => !!props.auth?.recycleRestore);
  const canPurge = computed(() => !!props.auth?.recyclePurge);

  const recycleBinColumns = computed<RecycleBinColumn[]>(() => {
    if (Array.isArray(props.recycleBin)) return props.recycleBin;
    if (props.recycleBin !== true) return [];
    return listColumns.value
      .filter(
        column =>
          column.prop &&
          !["selection", "operation"].includes(column._column?.key ?? "")
      )
      .map(column => ({
        prop: column.prop,
        label: column.label,
        cellRenderer: column.cellRenderer as
          RecycleBinColumn["cellRenderer"] | undefined
      }));
  });

  // recycleBin 仅应配置在完整 BaseApi（含 recycle 三方法）的页面；
  // api prop 声明为 Partial<BaseApi> 以宽容各类页面，在此边界收窄
  const recycleBinApi = computed(() => props.api as BaseApi);

  return {
    recycleBinEnabled,
    recycleBinColumns,
    recycleBinApi,
    canRestore,
    canPurge
  };
}
