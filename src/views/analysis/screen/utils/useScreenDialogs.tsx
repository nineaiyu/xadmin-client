import { h, ref } from "vue";
import type { Ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  addDialog,
  closeDialog,
  type DialogOptions
} from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { SUCCESS_CODE } from "@/api/types";
import { message } from "@/utils/message";
import { normalizeError } from "@/utils/apiError";
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
    addDialog({
      title: row ? t("dataScreen.edit") : t("dataScreen.create"),
      width: dialogSize("md"),
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      sureBtnLoading: true,
      contentRenderer: () =>
        h(ScreenForm, { ref: formRef, row, dashboards: dashboards.value }),
      beforeSure: async (done, { closeLoading }) => {
        const payload = formRef.value?.getPayload();
        if (!payload) {
          closeLoading();
          return;
        }
        // 异常归一为可读失败结果：避免请求异常时 beforeSure 抛错、弹窗 loading 悬挂
        const res = await (
          row
            ? screenApi.partialUpdate(row.pk, payload)
            : screenApi.create(payload)
        ).catch(normalizeError);
        if (res.code === SUCCESS_CODE) {
          message(t("dataScreen.saveOk"), { type: "success" });
          // 先关弹窗再刷新列表，避免刷新耗时导致弹窗滞留
          done();
          tableRef.value?.handleGetData();
          return;
        }
        if (res.detail) message(String(res.detail), { type: "warning" });
        closeLoading();
      }
    });
  };

  return { openControl, openDialog };
}
