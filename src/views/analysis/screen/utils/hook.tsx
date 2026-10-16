import { onMounted, reactive, ref, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { hasAuth, usePageAuth } from "@/router/utils";
import { message } from "@/utils/message";
import {
  listDashboards,
  screenApi,
  type ScreenItem
} from "@/api/dataset/analysis";
import type { DashboardItem } from "@/api/dataset/datasets";
import { useScreenColumns } from "./useScreenColumns";
import { useScreenDialogs } from "./useScreenDialogs";
import { useScreenButtons } from "./useScreenButtons";

/**
 * 大屏模板：CRUD + 投屏 + 远程控制。
 *
 * - 新建/编辑与远程控制弹窗见 useScreenDialogs（ReDialog + 表单，行数门禁拆分）；
 * - 列渲染见 useScreenColumns、按钮装配见 useScreenButtons；
 * - 删除保留框架默认入口；投屏为行内按钮（跳独立全屏页，保留原交互）。
 */
export function useScreen(tableRef: Ref) {
  const { t } = useI18n();
  const router = useRouter();
  const api = reactive(screenApi);
  const auth = usePageAuth("DataScreen");
  auth.create = false;
  auth.update = false;
  auth.partialUpdate = false;
  const canCreate = hasAuth("create:DataScreen");
  const canEdit = hasAuth("partialUpdate:DataScreen");
  const canCommand = hasAuth("command:DataScreen");

  /** 仪表盘清单：列名映射 + 表单多选共用 */
  const dashboards = ref<DashboardItem[]>([]);
  onMounted(async () => {
    // 仪表盘下拉失败不阻塞大屏主链路：显式提示（此前未捕获，失败用户无感知）
    const res = await listDashboards().catch(() => null);
    if (!res) {
      message(t("dataScreen.dashboardsLoadFailed"), { type: "warning" });
      return;
    }
    dashboards.value = res;
  });

  const { listColumnsFormat } = useScreenColumns({ dashboards });
  const { openControl, openDialog } = useScreenDialogs({
    dashboards,
    tableRef
  });

  /** 投屏：新开独立全屏页（隐藏静态路由，保留原交互） */
  const display = (row: ScreenItem) => {
    router.push({ path: "/analysis/screen/display", query: { pk: row.pk } });
  };

  /** 画布设计器：新开独立全屏页（保存走 partialUpdate，需编辑权限） */
  const design = (row: ScreenItem) => {
    router.push({ path: "/analysis/screen/designer", query: { pk: row.pk } });
  };

  const { operationButtonsProps, tableBarButtonsProps } = useScreenButtons({
    canCreate,
    canEdit,
    canCommand,
    display,
    design,
    openControl,
    openDialog
  });

  return {
    api,
    auth,
    listColumnsFormat,
    operationButtonsProps,
    tableBarButtonsProps
  };
}
