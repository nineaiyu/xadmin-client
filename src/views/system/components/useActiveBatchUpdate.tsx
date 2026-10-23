import type { Ref } from "vue";
import type { useI18n } from "vue-i18n";
import {
  useBatchUpdate,
  type BatchUpdateApi
} from "@/views/system/components/useBatchUpdate";

/**
 * 「勾选行 → 布尔字段 → batch-update」的窄封装。
 *
 * 角色 / 用户 / 部门 / 岗位页的批量启用只是同一个布尔字段按页替换 key 与文案，
 * 权限位（`canBatch`）仍由页面显式传入，保持 fail-closed 与各页原有权限码。
 */
export function useActiveBatchUpdate(options: {
  t: ReturnType<typeof useI18n>["t"];
  api: BatchUpdateApi;
  tableRef: Ref;
  key?: string;
  labelKey?: string;
  canBatch?: boolean;
}) {
  const {
    t,
    api,
    tableRef,
    key = "is_active",
    labelKey = "commonLabels.is_active",
    canBatch
  } = options;
  return useBatchUpdate({
    t,
    api,
    tableRef,
    canBatch,
    fields: [{ key, label: t(labelKey), input_type: "boolean" }]
  });
}
