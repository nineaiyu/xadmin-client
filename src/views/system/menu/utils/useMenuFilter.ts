/**
 * 菜单树筛选：关键字（名称/组件名/路由/权限码 + 中文拼音）、类型、状态、展开层级。
 *
 * 过滤在**数据层**完成（产出一棵只含命中项及其祖先的可见树），而不是依赖
 * el-tree 的 filter-node-method：后者只隐藏节点、不展开命中路径，深层命中
 * 永远藏在折叠里（旧实现的可发现性缺陷）。匹配与树推导的纯函数见
 * menuFilterMatch.ts（可单测直测）。
 */

import { computed, reactive, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  buildVisibleTree,
  collectExpandPks,
  collectMatchPks,
  displayTitle,
  findFirstMatchPk,
  matchRowSelf,
  matchSubtree,
  translateTitle
} from "./menuFilterMatch";
import type { MenuFilterState, MenuRow } from "./types";

export { displayTitle, translateTitle };

export function useMenuFilter(treeData: Ref<MenuRow[]>) {
  const { locale } = useI18n();
  const filter = reactive<MenuFilterState>({
    keyword: "",
    menuType: "all",
    status: "all",
    expandLevel: 2
  });

  const keyword = computed(() => filter.keyword.trim().toLocaleLowerCase());

  const matchSelf = (row: MenuRow) =>
    matchRowSelf(row, filter, keyword.value, locale.value);
  const matchSubtreeRow = (row: MenuRow) => matchSubtree(row, matchSelf);

  const matchPks = computed(() => collectMatchPks(treeData.value, matchSelf));

  const filterActive = computed(
    () =>
      !!keyword.value || filter.menuType !== "all" || filter.status !== "all"
  );

  /** 可见树：命中项 + 其祖先；未筛选时原样返回数据树 */
  const visibleTree = computed<MenuRow[]>(() =>
    filterActive.value
      ? buildVisibleTree(treeData.value, matchSubtreeRow)
      : treeData.value
  );

  /** 需要展开的节点：筛选态下全展开命中路径，否则按展开层级 */
  const expandPks = computed(() =>
    collectExpandPks(
      visibleTree.value,
      filterActive.value || filter.expandLevel >= 3,
      filter.expandLevel
    )
  );

  /** 首个命中节点（用于筛选后滚动定位） */
  const firstMatchPk = computed(() =>
    filterActive.value
      ? findFirstMatchPk(visibleTree.value, matchPks.value)
      : ""
  );

  const reset = () => {
    filter.keyword = "";
    filter.menuType = "all";
    filter.status = "all";
  };

  return {
    filter,
    filterActive,
    keyword,
    visibleTree,
    matchPks,
    expandPks,
    firstMatchPk,
    reset
  };
}
