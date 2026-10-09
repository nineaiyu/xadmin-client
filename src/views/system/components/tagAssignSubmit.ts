import { SUCCESS_CODE } from "@/api/types";
import { message } from "@/utils/message";
import { tagApi } from "@/api/system/tag";
import { normalizeError } from "@/utils/apiError";
import type { Ref } from "vue";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 批量打标结果（后端逐对象权限校验后聚合） */
type BatchAssignResult = {
  success?: unknown[];
  failures?: unknown[];
  detail?: string;
  code?: number;
};

/** 打标提交公共依赖（弹窗由 useTagAssign 持有，提交后负责关闭与刷新） */
type TagAssignSubmitDeps = {
  t: TFunction;
  tableRef?: Ref;
  resource: string;
  /** 标签 pk 列表（面板已收敛为字符串主键） */
  tags: string[];
  done: () => void;
  closeLoading: () => void;
};

/**
 * 批量打标提交（自 useTagAssign 抽出）：逐对象结果聚合，失败点名提示；
 * 成功与失败都关闭弹窗并刷新列表。
 */
export async function submitTagBatchAssign({
  t,
  tableRef,
  resource,
  pks,
  tags,
  mode,
  done,
  closeLoading
}: TagAssignSubmitDeps & {
  pks: string[];
  mode: "add" | "remove" | "replace";
}) {
  const res = (await tagApi
    .batchAssign({ resource, pks, tags, mode })
    .catch(normalizeError)) as BatchAssignResult;
  if (res.code === SUCCESS_CODE) {
    const ok = res.success?.length ?? 0;
    const failed = res.failures?.length ?? 0;
    if (failed) {
      message(t("tag.batchDonePartial", { success: ok, failures: failed }), {
        type: "warning"
      });
    } else {
      message(t("tag.batchDone", { success: ok }), { type: "success" });
    }
    done();
    tableRef?.value?.handleGetData();
    return;
  }
  if (res.detail) message(String(res.detail), { type: "warning" });
  closeLoading();
}

/** 单对象打标提交：先关弹窗再刷新列表，避免刷新耗时导致弹窗滞留 */
export async function submitTagAssign({
  t,
  tableRef,
  resource,
  pk,
  tags,
  done,
  closeLoading
}: TagAssignSubmitDeps & { pk: string }) {
  const res = await tagApi.assign({ resource, pk, tags }).catch(normalizeError);
  if (res.code === SUCCESS_CODE) {
    message(t("tag.assignDone"), { type: "success" });
    done();
    tableRef?.value?.handleGetData();
    return;
  }
  if (res.detail) message(String(res.detail), { type: "warning" });
  closeLoading();
}
