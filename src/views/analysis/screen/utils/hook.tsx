import { SUCCESS_CODE } from "@/api/types";
import { h, onMounted, reactive, ref, shallowRef, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { ElTag } from "element-plus";
import {
  addDialog,
  closeDialog,
  type DialogOptions
} from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { getDefaultAuths, hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { choiceValue, statusTagProps, type StatusTagType } from "@/utils/dict";
import type { OperationProps, PageTableColumn } from "@/components/RePlusPage";
import {
  listDashboards,
  screenApi,
  type ScreenItem
} from "@/api/system/analysis";
import type { DashboardItem } from "@/api/system/datasets";
import ScreenForm from "../components/ScreenForm.vue";
import ScreenControlForm from "../components/ScreenControlForm.vue";

/** 可见性兜底配色（与数据集同款语义） */
const VISIBILITY_TAG: Record<string, StatusTagType> = {
  shared: "success",
  personal: "info"
};

/**
 * 大屏模板：CRUD + 投屏 + 远程控制。
 *
 * - 新建/编辑走 ReDialog + ScreenForm（仪表盘序列多选在表单内收敛）；
 * - 删除保留框架默认入口；投屏为行内按钮（跳独立全屏页，保留原交互）；
 * - 远程控制走 ReDialog + ScreenControlForm（指令经 REST 落态并广播到展示端）；
 * - dashboards 为仪表盘 pk 数组：前端映射名称展示。
 */
export function useScreen(tableRef: Ref) {
  const { t } = useI18n();
  const router = useRouter();
  const api = reactive(screenApi);
  const auth = reactive({
    ...getDefaultAuths("DataScreen"),
    create: false,
    update: false,
    partialUpdate: false
  });
  const canCreate = hasAuth("create:DataScreen");
  const canEdit = hasAuth("partialUpdate:DataScreen");
  const canCommand = hasAuth("command:DataScreen");

  /** 仪表盘清单：列名映射 + 表单多选共用 */
  const dashboards = ref<DashboardItem[]>([]);
  onMounted(async () => {
    dashboards.value = await listDashboards();
  });

  const dashboardName = (pk: string) =>
    dashboards.value.find(item => item.pk === pk)?.name ?? pk;

  const visibilityLabel = (value: string) =>
    value === "shared" ? t("dataScreen.shared") : t("dataScreen.personal");

  const listColumnsFormat = (columns: PageTableColumn[]) => {
    columns.forEach(column => {
      switch (column._column?.key) {
        case "dashboards":
          column["minWidth"] = 220;
          column["cellRenderer"] = ({ row }) => {
            const pks = (row as ScreenItem).dashboards || [];
            return h(
              "span",
              pks.map(pk => dashboardName(pk)).join(" → ") || "—"
            );
          };
          break;
        case "visibility":
          column["cellRenderer"] = ({ row }) => {
            const raw = (row as ScreenItem).visibility;
            const value = choiceValue(raw);
            return h(
              ElTag,
              { size: "small", ...statusTagProps(raw, VISIBILITY_TAG) },
              () => visibilityLabel(value)
            );
          };
          break;
      }
    });
    return columns;
  };

  /** 投屏：新开独立全屏页（隐藏静态路由，保留原交互） */
  const display = (row: ScreenItem) => {
    router.push({ path: "/analysis/screen/display", query: { pk: row.pk } });
  };

  /* ---------------- 远程控制（ReDialog + ScreenControlForm） ---------------- */
  const openControl = (row: ScreenItem) => {
    // 按大屏自身的仪表盘序列传参（顺序即服务端下标序；不可解析的名称回落 pk）
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
            name: dashboards.value.find(item => item.pk === pk)?.name ?? pk
          })),
          onClose: () => closeDialog(options, 0)
        })
    };
    addDialog(options);
  };

  /* ---------------- 新建 / 编辑（ReDialog + ScreenForm） ---------------- */
  const formRef = ref<InstanceType<typeof ScreenForm>>();

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
        ).catch(error => ({
          code: -1,
          detail: String((error as { detail?: string })?.detail ?? error)
        }));
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

  const operationButtonsProps = shallowRef<OperationProps>({
    showNumber: 4,
    width: 240,
    buttons: [
      {
        text: t("dataScreen.display"),
        code: "display",
        props: { type: "success", link: true },
        onClick: ({ row }) => display(row as ScreenItem),
        show: 10
      },
      {
        text: t("dataScreen.remoteControl"),
        code: "command",
        props: { type: "warning", link: true },
        onClick: ({ row }) => openControl(row as ScreenItem),
        show: canCommand && 15
      },
      {
        text: t("dataScreen.edit"),
        code: "edit",
        props: { type: "primary", link: true },
        onClick: ({ row }) => openDialog(row as ScreenItem),
        show: canEdit && 20
      }
    ]
  });

  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [
      {
        text: t("dataScreen.create"),
        code: "create",
        props: { type: "primary" },
        onClick: () => openDialog(null),
        show: canCreate
      }
    ]
  });

  return {
    api,
    auth,
    listColumnsFormat,
    operationButtonsProps,
    tableBarButtonsProps
  };
}
