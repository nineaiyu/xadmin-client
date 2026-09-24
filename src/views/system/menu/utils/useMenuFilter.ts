/**
 * 菜单树筛选：关键字（名称/组件名/路由/权限码 + 中文拼音）、类型、状态、展开层级。
 *
 * 过滤在**数据层**完成（产出一棵只含命中项及其祖先的可见树），而不是依赖
 * el-tree 的 filter-node-method：后者只隐藏节点、不展开命中路径，深层命中
 * 永远藏在折叠里（旧实现的可发现性缺陷）。
 */

import { computed, reactive, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { match } from "pinyin-pro";
import { transformI18n } from "@/plugins/i18n";
import type { MenuFilterState, MenuRow } from "./types";

/** 词条化标题 → 展示文本（种子菜单标题存的是词条 key，如 menus.xxx） */
export const translateTitle = (title?: string): string =>
  transformI18n(title ?? "");

/** 行标题展示文本：标题为空时退回组件名 */
export const displayTitle = (row: MenuRow): string =>
  translateTitle(row.meta.title || row.name);

/** 关键字命中的字段：名称/权限码、路由、组件路径 */
function hitKeyword(row: MenuRow, keyword: string, locale: string): boolean {
  if (!keyword) return true;
  const title = displayTitle(row).toLocaleLowerCase();
  if (title.includes(keyword)) return true;
  if (row.name.toLocaleLowerCase().includes(keyword)) return true;
  if (row.path.toLocaleLowerCase().includes(keyword)) return true;
  if (row.component.toLocaleLowerCase().includes(keyword)) return true;
  // 中文标题支持拼音全拼/首字母命中（与旧实现口径一致）
  return locale === "zh" && !!(title && match(title, keyword));
}

export function useMenuFilter(treeData: Ref<MenuRow[]>) {
  const { locale } = useI18n();
  const filter = reactive<MenuFilterState>({
    keyword: "",
    menuType: "all",
    status: "all",
    expandLevel: 2
  });

  const keyword = computed(() => filter.keyword.trim().toLocaleLowerCase());

  /** 自身命中（祖先仅作上下文保留，不计入命中） */
  const matchSelf = (row: MenuRow): boolean => {
    if (filter.menuType !== "all" && row.menuType !== filter.menuType) {
      return false;
    }
    if (
      filter.status !== "all" &&
      row.isActive !== (filter.status === "active")
    ) {
      return false;
    }
    return hitKeyword(row, keyword.value, locale.value);
  };

  /** 子树内是否有命中 */
  const matchSubtree = (row: MenuRow): boolean => {
    if (matchSelf(row)) return true;
    return row.children.some(child => matchSubtree(child));
  };

  const matchPks = computed(() => {
    const pks = new Set<string>();
    const walk = (rows: MenuRow[]) => {
      rows.forEach(row => {
        if (matchSelf(row)) pks.add(String(row.pk));
        if (row.children.length) walk(row.children);
      });
    };
    walk(treeData.value);
    return pks;
  });

  const filterActive = computed(
    () =>
      !!keyword.value || filter.menuType !== "all" || filter.status !== "all"
  );

  /** 可见树：命中项 + 其祖先（祖先不因筛选而丢失层级上下文） */
  const visibleTree = computed<MenuRow[]>(() => {
    if (!filterActive.value) return treeData.value;
    const walk = (rows: MenuRow[]): MenuRow[] => {
      const out: MenuRow[] = [];
      rows.forEach(row => {
        if (!matchSubtree(row)) return;
        const children = row.children.length ? walk(row.children) : [];
        // 浅拷贝保持源行对象不被改写（el-tree 以 pk 为 node-key，副本可直接渲染）
        out.push({ ...row, children });
      });
      return out;
    };
    return walk(treeData.value);
  });

  /** 需要展开的节点：筛选态下全展开命中路径，否则按展开层级 */
  const expandPks = computed(() => {
    const pks = new Set<string>();
    const walk = (rows: MenuRow[], expandAll: boolean) => {
      rows.forEach(row => {
        if (!row.children.length) return;
        if (expandAll || row.depth < filter.expandLevel)
          pks.add(String(row.pk));
        walk(row.children, expandAll);
      });
    };
    walk(visibleTree.value, filterActive.value || filter.expandLevel >= 3);
    return pks;
  });

  /** 首个命中节点（用于筛选后滚动定位） */
  const firstMatchPk = computed(() => {
    if (!filterActive.value) return "";
    let found = "";
    const walk = (rows: MenuRow[]) => {
      for (const row of rows) {
        if (found) return;
        if (matchPks.value.has(String(row.pk))) {
          found = String(row.pk);
          return;
        }
        walk(row.children);
      }
    };
    walk(visibleTree.value);
    return found;
  });

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
