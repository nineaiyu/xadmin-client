import { h, ref, type Ref } from "vue";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { message } from "@/utils/message";
import { SUCCESS_CODE } from "@/api/types";
import type { useI18n } from "vue-i18n";
import { dashboardApi, type DashboardItem } from "@/api/dataset/datasets";
import DashboardCreateForm from "../components/DashboardCreateForm.vue";
import { normalizeError } from "@/utils/apiError";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 仪表盘新建 / 设置弹窗（同一表单组件双模式）：确认后各自提交 create /
 * partialUpdate 并回写列表。抽出独立 composable 控制页面体积（行数门禁）。
 */
export function useDashboardDialogs({
  t,
  dashboards,
  current,
  reload,
  syncQuery
}: {
  t: TFunction;
  dashboards: Ref<DashboardItem[]>;
  current: Ref<DashboardItem | null>;
  /** 重载列表（新建成功后重新拉取并定位） */
  reload: () => Promise<void>;
  /** 把当前仪表盘 pk 写回地址栏 */
  syncQuery: () => void;
}) {
  // ---- 新建仪表盘弹窗 ----
  const dashFormRef = ref<InstanceType<typeof DashboardCreateForm>>();

  const openCreateDashboard = () => {
    dashFormRef.value = undefined;
    addDialog({
      title: t("dashboard.create"),
      width: dialogSize("sm"),
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      sureBtnLoading: true,
      contentRenderer: () => h(DashboardCreateForm, { ref: dashFormRef }),
      beforeSure: async (done, { closeLoading }) => {
        const payload = dashFormRef.value?.getPayload();
        if (!payload) {
          closeLoading();
          return;
        }
        // 异常归一为可读失败结果：避免请求异常时 beforeSure 抛错、弹窗 loading 悬挂
        const res = await dashboardApi
          .create<DashboardItem>({ ...payload, layout: [] })
          .catch(normalizeError);
        if (res.code === SUCCESS_CODE) {
          message(t("dashboard.saveOk"), { type: "success" });
          // 先关弹窗再刷新列表（与原手写弹窗行为一致，避免刷新耗时导致弹窗滞留）
          done();
          current.value = null;
          await reload();
          current.value =
            dashboards.value.find(item => item.pk === res.data?.pk) ?? null;
          syncQuery();
          return;
        }
        // 200 + 业务码非 1000：全局拦截器只处理 HTTP 层错误，业务失败必须显式提示
        if (res.detail) message(String(res.detail), { type: "error" });
        closeLoading();
      }
    });
  };

  // ---- 仪表盘设置弹窗（重命名 / 可见性；与新建表单同构） ----
  const dashSettingsRef = ref<InstanceType<typeof DashboardCreateForm>>();

  const openDashboardSettings = () => {
    if (!current.value) return;
    const editingPk = current.value.pk;
    dashSettingsRef.value = undefined;
    addDialog({
      title: t("dashboard.settings"),
      width: dialogSize("sm"),
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      sureBtnLoading: true,
      contentRenderer: () =>
        h(DashboardCreateForm, { ref: dashSettingsRef, row: current.value }),
      beforeSure: async (done, { closeLoading }) => {
        const payload = dashSettingsRef.value?.getPayload();
        if (!payload) {
          closeLoading();
          return;
        }
        const res = await dashboardApi
          .partialUpdate<DashboardItem>(editingPk, payload)
          .catch(normalizeError);
        if (res.code === SUCCESS_CODE) {
          message(t("dashboard.saveOk"), { type: "success" });
          done();
          const index = dashboards.value.findIndex(
            item => item.pk === editingPk
          );
          if (index >= 0 && res.data) {
            dashboards.value[index] = res.data;
            current.value = dashboards.value[index];
          }
          return;
        }
        if (res.detail) message(String(res.detail), { type: "error" });
        closeLoading();
      }
    });
  };

  return { openCreateDashboard, openDashboardSettings };
}
