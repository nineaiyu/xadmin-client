/**
 * 菜单管理页组装入口：数据 / 筛选 / 树交互 / 排序 / 多选 / 抽屉六块能力的接线。
 *
 * 页面（index.vue）只消费扁平引用，逻辑全部落在各职责模块：
 * - useMenuData          数据源与树派生（useMenuRows 持有 rawRows，变更动作见 useMenuMutations）；
 * - useMenuFilter        关键字/类型/状态/展开层级与可见树（纯匹配函数见 menuFilterMatch）；
 * - useMenuReveal        保存后的祖先展开与滚动定位（useRenderedTree 提供树本地副本）；
 * - useMenuInteractions  排序/多选/抽屉/行操作/树/右键菜单/工具栏接线；
 * - useMenuDrawer        新增/编辑/克隆/重命名/权限码抽屉（配置拆 menuDrawer* 系列）；
 * - menuViewModel        扁平视图模型装配。
 */

import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { usePageAuth } from "@/router/utils";
import { useMenuData } from "./useMenuData";
import { useMenuFilter } from "./useMenuFilter";
import { useRenderedTree } from "./useRenderedTree";
import { useMenuReveal } from "./useMenuReveal";
import { useMenuDrawer } from "./useMenuDrawer";
import { useMenuInteractions } from "./useMenuInteractions";
import { useMenuInit } from "./useMenuInit";
import { buildMenuViewModel } from "./menuViewModel";
import type { MenuAuths, MenuRow } from "./types";

export function useMenu() {
  const { t } = useI18n();
  const auth = usePageAuth([
    // 排序/权限码/接口清单/影响面/批量更新/权限检测为菜单页扩展动作
    "rank",
    "permissions",
    "apiUrl",
    "impact",
    "batchUpdate",
    "permissionAudit"
  ]) as MenuAuths;

  const treeRef = ref();
  const rootRef = ref<HTMLElement>();
  const currentRow = ref<MenuRow | null>(null);

  const data = useMenuData();
  const filter = useMenuFilter(data.treeData);
  const renderedTree = useRenderedTree(filter.visibleTree);
  // 定位目标由交互域提供（树引用晚于本模块创建，以回调延迟取用）
  const reveal = useMenuReveal({
    filterExpandPks: filter.expandPks,
    rowIndex: data.rowIndex,
    scrollToPk: pk => interactions.tree.scrollToPk(pk)
  });

  const drawer = useMenuDrawer({
    api: data.api,
    auth,
    t,
    treeData: data.treeData,
    rowIndex: data.rowIndex,
    choicesDict: data.choicesDict,
    modelList: data.modelList,
    viewList: data.viewList,
    menuUrlList: data.menuUrlList,
    saveNode: data.saveNode,
    renameNode: data.renameNode,
    setRowsActive: data.setRowsActive,
    reload: data.getMenuData,
    onSaved: pk => {
      if (pk === undefined) return;
      reveal.revealRow(pk);
      const row = data.rowIndex.value.byPk.get(String(pk));
      if (row) currentRow.value = row;
    }
  });

  const interactions = useMenuInteractions({
    t,
    auth,
    treeRef,
    currentRow,
    data,
    filter,
    renderedTree,
    reveal,
    drawer
  });

  useMenuInit({ data, auth });

  return buildMenuViewModel({
    auth,
    rootRef,
    treeRef,
    currentRow,
    data,
    filter,
    renderedTree,
    interactions
  });
}
