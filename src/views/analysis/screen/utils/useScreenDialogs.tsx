import { h } from "vue";
import type { Ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  addDialog,
  closeDialog,
  type DialogOptions
} from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import type { ScreenItem } from "@/api/dataset/analysis";
import type { DashboardItem } from "@/api/dataset/datasets";
import ScreenControlForm from "../components/ScreenControlForm.vue";

/**
 * 大屏弹窗（自 hook.tsx 抽出，行数门禁）：仅保留远程控制（ReDialog +
 * ScreenControlForm，指令经 REST 落态并广播到展示端）。
 *
 * 新建/编辑已迁到框架元数据表单（`useScreenFormOptions`），不再手写表单与提交链路。
 */
export function useScreenDialogs({
  dashboards
}: {
  dashboards: Ref<DashboardItem[]>;
}) {
  const { t } = useI18n();

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

  return { openControl };
}
