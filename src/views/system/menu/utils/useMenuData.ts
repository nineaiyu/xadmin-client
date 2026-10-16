/**
 * 菜单数据层装配：树派生（dataRows → 树 / 行索引 / 统计）与各职责模块接线。
 *
 * 口径：
 * - 数据源持有与局部更新原语见 useMenuRows.ts（rawRows 唯一数据源，treeData
 *   由它派生——保存/删除后只需替换或移除对应行，树结构自动重算）；
 * - 变更动作（保存/启停/删除/批量/排序）见 useMenuMutations.ts，
 *   导入导出见 useMenuTransfer.ts；
 * - 字典/接口清单/关联模型候选/组件路径清单等「下拉与候选」见 useMenuMeta.ts。
 */

import { computed, reactive } from "vue";
import { useI18n } from "vue-i18n";
import { menuApi } from "@/api/system/menu";
import { MenuChoices } from "@/views/system/constants";
import {
  buildMenuTree,
  buildRowIndex,
  flattenMenuTree,
  normalizeMenuRow
} from "./normalize";
import { useMenuRows } from "./useMenuRows";
import { useMenuMeta } from "./useMenuMeta";
import { useMenuMutations } from "./useMenuMutations";
import { useMenuTransfer } from "./useMenuTransfer";
import type { MenuRow } from "./types";

export function useMenuData() {
  const { t } = useI18n();
  const api = reactive(menuApi);

  const {
    rawRows,
    loading,
    busyPks,
    setBusy,
    getMenuData,
    upsertRow,
    dropRows,
    patchRows
  } = useMenuRows(api);

  const meta = useMenuMeta({ api });

  const treeData = computed<MenuRow[]>(() =>
    buildMenuTree(rawRows.value.map(normalizeMenuRow))
  );
  const flatRows = computed<MenuRow[]>(() => flattenMenuTree(treeData.value));
  const rowIndex = computed(() => buildRowIndex(treeData.value));
  const stats = computed(() => {
    const rows = flatRows.value;
    const count = (type: number) =>
      rows.filter(row => row.menuType === type).length;
    return {
      total: rows.length,
      directory: count(MenuChoices.DIRECTORY),
      menu: count(MenuChoices.MENU),
      permission: count(MenuChoices.PERMISSION),
      inactive: rows.filter(row => !row.isActive).length
    };
  });

  const mutations = useMenuMutations({
    api,
    t,
    setBusy,
    patchRows,
    upsertRow,
    dropRows
  });

  const transfer = useMenuTransfer({ t, api, reload: getMenuData });

  return {
    api,
    loading,
    treeData,
    flatRows,
    rowIndex,
    stats,
    busyPks,
    choicesDict: meta.choicesDict,
    menuUrlList: meta.menuUrlList,
    modelList: meta.modelList,
    viewList: meta.viewList,
    getMenuData,
    getMenuApiList: meta.getMenuApiList,
    loadModels: meta.loadModels,
    loadViews: meta.loadViews,
    upsertRow,
    dropRows,
    patchRows,
    ...mutations,
    exportData: transfer.exportData,
    importData: transfer.importData
  };
}
