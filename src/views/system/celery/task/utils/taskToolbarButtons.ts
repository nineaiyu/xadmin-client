import { message } from "@/utils/message";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { handleOperation } from "@/components/RePlusPage";
import PlayList from "~icons/ri/play-list-2-line";
import VideoPause from "~icons/ep/video-pause";
import CircleCheck from "~icons/ep/circle-check";
import type { OperationButtonsRow } from "@/components/RePlusPage";
import type { ApiResult } from "@/api/types";
import type { periodicTaskApi } from "@/api/task/task";
import type { Ref } from "vue";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];
type TaskApiLike = Pick<
  typeof periodicTaskApi,
  "batchRun" | "batchEnable" | "batchDisable"
>;
type TaskAuth = {
  [key: string]: boolean | undefined;
  batchRun?: boolean;
  batchEnable?: boolean;
  batchDisable?: boolean;
};

/** 定时任务工具栏批量按钮（自 useTaskToolbar 抽出，控制单文件行数） */
export function buildTaskToolbarButtons({
  t,
  api,
  auth,
  tableRef
}: {
  t: TFunction;
  api: TaskApiLike;
  auth: TaskAuth;
  tableRef: Ref;
}): OperationButtonsRow[] {
  /** 空勾选时提示并返回，否则进入 loading 并发起标准请求（成功后刷新列表） */
  const runBatch = (
    pks: Array<string | number>,
    apiReq: Promise<ApiResult>,
    loading: { value: boolean }
  ) => {
    if (!pks.length) {
      message(t("results.noSelectedData"), { type: "error" });
      return;
    }
    loading.value = true;
    handleOperation({
      t,
      apiReq,
      success() {
        tableRef.value?.handleGetData();
      },
      requestEnd() {
        loading.value = false;
      }
    });
  };

  return [
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
        runBatch(pks, api.batchRun(pks), loading);
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
        runBatch(pks, api.batchEnable(pks), loading);
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
        runBatch(pks, api.batchDisable(pks), loading);
      },
      index: 3,
      show: auth.batchDisable
    }
  ];
}
