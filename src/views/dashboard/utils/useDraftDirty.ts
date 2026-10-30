import { computed, type Ref } from "vue";
import type { DashboardCard, DashboardItem } from "@/api/dataset/datasets";

/** 编辑态草稿是否与已保存布局不同（取消 / 切盘前的确认判据）。 */
export function useDraftDirty(
  editing: Ref<boolean>,
  draftLayout: Ref<DashboardCard[]>,
  current: Ref<DashboardItem | null>
) {
  return computed(
    () =>
      editing.value &&
      JSON.stringify(draftLayout.value) !==
        JSON.stringify(current.value?.layout ?? [])
  );
}
