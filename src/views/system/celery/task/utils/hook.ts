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
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import {
  handleOperation,
  type OperationProps,
  type PageColumn
} from "@/components/RePlusPage";
import { openTaskLogDialog } from "@/views/system/components/taskLogDialog";
import VideoPlay from "~icons/ep/video-play";
import FileList from "~icons/ri/file-list-3-line";
import PlayList from "~icons/ri/play-list-2-line";
import FileCopy from "~icons/ri/file-copy-line";
import VideoPause from "~icons/ep/video-pause";
import CircleCheck from "~icons/ep/circle-check";

/** 定时任务行（run/log 按钮行内使用的字段） */
type TaskRow = {
  pk?: string | number;
  id?: string | number;
  name?: string;
};

export function useTask(tableRef: Ref) {
  // 权限判断，用于判断是否有该权限
  const api = reactive(periodicTaskApi);
  const auth = reactive({
    ...getDefaultAuths(getCurrentInstance(), [
      "run",
      "log",
      "batchRun",
      "batchEnable",
      "batchDisable",
      "clone"
    ])
  });
  const { t } = useI18n();

  /**
   * 打开某条执行记录的实时日志弹窗（WebSocket 增量推送）
   */
  const openLog = (pk: string | number, name: string) => {
    openTaskLogDialog(pk, `${name} ${t("systemTask.logTitle")}`);
  };

  /**
   * 打开该定时任务最近一次执行的日志
   */
  const openLatestLog = async (row: TaskRow) => {
    const res = await taskExecutionApi.list({
      periodic_task: row?.pk ?? row?.id,
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

  /**
   * 新增一个"立即执行"和"实时日志"的行内操作按钮
   */
  const operationButtonsProps = shallowRef<OperationProps>({
    width: 340,
    showNumber: 6,
    buttons: [
      {
        text: t("systemTask.runNow"),
        code: "run",
        confirm: {
          title: row => t("systemTask.runConfirm", { name: row.name })
        },
        props: {
          type: "success",
          icon: useRenderIcon(VideoPlay),
          link: true
        },
        onClick: ({ row, loading }) => {
          loading.value = true;
          // apiReq 是已发起的 Promise；派发成功后自动打开实时日志弹窗
          handleOperation({
            t,
            apiReq: api.run(row?.pk ?? row?.id),
            success(res) {
              tableRef.value.handleGetData();
              if (res.data?.task_id) {
                openLog(res.data.task_id, row.name);
              }
            },
            requestEnd() {
              loading.value = false;
            }
          });
        },
        show: auth.run && 4
      },
      {
        text: t("systemTask.latestLog"),
        code: "log",
        props: {
          type: "primary",
          icon: useRenderIcon(FileList),
          link: true
        },
        onClick: ({ row }) => {
          void openLatestLog(row);
        },
        show: auth.log && 5
      },
      {
        text: t("systemTask.clone"),
        code: "clone",
        confirm: {
          title: row => t("systemTask.cloneConfirm", { name: row.name })
        },
        props: {
          type: "warning",
          icon: useRenderIcon(FileCopy),
          link: true
        },
        onClick: ({ row, loading }) => {
          loading.value = true;
          handleOperation({
            t,
            apiReq: api.clone(row?.pk ?? row?.id),
            success() {
              tableRef.value.handleGetData();
            },
            requestEnd() {
              loading.value = false;
            }
          });
        },
        show: auth.clone && 6
      }
    ]
  });

  /**
   * 新增表格标题栏"批量执行"按钮，作用于勾选行
   */
  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [
      {
        text: t("systemTask.batchRun"),
        code: "batchRun",
        confirm: {
          title: t("systemTask.batchRunConfirm")
        },
        props: {
          type: "success",
          icon: useRenderIcon(PlayList),
          plain: true
        },
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
      },
      {
        text: t("systemTask.batchEnable"),
        code: "batchEnable",
        confirm: {
          title: t("systemTask.batchEnableConfirm")
        },
        props: {
          type: "primary",
          icon: useRenderIcon(CircleCheck),
          plain: true
        },
        onClick: ({ loading }) => {
          const pks = tableRef.value?.getSelectPks("pk") ?? [];
          if (!pks.length) {
            message(t("results.noSelectedData"), { type: "error" });
            return;
          }
          loading.value = true;
          handleOperation({
            t,
            apiReq: api.batchEnable(pks, true),
            success() {
              tableRef.value?.handleGetData();
            },
            requestEnd() {
              loading.value = false;
            }
          });
        },
        show: auth.batchEnable
      },
      {
        text: t("systemTask.batchDisable"),
        code: "batchDisable",
        confirm: {
          title: t("systemTask.batchDisableConfirm")
        },
        props: {
          type: "warning",
          icon: useRenderIcon(VideoPause),
          plain: true
        },
        onClick: ({ loading }) => {
          const pks = tableRef.value?.getSelectPks("pk") ?? [];
          if (!pks.length) {
            message(t("results.noSelectedData"), { type: "error" });
            return;
          }
          loading.value = true;
          handleOperation({
            t,
            apiReq: api.batchEnable(pks, false),
            success() {
              tableRef.value?.handleGetData();
            },
            requestEnd() {
              loading.value = false;
            }
          });
        },
        show: auth.batchEnable
      }
    ]
  });

  /** 已注册任务下拉选项 */
  const registeredOptions = ref<{ name: string; verbose_name: string }[]>([]);
  const loadRegistered = async () => {
    const res = await api.registered();
    registeredOptions.value = res.data ?? [];
  };

  /**
   * 新增/编辑表单：任务路径改为"已注册任务下拉 + 可手输兜底"
   */
  const baseColumnsFormat = ({ addOrEditColumns }) => {
    const taskCol = addOrEditColumns.value.find(
      (column: PageColumn) => column._column.key === "task"
    );
    if (taskCol) {
      taskCol.valueType = "select";
      // label 展示“verbose_name (路径)”，value 为任务路径
      taskCol.options = computed(() =>
        registeredOptions.value.map(option => ({
          label: option.verbose_name
            ? `${option.verbose_name} (${option.name})`
            : option.name,
          value: option.name
        }))
      );
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
    baseColumnsFormat,
    tableBarButtonsProps,
    operationButtonsProps
  };
}
