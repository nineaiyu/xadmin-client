import { h, ref } from "vue";
import type { Ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  addDialog,
  closeDialog,
  type DialogOptions
} from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { useDialogForm } from "@/hooks/useDialogForm";
import { screenApi, type ScreenItem } from "@/api/dataset/analysis";
import type { DashboardItem } from "@/api/dataset/datasets";
import ScreenForm from "../components/ScreenForm.vue";
import ScreenControlForm from "../components/ScreenControlForm.vue";

/**
 * 大屏弹窗（自 hook.tsx 抽出，行数门禁）：新建/编辑（ReDialog + ScreenForm，
 * 仪表盘序列多选在表单内收敛）与远程控制（ReDialog + ScreenControlForm，
 * 指令经 REST 落态并广播到展示端）。
 */
export function useScreenDialogs({
  dashboards,
  tableRef
}: {
  dashboards: Ref<DashboardItem[]>;
  tableRef: Ref;
}) {
  const { t } = useI18n();
  const formRef = ref<InstanceType<typeof ScreenForm>>();

  const openControl = (row: ScreenItem) => {
    // 按大屏自身的仪表盘序列传参（顺序即服务端下标序）；浏览者不可见的仪表盘
    // （personal 对他人不在可见列表）名称回落为显式占位文案，避免裸 pk 直出
    const options: DialogOptions = {
      title: `${t("dataScreen.remoteControl")} - ${row.name}`,
      width: dialogSize("md"),
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      hideFooter: true,
      contentRenderer: () =>
        h(ScreenControlForm, {
          row,
          dashboards: (row.dashboards ?? []).map(pk => ({
            pk,
            name:
              dashboards.value.find(item => item.pk === pk)?.name ??
              t("dataScreen.dashboardHidden")
          })),
          onClose: () => closeDialog(options, 0)
        })
    };
    addDialog(options);
  };

  const openDialog = (row: ScreenItem | null) => {
    formRef.value = undefined;
    // 显式指定载荷泛型：ref 包装的实例类型无法从 getPayload 返回类型反推（TS 退化 unknown）
    const { beforeSure } = useDialogForm<Record<string, unknown>>({
      formRef,
      submit: payload =>
        row
          ? screenApi.partialUpdate(row.pk, payload)
          : screenApi.create(payload),
      successText: t("dataScreen.saveOk"),
      // 先关弹窗再刷新列表，避免刷新耗时导致弹窗滞留（useDialogForm 内 done 先于回调）
      onSuccess: () => tableRef.value?.handleGetData()
    });
    addDialog({
      title: row ? t("dataScreen.edit") : t("dataScreen.create"),
      width: dialogSize("md"),
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      sureBtnLoading: true,
      contentRenderer: () =>
        h(ScreenForm, { ref: formRef, row, dashboards: dashboards.value }),
      beforeSure
    });
  };

  return { openControl, openDialog };
}
