import type { Ref, VNode } from "vue";
import type { useI18n } from "vue-i18n";
import { handleOperation } from "@/components/RePlusPage";
import { message } from "@/utils/message";
import type { ApiResult } from "@/api/types";
import {
  openActionDialog,
  type ActionFormInstance
} from "./instanceFormDialog";
import { batchFailedDetail } from "../../utils/approvalTexts";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 服务端批量动作失败明细（统一 failures: [{pk, detail}]） */
export type BatchFailureItem = { pk: string; detail: string };

export const collectFailures = (res?: { data?: unknown }): BatchFailureItem[] =>
  (res?.data as { failures?: BatchFailureItem[] })?.failures ?? [];

/**
 * 批量动作成功回调：先关弹窗，再按失败明细提示（部分失败 → warning，文案
 * 「n + 明细」由 partialKey 给出），最后刷新列表。失败明细可为服务端逐单校验结果，
 * 部分成功不算整体失败。
 */
export function batchSuccessHandler(options: {
  t: TFunction;
  refresh: () => void;
  done: () => void;
  /** 部分失败文案 key（n 与 detail 两个插值） */
  partialKey: string;
  /** 明细展示条数上限（缺省全量；如批量转交取 3 条） */
  limit?: number;
}) {
  return (res: unknown) => {
    options.done();
    const failures = collectFailures(res as { data?: unknown });
    if (failures.length) {
      const detail = batchFailedDetail(
        options.limit ? failures.slice(0, options.limit) : failures
      );
      message(options.t(options.partialKey, { n: failures.length, detail }), {
        type: "warning"
      });
    }
    options.refresh();
  };
}

/** 批量动作全失败回调：服务端带首个失败原因（弹窗保持打开便于改人重试） */
export function batchFailedHandler() {
  return (res: unknown) => {
    const failures = collectFailures(res as { data?: unknown });
    if (failures.length) message(failures[0].detail, { type: "error" });
  };
}

/**
 * 批量动作弹窗通用链路（自 useInstanceBatchActions 抽出，行数门禁）：标题按勾选
 * 条数插值、提交走 handleOperation，结果收口复用 batchSuccessHandler
 * （handleFailed 为真时附全失败回调，弹窗保持打开）。
 */
export function openBatchAction<T>(options: {
  t: TFunction;
  pks: Array<string | number>;
  refresh: () => void;
  /** 弹窗标题词条（插值 n = 勾选条数） */
  titleKey: string;
  /** 部分失败文案 key */
  partialKey: string;
  formRef: Ref<ActionFormInstance<T> | undefined>;
  render: () => VNode;
  apiReq: (payload: T) => Promise<ApiResult>;
  limit?: number;
  handleFailed?: boolean;
}) {
  openActionDialog<T>({
    title: options.t(options.titleKey, { n: options.pks.length }),
    formRef: options.formRef,
    render: options.render,
    submit: (payload, done, closeLoading) => {
      handleOperation({
        t: options.t,
        apiReq: options.apiReq(payload),
        success: batchSuccessHandler({
          t: options.t,
          refresh: options.refresh,
          done,
          partialKey: options.partialKey,
          limit: options.limit
        }),
        ...(options.handleFailed ? { failed: batchFailedHandler() } : {}),
        requestEnd: closeLoading
      });
    }
  });
}
