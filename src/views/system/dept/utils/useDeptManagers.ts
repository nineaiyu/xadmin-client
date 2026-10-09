import { h, type Ref } from "vue";
import type { useI18n } from "vue-i18n";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { message } from "@/utils/message";
import { SUCCESS_CODE } from "@/api/types";
import DeptManagersDialog from "../components/DeptManagersDialog.vue";
import type { deptApi } from "@/api/identity/dept";
import type { DeptRow } from "./types";
import { normalizeError } from "@/utils/apiError";

type TFunction = ReturnType<typeof useI18n>["t"];
type DeptApiLike = Pick<typeof deptApi, "assignManagers">;

/**
 * 部门管理员任命（ReDialog + DeptManagersDialog）。
 * 自 useDept 拆出（行为不变）：弹窗载荷由内容组件就绪时经 onReady 显式注册
 * （不依赖模板 ref 语义），beforeSure 读取载荷增量提交。
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
      beforeSure: async (done, { closeLoading }) => {
        const payload = managerDialogApi?.getPayload();
        if (!payload) {
          closeLoading();
          return;
        }
        const res = await api
          .assignManagers(row.pk as number | string, payload)
          .catch(normalizeError);
        if (res.code === SUCCESS_CODE) {
          message(t("systemDept.managerSaveOk"), { type: "success" });
          done();
          tableRef.value.handleGetData();
          return;
        }
        if (res.detail) message(String(res.detail), { type: "warning" });
        closeLoading();
      }
    });
  };

  return {
    openManagers
  };
}
