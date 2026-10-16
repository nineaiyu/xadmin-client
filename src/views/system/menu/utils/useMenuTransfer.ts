/**
 * 菜单导入导出：走 RePlusPage 通用导入导出通道。
 *
 * 导出支持「勾选行 / 全部」两档（由 el-tree 勾选态决定），导入成功后整体
 * 刷新菜单树（共享 meta 缓存强制拉取在 useMenuData.getMenuData 内统一处理）。
 */

import type { useI18n } from "vue-i18n";
import type { UnwrapNestedRefs } from "vue";
import type { menuApi } from "@/api/system/menu";
import { handleExportData, handleImportData } from "@/components/RePlusPage";

type TFunction = ReturnType<typeof useI18n>["t"];
type MenuApi = UnwrapNestedRefs<typeof menuApi>;

export function useMenuTransfer({
  t,
  api,
  reload
}: {
  t: TFunction;
  api: MenuApi;
  /** 导入成功后的整体刷新（useMenuData.getMenuData） */
  reload: () => void;
}) {
  const exportData = (treeRef: {
    getCheckedKeys?: (leafOnly?: boolean) => unknown[];
  }) => {
    const pks = (treeRef?.getCheckedKeys?.(false) ?? []) as Array<
      string | number
    >;
    handleExportData({ t, pks, api, allowTypes: ["selected", "all"] });
  };

  const importData = () => {
    handleImportData({ t, api, success: () => reload() });
  };

  return { exportData, importData };
}
