import { shallowRef } from "vue";
import type { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import type { periodicTaskApi } from "@/api/system/task";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { handleOperation, type OperationProps } from "@/components/RePlusPage";
import { useBatchUpdate } from "@/views/system/components/useBatchUpdate";
import PlayList from "~icons/ri/play-list-2-line";
import VideoPause from "~icons/ep/video-pause";
import CircleCheck from "~icons/ep/circle-check";
import type { ApiResult } from "@/api/types";
import type { Ref } from "vue";

type TFunction = ReturnType<typeof useI18n>["t"];
type TaskApiLike = Pick<
  typeof periodicTaskApi,
  "batchRun" | "batchEnable" | "batchUpdate"
>;
type TaskAuth = {
  [key: string]: boolean | undefined;
  batchRun?: boolean;
  batchEnable?: boolean;
  batchDisable?: boolean;
};

/**
 * 定时任务工具栏：批量执行 / 批量启用 / 批量停用 / 批量更新。
 * 自 useTask 拆出（行为不变）：三个批量按钮共用「空勾选提示 → loading → 刷新」流程。
 */
export function useTaskToolbar({
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

  // 批量更新：勾选行后统一写入同组字段（字段白名单：启用状态）
  const { batchUpdateButton } = useBatchUpdate({
    t,
    api,
    tableRef,
    fields: [
      { key: "enabled", label: t("systemTask.enabled"), input_type: "boolean" }
    ]
  });

  /** 新增表格标题栏"批量执行"按钮，作用于勾选行 */
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
          runBatch(pks, api.batchEnable(pks, true), loading);
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
          runBatch(pks, api.batchEnable(pks, false), loading);
        },
        show: auth.batchDisable && 3
      },
      batchUpdateButton
    ]
  });

  return {
    tableBarButtonsProps
  };
}
