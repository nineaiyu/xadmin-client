import {
  computed,
  getCurrentInstance,
  onMounted,
  reactive,
  ref,
  shallowRef,
  type Ref
} from "vue";
import { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import { periodicTaskApi, taskExecutionApi } from "@/api/system/task";
import { getDefaultAuths } from "@/router/utils";
import {
  handleOperation,
  type OperationProps,
  type PageColumn
} from "@/components/RePlusPage";
import type { TaskLogDialogInstance } from "../../task-execution/TaskLogDialog.vue";

/** 定时任务页：手动/批量执行 + 实时日志（run/log 权限经菜单按钮下发） */
export function useTask(tableRef: Ref) {
  const { t } = useI18n();
  const api = reactive(periodicTaskApi);
  const auth = reactive({
    ...getDefaultAuths(getCurrentInstance(), ["run", "log", "batchRun"])
  });
  const logDialogRef = ref<TaskLogDialogInstance | null>(null);

  /** 打开某条执行记录的实时日志弹窗（WebSocket 增量推送，执行中持续滚动） */
  const openLog = (pk: string | number, name: string) => {
    logDialogRef.value?.open({ pk, name });
  };

  /** 打开该定时任务最近一次执行的日志 */
  const openLatestLog = async (row: { pk: string | number; name: string }) => {
    const res = await taskExecutionApi.list({
      periodic_task: row.pk,
      page: 1,
      size: 1
    });
    const latest = res.data?.results?.[0] as
      { pk: string; name: string } | undefined;
    if (!latest) {
      message(t("systemTask.noExecution"), { type: "warning" });
      return;
    }
    openLog(latest.pk, latest.name);
  };

  const operationButtonsProps = shallowRef<OperationProps>({
    // 默认查看/编辑/删除占 3 席，run/log 第 4/5 个平铺显示，避免被折叠进"…"更多下拉
    showNumber: 5,
    buttons: [
      {
        text: t("systemTask.runNow"),
        code: "run",
        confirm: { title: t("systemTask.runConfirm") },
        props: { type: "success", link: true },
        onClick: ({ row, loading }) => {
          loading.value = true;
          // handleOperation 的 apiReq 是已发起的 Promise（内部 .then 分发消息）；
          // 派发成功后自动打开实时日志弹窗，执行期间日志增量滚动展示
          handleOperation({
            t,
            apiReq: api.run(row.pk),
            success(res) {
              tableRef.value?.handleGetData();
              if (res.data?.task_id) {
                openLog(res.data.task_id, row.name);
              }
            },
            requestEnd() {
              loading.value = false;
            }
          });
        },
        show: auth.run
      },
      {
        text: t("systemTask.latestLog"),
        code: "log",
        props: { type: "primary", link: true },
        onClick: ({ row }) => {
          void openLatestLog(row as { pk: string | number; name: string });
        },
        show: auth.log
      }
    ]
  });

  /** 工具栏批量执行按钮（作用于勾选行） */
  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [
      {
        text: t("systemTask.batchRun"),
        code: "batchRun",
        confirm: { title: t("systemTask.batchRunConfirm") },
        props: { type: "success", plain: true },
        onClick: ({ loading }) => {
          const pks = tableRef.value?.getSelectPks("pk") ?? [];
          if (!pks.length) {
            message(t("results.noSelectedData"), { type: "error" });
            return;
          }
          loading.value = true;
          handleOperation({
            t,
            apiReq: api.batchRun(pks),
            success() {
              tableRef.value?.handleGetData();
            },
            requestEnd() {
              loading.value = false;
            }
          });
        },
        show: auth.batchRun
      }
    ]
  });

  /** 已注册任务下拉选项：label 展示「verbose_name (路径)」，value 为任务路径 */
  const registeredOptions = ref<{ label: string; value: string }[]>([]);
  const loadRegistered = async () => {
    const res = await api.registered();
    registeredOptions.value = (res.data ?? []).map(
      (item: { name: string; verbose_name?: string }) => ({
        label: item.verbose_name
          ? `${item.verbose_name} (${item.name})`
          : item.name,
        value: item.name
      })
    );
  };

  /** 新增/编辑表单：任务路径改为「下拉选择已注册任务 + 可手输兜底」 */
  const baseColumnsFormat = ({ addOrEditColumns }) => {
    const taskCol = addOrEditColumns.value.find(
      (column: PageColumn) => column._column.key === "task"
    );
    if (taskCol) {
      taskCol.valueType = "select";
      taskCol.options = computed(() => registeredOptions.value);
      taskCol.fieldProps = {
        filterable: true,
        allowCreate: true,
        defaultFirstOption: true
      };
    }
  };

  onMounted(loadRegistered);

  return {
    api,
    auth,
    operationButtonsProps,
    tableBarButtonsProps,
    baseColumnsFormat,
    logDialogRef
  };
}
