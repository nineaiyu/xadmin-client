import {
  computed,
  getCurrentInstance,
  h,
  reactive,
  shallowRef,
  type Ref
} from "vue";
import { useI18n } from "vue-i18n";
import { ElProgress, ElTag } from "element-plus";
import type { RecordType } from "plus-pro-components";
import { SUCCESS_CODE } from "@/api/types";
import {
  taskCenterApi,
  taskExecutionApi,
  type TaskCenterKind
} from "@/api/system/task";
import { getDefaultAuths, hasAuth } from "@/router/utils";
import { statusTagProps } from "@/utils/dict";
import { message } from "@/utils/message";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { openTaskLogDialog } from "@/views/system/components/taskLogDialog";
import type {
  OperationProps,
  PageColumn,
  PageTableColumn
} from "@/components/RePlusPage";
import FileList from "~icons/ri/file-list-3-line";

/**
 * 任务日志（执行历史）列表：所有 celery 任务一行一条。
 *
 * 导出/导入/报表产物任务与执行记录共用主键，列表按 pk 带出产物信息
 * （类型 / 业务名 / 进度 / 阶段 / 产物文件），因此同一件事只有一个入口：
 * 查看日志、取消、重跑、下载产物、删除/批量删除都在本页完成。
 */
type ExecutionRow = {
  pk?: string | number;
  id?: string | number;
  name?: string;
  product_type?: string;
  product_name?: string;
  product_progress?: number;
  product_stage?: string;
  product_has_file?: boolean;
  can_cancel?: boolean;
  can_rerun?: boolean;
  status?: { value?: string; label?: string } | string;
  time_cost?: number | null;
};

/** 产物类型标签语义色（非产物任务为「任务」默认色） */
const PRODUCT_TAG_TYPE: Record<string, "primary" | "success" | "warning"> = {
  export: "success",
  import: "warning"
};

export function useTaskExecution(tableRef?: Ref) {
  const api = reactive(taskExecutionApi);
  const auth = reactive({ ...getDefaultAuths(getCurrentInstance(), ["log"]) });
  // 取消 / 重跑走聚合端点，其权限点是另一个资源名（SystemTaskCenter），
  // 不能靠 getDefaultAuths 的组件名推导，直接按权限点判定
  const canCancel = hasAuth("cancel:SystemTaskCenter");
  const canRerun = hasAuth("rerun:SystemTaskCenter");
  const { t } = useI18n();

  const asRow = (row: unknown) => row as ExecutionRow;

  const statusValue = (row: ExecutionRow) => {
    const status = row.status;
    return typeof status === "object" && status ? status.value : status;
  };

  const refresh = () => tableRef?.value?.handleGetData?.();

  /** 打开某条执行记录的实时日志弹窗（WebSocket 增量推送） */
  const openLog = (row: ExecutionRow) => {
    const name = row.product_name || row.name || "";
    openTaskLogDialog(
      row.pk ?? row.id ?? "",
      `${name} ${t("systemTask.logTitle")}`
    );
  };

  /** 取消 / 重跑：走任务中心聚合端点（产物类型取行上注解，非产物任务为 task） */
  const runCenterAction = async (
    row: ExecutionRow,
    action: "cancel" | "rerun"
  ) => {
    const kind = (row.product_type || "task") as TaskCenterKind;
    const res = await taskCenterApi[action](kind, String(row.pk ?? "")).catch(
      error => ({
        code: -1,
        detail: String((error as { detail?: string })?.detail ?? error)
      })
    );
    if (res.code === SUCCESS_CODE) {
      message(
        String(
          res.detail ??
            t(
              action === "cancel"
                ? "taskCenter.cancelDone"
                : "taskCenter.rerunDone"
            )
        ),
        { type: "success" }
      );
      refresh();
    } else if (res.detail) {
      message(String(res.detail), { type: "warning" });
    }
  };

  /** 产物下载：导出 / 导入记录各自端点（与下载中心同一链路） */
  const download = (row: ExecutionRow) => {
    const prefix = row.product_type === "import" ? "imports" : "exports";
    window.open(`/api/system/${prefix}/${row.pk}/download`, "_blank");
  };

  const operationButtonsProps = shallowRef<OperationProps>({
    showNumber: 5,
    buttons: [
      {
        text: t("taskCenter.cancel"),
        code: "cancel",
        props: { type: "warning", link: true },
        show: (row: RecordType) =>
          canCancel && asRow(row).can_cancel ? -40 : false,
        onClick: ({ row }) => runCenterAction(asRow(row), "cancel")
      },
      {
        text: t("taskCenter.rerun"),
        code: "rerun",
        props: { type: "primary", link: true },
        show: (row: RecordType) =>
          canRerun && asRow(row).can_rerun ? -30 : false,
        onClick: ({ row }) => runCenterAction(asRow(row), "rerun")
      },
      {
        text: t("taskCenter.download"),
        code: "download",
        props: { type: "primary", link: true },
        show: (row: RecordType) => (asRow(row).product_has_file ? -20 : false),
        onClick: ({ row }) => download(asRow(row))
      },
      {
        text: t("systemTaskExecution.log"),
        code: "log",
        props: {
          type: "primary",
          icon: useRenderIcon(FileList),
          link: true
        },
        show: auth.log && -10,
        onClick: ({ row }) => openLog(asRow(row))
      }
    ]
  });

  /** 搜索区：记录类型选项文案走前端词条（后端 choices 为英文 msgid，无中文翻译包） */
  const searchColumnsFormat = (columns: PageColumn[]) => {
    columns.forEach(column => {
      if (column._column?.key !== "product_type") return;
      column.options = computed(() => [
        { label: t("taskCenter.type_task"), value: "task" },
        { label: t("taskCenter.type_export"), value: "export" },
        { label: t("taskCenter.type_import"), value: "import" }
      ]);
    });
    return columns;
  };

  /** 表格列操作 */
  const listColumnsFormat = (columns: PageTableColumn[]) => {
    columns.forEach(column => {
      switch (column._column?.key) {
        case "product_type":
          // 产物类型：导出/导入任务与执行记录共用主键，此处一次性表达三类记录
          column.cellRenderer = ({ row }) => {
            const type = asRow(row).product_type || "task";
            return h(
              ElTag,
              { size: "small", type: PRODUCT_TAG_TYPE[type] ?? "primary" },
              () => t(`taskCenter.type_${type}`)
            );
          };
          break;
        case "name":
          // 产物任务优先展示业务名（如「用户导出-20260924」），其余展示任务路径
          column.cellRenderer = ({ row }) => {
            const data = asRow(row);
            const text = data.product_name || data.name || "";
            return h("span", { title: text }, text);
          };
          break;
        case "status":
          // 字典驱动（DictChoiceField）：颜色/文案管理员可在数据字典 task_status
          // 维护；字典未配置回退枚举时无 color，由 statusTagProps 走本地映射兜底
          column.cellRenderer = ({ row }) => {
            const status = asRow(row).status;
            const value = statusValue(asRow(row));
            return h(
              ElTag,
              statusTagProps(status),
              () =>
                (typeof status === "object" && status ? status.label : null) ??
                t(`systemTaskExecution.status${value}`)
            );
          };
          break;
        case "product_progress":
          // 进度与阶段仅产物任务有语义；执行类任务无进度（统一进度助手口径）
          column.cellRenderer = ({ row }) => {
            const data = asRow(row);
            if (!data.product_type) return h("span", "—");
            const value = statusValue(data);
            const nodes = [
              h(ElProgress, {
                percentage: Number(data.product_progress ?? 0),
                status:
                  value === "FAILURE" || value === "REVOKED"
                    ? "exception"
                    : value === "SUCCESS"
                      ? "success"
                      : undefined
              })
            ];
            if (data.product_stage) {
              nodes.push(
                h(
                  "div",
                  { class: "text-xs text-(--el-text-color-secondary)" },
                  data.product_stage
                )
              );
            }
            return h("div", nodes);
          };
          break;
        case "time_cost":
          column.cellRenderer = ({ row }) => {
            const cost = asRow(row).time_cost;
            return h(
              "span",
              cost === null || cost === undefined ? "—" : `${cost}s`
            );
          };
          break;
      }
    });
    return columns;
  };

  return {
    api,
    auth,
    listColumnsFormat,
    searchColumnsFormat,
    operationButtonsProps
  };
}
