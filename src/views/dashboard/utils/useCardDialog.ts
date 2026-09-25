import { h, ref, type Ref } from "vue";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import CardForm from "../components/CardForm.vue";
import type { useI18n } from "vue-i18n";
import type { DashboardCard, DatasetItem } from "@/api/system/datasets";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 卡片弹窗（新建 / 编辑双模式）：表单确认后写入页面内存草稿（draftLayout），
 * 随「保存布局」统一提交；抽出独立 composable 控制页面体积（行数门禁）。
 */
export function useCardDialog({
  t,
  datasets,
  updateDraft
}: {
  t: TFunction;
  datasets: Ref<DatasetItem[]>;
  updateDraft: (updater: (layout: DashboardCard[]) => DashboardCard[]) => void;
}) {
  const cardFormRef = ref<InstanceType<typeof CardForm>>();

  function newCard(): DashboardCard {
    return {
      id: `card-${Date.now()}`,
      dataset: "",
      title: "",
      chart_type: "number",
      metric: "count",
      span: 6,
      height: 224
    };
  }

  const openCardDialog = () => openCardSettings(null);

  /** 编辑既有卡片（null = 新建）：确认后原位更新内存草稿 */
  const openCardSettings = (card: DashboardCard | null) => {
    const editingId = card?.id ?? null;
    cardFormRef.value = undefined;
    addDialog({
      title: editingId ? t("dashboard.editCard") : t("dashboard.addCard"),
      width: dialogSize("sm"),
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      contentRenderer: () =>
        h(CardForm, {
          ref: cardFormRef,
          card: card ?? newCard(),
          datasets: datasets.value
        }),
      beforeSure: (done, { closeLoading }) => {
        const updated = cardFormRef.value?.getPayload();
        if (!updated) {
          closeLoading();
          return;
        }
        updateDraft(layout =>
          editingId
            ? layout.map(item =>
                item.id === editingId ? { ...updated, id: item.id } : item
              )
            : [...layout, { ...updated }]
        );
        done();
      }
    });
  };

  return { openCardSettings, openCardDialog };
}
