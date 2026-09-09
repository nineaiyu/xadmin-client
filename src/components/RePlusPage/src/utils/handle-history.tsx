import { h } from "vue";
import { addDialog } from "@/components/ReDialog";
import ChangeHistoryDialog from "../components/ChangeHistoryDialog.vue";
import type { BaseApi } from "@/api/base";

interface changeHistoryOptions {
  t: (arg0: string, arg1?: object) => string;
  /** 当前页面 API（取 baseApi 拼出 detail 路由） */
  api: Partial<BaseApi>;
  row: {
    pk?: string | number;
    id?: string | number;
  };
}

/** 行级「变更历史」：按 detail 路由 path 精确回溯该行的操作日志（含字段级 diff）。 */
const handleShowChangeHistory = (options: changeHistoryOptions) => {
  const { t, api, row } = options;
  addDialog({
    title: t("buttons.changeHistory"),
    width: "960px",
    draggable: true,
    hideFooter: true,
    destroyOnClose: true,
    closeOnClickModal: false,
    props: { baseApi: api.baseApi, pk: row?.pk ?? row?.id },
    contentRenderer: () => h(ChangeHistoryDialog)
  });
};

export { handleShowChangeHistory };
export type { changeHistoryOptions };
