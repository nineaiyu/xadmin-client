import { MenuChoices } from "@/views/system/constants";

/**
 * 生效范围（菜单绑定）的树构建与展开（纯函数，配 vitest）。
 *
 * 运行时只把「请求命中的接口权限点菜单」与授权绑定菜单比对，
 * 因此页面/目录节点在提交时会被后端展开为其下全部接口权限点；
 * 这里提供同一口径的前端展开与统计，用于「将生效 N 个接口」的即时提示。
 */

export interface MenuScopeRow {
  pk: string;
  id?: string;
  parent: { pk: string } | string | null;
  menu_type: { value: number } | number;
  meta: { title?: string } | null;
  path?: string;
  method?: string;
  rank?: number;
}

export interface ScopeNode {
  pk: string;
  title: string;
  menuType: number;
  /** 后代接口权限点数量（页面/目录节点用于展示「整个页面 N 个接口」） */
  permissionCount: number;
  method?: string;
  path?: string;
  children?: ScopeNode[];
}

export function menuTypeOf(item: MenuScopeRow): number {
  return typeof item.menu_type === "number"
    ? item.menu_type
    : (item.menu_type?.value ?? -1);
}

export function parentIdOf(item: MenuScopeRow): string | null {
  return item.parent
    ? typeof item.parent === "string"
      ? item.parent
      : item.parent.pk
    : null;
}

/** 选中项展开为接口权限点 pk（页面/目录 → 全部后代权限点；去重、保持页面顺序） */
export function expandScopePks(rows: MenuScopeRow[], pks: string[]): string[] {
  const children = new Map<string, MenuScopeRow[]>();
  const byPk = new Map<string, MenuScopeRow>();
  rows.forEach(row => {
    byPk.set(String(row.pk), row);
    const parent = parentIdOf(row);
    if (!parent) return;
    const list = children.get(parent) ?? [];
    list.push(row);
    children.set(parent, list);
  });

  const result: string[] = [];
  const seen = new Set<string>();
  const push = (pk: string) => {
    if (seen.has(pk)) return;
    seen.add(pk);
    result.push(pk);
  };
  const walk = (row: MenuScopeRow) => {
    if (menuTypeOf(row) === MenuChoices.PERMISSION) {
      push(String(row.pk));
      return;
    }
    (children.get(String(row.pk)) ?? []).forEach(walk);
  };
  pks.forEach(pk => {
    const row = byPk.get(String(pk));
    if (row) walk(row);
  });
  return result;
}

/** 已选范围内实际生效的接口权限点数量 */
export function countScopePermissions(
  rows: MenuScopeRow[],
  pks: string[]
): number {
  return expandScopePks(rows, pks).length;
}

/**
 * 生效范围树：保留「权限点自身」与「含接口权限点后代的页面/目录」，
 * 节点按 rank 排序，权限点节点用方法（GET/POST）标注。
 */
export function buildScopeTree(rows: MenuScopeRow[]): ScopeNode[] {
  const children = new Map<string, MenuScopeRow[]>();
  const roots: MenuScopeRow[] = [];
  const ids = new Set(rows.map(row => String(row.pk)));
  rows.forEach(row => {
    const parent = parentIdOf(row);
    if (!parent || !ids.has(parent)) {
      roots.push(row);
      return;
    }
    const list = children.get(parent) ?? [];
    list.push(row);
    children.set(parent, list);
  });

  const sortRows = (items: MenuScopeRow[]) =>
    [...items].sort(
      (a, b) =>
        (a.rank ?? 99) - (b.rank ?? 99) ||
        String(a.pk).localeCompare(String(b.pk))
    );

  const build = (row: MenuScopeRow): ScopeNode | null => {
    const type = menuTypeOf(row);
    const childNodes = sortRows(children.get(String(row.pk)) ?? [])
      .map(build)
      .filter((node): node is ScopeNode => node !== null);
    const permissionCount =
      (type === MenuChoices.PERMISSION ? 1 : 0) +
      childNodes.reduce((sum, node) => sum + node.permissionCount, 0);
    if (permissionCount === 0) return null;
    return {
      pk: String(row.pk),
      title: row.meta?.title ?? String(row.pk),
      menuType: type,
      permissionCount,
      method: row.method,
      path: row.path,
      children: childNodes.length ? childNodes : undefined
    };
  };

  return sortRows(roots)
    .map(build)
    .filter((node): node is ScopeNode => node !== null);
}

/** 接口权限点叶子总数（用于空态与统计展示） */
export function countTreePermissions(nodes: ScopeNode[]): number {
  return nodes.reduce((sum, node) => {
    if (node.menuType === MenuChoices.PERMISSION) return sum + 1;
    return sum + countTreePermissions(node.children ?? []);
  }, 0);
}
