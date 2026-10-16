import { match } from "pinyin-pro";
import { transformI18n } from "@/plugins/i18n";
import type { MenuFilterState, MenuRow } from "./types";

/**
 * 菜单树筛选纯函数（自 useMenuFilter 抽出，单测可直测）：
 * 关键字命中判定（标题/名称/路由/组件 + 中文拼音）、命中集合收集、
 * 可见树与展开集合推导。
 */

/** 词条化标题 → 展示文本（种子菜单标题存的是词条 key，如 menus.xxx） */
export const translateTitle = (title?: string): string =>
  transformI18n(title ?? "");

/** 行标题展示文本：标题为空时退回组件名 */
export const displayTitle = (row: MenuRow): string =>
  translateTitle(row.meta.title || row.name);

/** 关键字命中的字段：名称/权限码、路由、组件路径 */
export function hitKeyword(
  row: MenuRow,
  keyword: string,
  locale: string
): boolean {
  if (!keyword) return true;
  const title = displayTitle(row).toLocaleLowerCase();
  if (title.includes(keyword)) return true;
  if (row.name.toLocaleLowerCase().includes(keyword)) return true;
  if (row.path.toLocaleLowerCase().includes(keyword)) return true;
  if (row.component.toLocaleLowerCase().includes(keyword)) return true;
  // 中文标题支持拼音全拼/首字母命中（与旧实现口径一致）
  return locale === "zh" && !!(title && match(title, keyword));
}

/** 自身命中（祖先仅作上下文保留，不计入命中） */
export function matchRowSelf(
  row: MenuRow,
  filter: MenuFilterState,
  keyword: string,
  locale: string
): boolean {
  if (filter.menuType !== "all" && row.menuType !== filter.menuType) {
    return false;
  }
  if (
    filter.status !== "all" &&
    row.isActive !== (filter.status === "active")
  ) {
    return false;
  }
  return hitKeyword(row, keyword, locale);
}

/** 子树内是否有命中 */
export function matchSubtree(
  row: MenuRow,
  matchSelf: (row: MenuRow) => boolean
): boolean {
  if (matchSelf(row)) return true;
  return row.children.some(child => matchSubtree(child, matchSelf));
}

/** 全树收集命中 pk */
export function collectMatchPks(
  rows: MenuRow[],
  matchSelf: (row: MenuRow) => boolean
): Set<string> {
  const pks = new Set<string>();
  const walk = (list: MenuRow[]) => {
    list.forEach(row => {
      if (matchSelf(row)) pks.add(String(row.pk));
      if (row.children.length) walk(row.children);
    });
  };
  walk(rows);
  return pks;
}

/** 可见树：命中项 + 其祖先（祖先不因筛选而丢失层级上下文） */
export function buildVisibleTree(
  rows: MenuRow[],
  matchSubtreeRow: (row: MenuRow) => boolean
): MenuRow[] {
  const out: MenuRow[] = [];
  rows.forEach(row => {
    if (!matchSubtreeRow(row)) return;
    const children = row.children.length
      ? buildVisibleTree(row.children, matchSubtreeRow)
      : [];
    // 浅拷贝保持源行对象不被改写（el-tree 以 pk 为 node-key，副本可直接渲染）
    out.push({ ...row, children });
  });
  return out;
}

/** 需要展开的节点：筛选态下全展开命中路径，否则按展开层级 */
export function collectExpandPks(
  rows: MenuRow[],
  expandAll: boolean,
  expandLevel: number
): Set<string> {
  const pks = new Set<string>();
  const walk = (list: MenuRow[]) => {
    list.forEach(row => {
      if (!row.children.length) return;
      if (expandAll || row.depth < expandLevel) pks.add(String(row.pk));
      walk(row.children);
    });
  };
  walk(rows);
  return pks;
}

/** 首个命中节点 pk（用于筛选后滚动定位） */
export function findFirstMatchPk(
  rows: MenuRow[],
  matchPks: Set<string>
): string {
  let found = "";
  const walk = (list: MenuRow[]) => {
    for (const row of list) {
      if (found) return;
      if (matchPks.has(String(row.pk))) {
        found = String(row.pk);
        return;
      }
      walk(row.children);
    }
  };
  walk(rows);
  return found;
}
