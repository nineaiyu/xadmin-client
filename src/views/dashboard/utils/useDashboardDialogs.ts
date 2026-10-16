import { h, ref, type Ref } from "vue";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { useDialogForm } from "@/hooks/useDialogForm";
import type { useI18n } from "vue-i18n";
import { dashboardApi, type DashboardItem } from "@/api/dataset/datasets";
import DashboardCreateForm from "../components/DashboardCreateForm.vue";

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
    // 显式指定载荷泛型：ref 包装的实例类型无法从 getPayload 返回类型反推（TS 退化 unknown）
    const { beforeSure } = useDialogForm<Record<string, unknown>>({
      formRef: dashFormRef,
      submit: payload =>
        dashboardApi.create<DashboardItem>({ ...payload, layout: [] }),
      successText: t("dashboard.saveOk"),
      failType: "error",
      // 先关弹窗再刷新列表（与原手写弹窗行为一致，避免刷新耗时导致弹窗滞留）
      onSuccess: async res => {
        current.value = null;
        await reload();
        const created = res.data as DashboardItem | null | undefined;
        current.value =
          dashboards.value.find(item => item.pk === created?.pk) ?? null;
        syncQuery();
      }
    });
    addDialog({
      title: t("dashboard.create"),
      width: dialogSize("sm"),
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      sureBtnLoading: true,
      contentRenderer: () => h(DashboardCreateForm, { ref: dashFormRef }),
      beforeSure
    });
  };

  // ---- 仪表盘设置弹窗（重命名 / 可见性；与新建表单同构） ----
  const dashSettingsRef = ref<InstanceType<typeof DashboardCreateForm>>();

  const openDashboardSettings = () => {
    if (!current.value) return;
    const editingPk = current.value.pk;
    dashSettingsRef.value = undefined;
    // 显式指定载荷泛型：ref 包装的实例类型无法从 getPayload 返回类型反推（TS 退化 unknown）
    const { beforeSure } = useDialogForm<Record<string, unknown>>({
      formRef: dashSettingsRef,
      submit: payload =>
        dashboardApi.partialUpdate<DashboardItem>(editingPk, payload),
      successText: t("dashboard.saveOk"),
      failType: "error",
      onSuccess: res => {
        const index = dashboards.value.findIndex(item => item.pk === editingPk);
        const updated = res.data as DashboardItem | null | undefined;
        if (index >= 0 && updated) {
          dashboards.value[index] = updated;
          current.value = dashboards.value[index];
        }
      }
    });
    addDialog({
      title: t("dashboard.settings"),
      width: dialogSize("sm"),
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      sureBtnLoading: true,
      contentRenderer: () =>
        h(DashboardCreateForm, { ref: dashSettingsRef, row: current.value }),
      beforeSure
    });
  };

  return { openCreateDashboard, openDashboardSettings };
}
