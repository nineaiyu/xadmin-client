import { h, type Ref } from "vue";
import type { useI18n } from "vue-i18n";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { useDialogForm } from "@/hooks/useDialogForm";
import DeptManagersDialog from "../components/DeptManagersDialog.vue";
import type { deptApi } from "@/api/identity/dept";
import type { DeptRow } from "./types";

type TFunction = ReturnType<typeof useI18n>["t"];
type DeptApiLike = Pick<typeof deptApi, "assignManagers">;

/**
 * 部门管理员任命（ReDialog + DeptManagersDialog；提交底座见 useDialogForm）。
 * 弹窗载荷由内容组件就绪时经 onReady 显式注册（不依赖模板 ref 语义），
 * beforeSure 读取载荷增量提交。
 */
export function useDeptManagers({
  t,
  api,
  tableRef
}: {
  t: TFunction;
  api: DeptApiLike;
  tableRef: Ref;
}) {
  /** 弹窗载荷读取口：由内容组件就绪时经 onReady 显式注册 */
  let managerDialogApi:
    { getPayload: () => Record<string, unknown> | null } | undefined;

  const openManagers = (row: DeptRow) => {
    managerDialogApi = undefined;
    const { beforeSure } = useDialogForm({
      readPayload: () => managerDialogApi?.getPayload(),
      submit: payload => api.assignManagers(row.pk as number | string, payload),
      successText: t("systemDept.managerSaveOk"),
      onSuccess: () => tableRef.value.handleGetData()
    });
    addDialog({
      title: `${t("systemDept.managers")}：${row.name}`,
      width: dialogSize("sm"),
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      sureBtnLoading: true,
      // 行类型中 pk 为可选（框架 row 宽容形态），此处按弹窗契约收窄
      contentRenderer: () =>
        h(DeptManagersDialog, {
          row: { ...row, pk: row.pk as number | string },
          onReady: (api: NonNullable<typeof managerDialogApi>) => {
            managerDialogApi = api;
          }
        }),
      beforeSure
    });
  };

  return {
    openManagers
  };
}
