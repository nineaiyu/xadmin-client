import { computed, ref } from "vue";
import type { Ref } from "vue";
import { isSuccess } from "@/api/types";
import {
  dashboardApi,
  type DashboardCard,
  type DashboardItem
} from "@/api/dataset/datasets";
import { message } from "@/utils/message";
import { createDraftSortable, moveCardInList } from "./dashboardActions";
import { useDraftDirty } from "./useDraftDirty";

type Translate = (key: string) => string;

/** 仪表盘编辑态：草稿布局 / 拖拽排序 / 保存提交 / 卡片增删移（编辑期变更落草稿，保存才提交） */
export function useDashboardEditing(options: {
  t: Translate;
  current: Ref<DashboardItem | null>;
  dashboards: Ref<DashboardItem[]>;
}) {
  const { t, current, dashboards } = options;
  const editing = ref(false);
  const saving = ref(false);
  /** 编辑态草稿：拖拽排序/增删卡片落在草稿上，保存才提交后端 */
  const draftLayout = ref<DashboardCard[]>([]);
  const layout = computed<DashboardCard[]>(() =>
    editing.value ? draftLayout.value : (current.value?.layout ?? [])
  );
  const layoutKey = computed(() =>
    draftLayout.value.map(card => card.id).join("|")
  );
  const dirty = useDraftDirty(editing, draftLayout, current);
  const rowRef = ref();
  const { init: setupSortable, destroy: destroySortable } = createDraftSortable(
    draftLayout,
    () => rowRef.value?.$el as HTMLElement | undefined
  );
  const stopEditing = () => {
    if (!editing.value) return;
    editing.value = false;
    destroySortable();
  };

  const toggleEdit = () => {
    if (!current.value) return;
    if (!editing.value) {
      draftLayout.value = JSON.parse(
        JSON.stringify(current.value.layout ?? [])
      );
      editing.value = true;
      setupSortable();
    } else {
      stopEditing();
    }
  };

  const saveLayout = async () => {
    if (!current.value) return;
    // 防重：连点只发一次 PATCH（partialUpdate 异步，竞态会并发写同一 layout）
    if (saving.value) return;
    saving.value = true;
    try {
      const res = await dashboardApi.partialUpdate<DashboardItem>(
        current.value.pk,
        {
          layout: draftLayout.value
        }
      );
      if (isSuccess(res)) {
        message(t("dashboard.saveOk"), { type: "success" });
        const index = dashboards.value.findIndex(
          item => item.pk === current.value?.pk
        );
        if (index >= 0 && res.data) {
          dashboards.value[index] = res.data;
          current.value = dashboards.value[index];
        }
        stopEditing();
        return;
      }
      // 200 + 业务码非 1000：全局拦截器只处理 HTTP 层错误，业务失败必须显式提示
      if (res.detail) message(String(res.detail), { type: "error" });
    } finally {
      saving.value = false;
    }
  };

  const removeCard = (id: string) => {
    draftLayout.value = draftLayout.value.filter(card => card.id !== id);
  };

  /** 编辑态键盘可用的卡片排序（拖拽手柄之外的替代入口） */
  const moveCard = (id: string, offset: number) => {
    const next = moveCardInList(draftLayout.value, id, offset);
    if (next !== draftLayout.value) draftLayout.value = next;
  };

  /** 卡片弹窗的草稿更新入口（useCardDialog 双/新建模式共用） */
  const updateDraft = (
    updater: (draft: DashboardCard[]) => DashboardCard[]
  ) => {
    draftLayout.value = updater(draftLayout.value);
  };

  return {
    dirty,
    editing,
    layout,
    layoutKey,
    moveCard,
    removeCard,
    rowRef,
    saveLayout,
    saving,
    stopEditing,
    toggleEdit,
    updateDraft
  };
}
