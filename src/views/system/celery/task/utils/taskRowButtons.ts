import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { handleOperation } from "@/components/RePlusPage";
import VideoPlay from "~icons/ep/video-play";
import FileList from "~icons/ri/file-list-3-line";
import FileCopy from "~icons/ri/file-copy-line";
import type { OperationButtonsRow } from "@/components/RePlusPage";
import type { periodicTaskApi } from "@/api/system/task";
import type { Ref } from "vue";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];
type TaskApiLike = Pick<typeof periodicTaskApi, "run" | "clone">;
type TaskAuth = {
  [key: string]: boolean | undefined;
  run?: boolean;
  log?: boolean;
  clone?: boolean;
};

/** 定时任务行内按钮（自 useTaskRowActions 抽出，控制单文件行数） */
export function buildTaskRowButtons({
  t,
  api,
  auth,
  tableRef,
  openLog,
  openLatestLog
}: {
  t: TFunction;
  api: TaskApiLike;
  auth: TaskAuth;
  tableRef: Ref;
  openLog: (pk: string | number, name: string) => void;
  openLatestLog: (row: { pk?: string | number; id?: string | number }) => void;
}): OperationButtonsRow[] {
  return [
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
      index: 4,
      show: auth.run
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
      index: 5,
      show: auth.log
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
      index: 6,
      show: auth.clone
    }
  ];
}
