import { shallowRef } from "vue";
import type { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import { type periodicTaskApi, taskExecutionApi } from "@/api/system/task";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { handleOperation, type OperationProps } from "@/components/RePlusPage";
import { openTaskLogDialog } from "@/views/system/components/taskLogDialog";
import VideoPlay from "~icons/ep/video-play";
import FileList from "~icons/ri/file-list-3-line";
import FileCopy from "~icons/ri/file-copy-line";
import type { Ref } from "vue";

type TFunction = ReturnType<typeof useI18n>["t"];
type TaskApiLike = Pick<typeof periodicTaskApi, "run" | "clone">;
type TaskAuth = {
  [key: string]: boolean | undefined;
  run?: boolean;
  log?: boolean;
  clone?: boolean;
};

/** 定时任务行（run/log 按钮行内使用的字段） */
type TaskRow = {
  pk?: string | number;
  id?: string | number;
  name?: string;
};

/**
 * 定时任务行内动作：立即执行 / 实时日志 / 克隆（含执行记录日志弹窗编排）。
 * 自 useTask 拆出（行为不变）：run 派发成功后自动打开实时日志弹窗。
 */
export function useTaskRowActions({
  t,
  api,
  auth,
  tableRef
}: {
  t: TFunction;
  api: TaskApiLike;
  auth: TaskAuth;
  tableRef: Ref;
}) {
  /** 打开某条执行记录的实时日志弹窗（WebSocket 增量推送） */
  const openLog = (pk: string | number, name: string) => {
    openTaskLogDialog(pk, `${name} ${t("systemTask.logTitle")}`);
  };

  /** 打开该定时任务最近一次执行的日志 */
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

  /** 新增一个"立即执行"和"实时日志"的行内操作按钮 */
  const operationButtonsProps = shallowRef<OperationProps>({
    // 6 个按钮全部内联（编辑/删除/详情/立即执行/最新日志/克隆）：任意折叠
    // 都会让既有操作路径多点一次；列宽收敛到刚好容纳单行按钮，表头不再被
    // 固定列裁切由 RePlusPage 的覆盖区边界对齐机制保证（见其组件注释）
    width: 440,
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
              const taskId = res?.data?.task_id;
              if (taskId) {
                openLog(taskId, row.name);
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

  return {
    operationButtonsProps
  };
}
