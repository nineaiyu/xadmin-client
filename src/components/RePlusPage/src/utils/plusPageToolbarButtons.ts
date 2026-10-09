import { computed } from "vue";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { handleExportData, handleImportData } from "./handle";
import AddFill from "~icons/ri/add-circle-line";
import Upload from "~icons/ep/upload";
import Download from "~icons/ep/download";
import type { OperationButtonsRow } from "@/components/RePlusPage";
import type { ApiAuthProps } from "./types";
import type { BaseApi } from "@/api/base";
import type { Ref } from "vue";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

type TreeProps = Ref<{
  hasChildren: string;
  children: string;
  checkStrictly: boolean;
}>;

/**
 * 默认工具栏按钮（自 usePlusPageButtons.ts 抽出）：父子联动 / 新增 / 导出 / 导入。
 */
export function buildDefaultToolbarButtons({
  t,
  api,
  auth,
  isTree,
  treeProps,
  searchFields,
  allowAsyncExport,
  getSelectPks,
  handleGetData,
  handleAddOrEdit
}: {
  t: TFunction;
  api: Partial<BaseApi>;
  auth: Partial<ApiAuthProps>;
  isTree?: boolean;
  treeProps: TreeProps;
  searchFields: Ref<{ size?: number; page?: number }>;
  allowAsyncExport?: boolean;
  getSelectPks: (key?: string) => (string | number)[];
  handleGetData: (queryParams?: object) => void;
  handleAddOrEdit: (isAdd?: boolean, row?: Record<string, unknown>) => void;
}): OperationButtonsRow[] {
  return [
    {
      text: computed(() =>
        treeProps.value.checkStrictly
          ? t("buttons.checkUnStrictly")
          : t("buttons.checkStrictly")
      ),
      code: "checkStrictly",
      props: {
        type: "success",
        plain: true
      },
      onClick: () => {
        treeProps.value.checkStrictly = !treeProps.value.checkStrictly;
      },
      index: -30,
      show: isTree
    },
    {
      text: t("buttons.add"),
      code: "create",
      props: {
        type: "primary",
        icon: useRenderIcon(AddFill)
      },
      onClick: ({ row }) => {
        handleAddOrEdit(true, row);
      },
      index: -30,
      show: Boolean(auth.create)
    },
    {
      code: "export",
      props: {
        type: "primary",
        icon: useRenderIcon(Download),
        plain: true
      },
      onClick: () => {
        const pks = getSelectPks();
        handleExportData({
          t,
          pks,
          api,
          searchFields,
          // 未显式设置时按页面导出权限自动显示异步开关（与导出按钮同源判定），
          // 保证所有支持导出的页面都提供大数据量异步导出入口
          allowAsync: allowAsyncExport ?? Boolean(auth.exportData)
        });
      },
      tooltip: { content: t("exportImport.export") },
      index: -20,
      show: Boolean(auth.exportData)
    },
    {
      code: "import",
      props: {
        type: "primary",
        icon: useRenderIcon(Upload),
        plain: true
      },
      onClick: () => {
        handleImportData({
          t,
          api,
          success: () => {
            handleGetData();
          }
        });
      },
      tooltip: { content: t("exportImport.import") },
      index: -10,
      show: Boolean(auth.importData)
    }
  ];
}
