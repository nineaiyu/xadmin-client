import { shallowRef } from "vue";
import type { Ref } from "vue";
import type { useI18n } from "vue-i18n";
import { isSuccess } from "@/api/types";
import { normalizeError } from "@/utils/apiError";
import type { ScheduleReference } from "@/api/task/task";
import type { OperationProps } from "@/components/RePlusPage";
import { message } from "@/utils/message";
import { useConfirm } from "@/hooks/useConfirm";
import { createScheduleReferenceDialog } from "./scheduleReferences";

type TFunction = ReturnType<typeof useI18n>["t"];
type ScheduleApiLike = {
  destroy: (pk: number | string) => Promise<{ code: number; detail?: string }>;
  references: (pk: number | string) => Promise<{
    code: number;
    data?: ScheduleReference | null;
    detail?: string;
  }>;
};
type ScheduleRow = { pk?: string | number; id?: string | number };

/**
 * 调度删除入口（crontab / interval 共用）：
 * 删除前先取引用任务；有引用时弹窗列出任务并可跳转任务列表筛选，
 * 不再只有一条 toast。删除请求若仍被并发引用拒绝，也从错误响应里提取清单。
 */
export function useScheduleDelete({
  t,
  api,
  auth,
  tableRef,
  kind
}: {
  t: TFunction;
  api: ScheduleApiLike;
  auth: { destroy?: boolean; batchDestroy?: boolean };
  tableRef: Ref;
  kind: "crontab" | "interval";
}) {
  const canDelete = Boolean(auth.destroy);
  auth.destroy = false;
  // 批量删除一并关闭：框架批删不经过「先查引用再确认」，
  // 被引用调度被整批删掉会让任务静默失效
  auth.batchDestroy = false;
  const confirm = useConfirm();
  const { show } = createScheduleReferenceDialog(t, kind);

  const confirmDelete = () =>
    confirm(t("systemTask.scheduleDeleteConfirm"), {
      title: t("buttons.delete"),
      type: "warning",
      danger: true
    });

  const submitDelete = async (pk: string | number) => {
    const res = await api.destroy(pk).catch((error: unknown) => {
      // 并发引用拒绝：错误体携带引用任务清单，直接弹窗展示（后端 fail-closed）
      const data = (error as { data?: ScheduleReference } | undefined)?.data;
      if (data?.total) show(data, pk);
      return normalizeError(error);
    });
    if (isSuccess(res)) {
      message(t("results.success"), { type: "success" });
      tableRef.value?.handleGetData?.();
      return;
    }
    // 请求失败（normalizeError → code -1）已由 http 层提示、引用清单已单独弹窗；
    // 仅 HTTP 200 + 业务码失败需要页面补提示
    if (res.code !== -1 && res.detail) {
      message(String(res.detail), { type: "warning" });
    }
  };

  const remove = async (row: ScheduleRow) => {
    const pk = row?.pk ?? row?.id ?? "";
    let references: ScheduleReference | undefined;
    try {
      const res = await api.references(pk);
      if (isSuccess(res) && res.data) references = res.data;
    } catch {
      // 无引用查看权限/网络异常：继续按普通删除流程，后端仍会 fail-closed 拒绝
    }
    if (references?.total) {
      show(references, pk);
      return;
    }
    if (await confirmDelete()) await submitDelete(pk);
  };

  const operationButtonsProps = shallowRef<OperationProps>({
    width: 200,
    buttons: [
      {
        code: "delete",
        text: t("buttons.delete"),
        props: { type: "danger", link: true },
        show: canDelete,
        onClick: ({ row }) => remove(row as ScheduleRow)
      }
    ]
  });

  return { operationButtonsProps };
}
