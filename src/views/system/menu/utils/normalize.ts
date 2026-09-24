/**
 * 菜单行归一化与树装配。
 *
 * 接口行 → MenuRow 的唯一转换点：类型/父级/方法等「对象化字段」在此收敛，
 * 树装配同时补齐 depth 与后代计数（目录行展示「N 项」、删除前提示级联范围都依赖它）。
 */

import { MenuChoices } from "@/views/system/constants";
import type { MenuFormModel, MenuMeta, MenuRow } from "./types";

/** 空 meta（新建表单默认值，字段与后端 MenuMeta 对齐） */
export const EMPTY_META: MenuMeta = {
  title: "",
  icon: "",
  r_svg_name: "",
  is_show_menu: true,
  is_show_parent: false,
  is_keepalive: true,
  frame_url: "",
  frame_loading: false,
  transition_enter: "",
  transition_leave: "",
  is_hidden_tag: false,
  fixed_tag: false,
  dynamic_level: 0,
  watermark: false
};

/** 对象化字段取标量（`{value,label}` → value，兼容裸值） */
function scalar(value: unknown): unknown {
  if (value && typeof value === "object" && "value" in (value as object)) {
    return (value as { value?: unknown }).value;
  }
  return value;
}

/** 关联字段取 pk（`{pk,...}` → pk，兼容裸 pk） */
function pkOf(value: unknown): number | string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "object") {
    const pk = (value as { pk?: number | string }).pk;
    return pk === undefined || pk === null ? null : pk;
  }
  return value as number | string;
}

/** 接口行 → 归一化菜单行（不含树结构，children 由 buildMenuTree 填充） */
export function normalizeMenuRow(raw: Record<string, unknown>): MenuRow {
  const meta = (raw.meta ?? {}) as Partial<MenuMeta>;
  const modelPks = Array.isArray(raw.model)
    ? (raw.model as unknown[])
        .map(item => String(pkOf(item) ?? ""))
        .filter(Boolean)
    : [];
  return {
    pk: raw.pk as number | string,
    parent: pkOf(raw.parent),
    menuType: Number(scalar(raw.menu_type) ?? MenuChoices.DIRECTORY),
    name: String(raw.name ?? ""),
    path: String(raw.path ?? ""),
    component: String(raw.component ?? ""),
    method: String(scalar(raw.method) ?? ""),
    rank: Number(raw.rank ?? 0),
    isActive: raw.is_active !== false,
    modelPks,
    meta: {
      ...EMPTY_META,
      ...meta,
      title: String(meta.title ?? ""),
      icon: String(meta.icon ?? ""),
      watermark: Boolean(meta.watermark)
    },
    raw,
    children: [],
    depth: 1,
    directCount: 0,
    descendantCount: 0,
    inactiveDescendantCount: 0
  };
}

/** 归一化行 + 树装配：按 rank 排序、补 depth 与后代计数（含停用后代数） */
export function buildMenuTree(rows: MenuRow[]): MenuRow[] {
  // 幂等：同一批行对象可被重复装配（测试与派生数据源会多次调用同一数组）
  rows.forEach(row => {
    row.children = [];
    row.depth = 1;
    row.directCount = 0;
    row.descendantCount = 0;
    row.inactiveDescendantCount = 0;
  });
  const index = new Map<string, MenuRow>();
  rows.forEach(row => index.set(String(row.pk), row));

  const roots: MenuRow[] = [];
  rows.forEach(row => {
    const parent = row.parent === null ? null : index.get(String(row.parent));
    if (parent && parent !== row && !isDescendantOf(parent, row, index)) {
      parent.children.push(row);
    } else {
      // 父级不可见/成环（脏数据）时按根节点处理，避免整棵子树丢失
      roots.push(row);
    }
  });

  const visited = new Set<string>();
  const visit = (node: MenuRow, depth: number, path: Set<string>) => {
    const key = String(node.pk);
    if (path.has(key) || visited.has(key)) return;
    visited.add(key);
    path.add(key);
    node.depth = depth;
    node.children.sort(
      (a, b) => a.rank - b.rank || String(a.pk).localeCompare(String(b.pk))
    );
    node.directCount = node.children.length;
    let descendants = 0;
    let inactive = 0;
    node.children.forEach(child => {
      visit(child, depth + 1, path);
      descendants += 1 + child.descendantCount;
      inactive += (child.isActive ? 0 : 1) + child.inactiveDescendantCount;
    });
    node.descendantCount = descendants;
    node.inactiveDescendantCount = inactive;
    path.delete(key);
  };
  roots.forEach(root => visit(root, 1, new Set()));
  return roots.sort(
    (a, b) => a.rank - b.rank || String(a.pk).localeCompare(String(b.pk))
  );
}

/** parent 是否位于 node 的子树内（拖拽/表单上级节点校验用） */
function isDescendantOf(
  parent: MenuRow,
  node: MenuRow,
  index: Map<string, MenuRow>
): boolean {
  let cursor: MenuRow | undefined = parent;
  const visited = new Set<string>();
  while (cursor) {
    const key = String(cursor.pk);
    if (visited.has(key)) return true;
    visited.add(key);
    if (key === String(node.pk)) return true;
    cursor =
      cursor.parent === null ? undefined : index.get(String(cursor.parent));
  }
  return false;
}

/** 扁平化树（前序遍历），返回同一批行对象 */
export function flattenMenuTree(rows: MenuRow[]): MenuRow[] {
  const out: MenuRow[] = [];
  const walk = (list: MenuRow[]) => {
    list.forEach(row => {
      out.push(row);
      if (row.children.length) walk(row.children);
    });
  };
  walk(rows);
  return out;
}

/** pk → 行索引（包含 parent 引用，便于局部更新与祖先检索） */
export function buildRowIndex(rows: MenuRow[]): {
  byPk: Map<string, MenuRow>;
  byParent: Map<string, MenuRow[]>;
} {
  const byPk = new Map<string, MenuRow>();
  const byParent = new Map<string, MenuRow[]>();
  flattenMenuTree(rows).forEach(row => {
    byPk.set(String(row.pk), row);
    const key = row.parent === null ? "" : String(row.parent);
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(row);
  });
  return { byPk, byParent };
}

/** 祖先链（自身 → 父 → 根），用于面包屑与上级节点展示 */
export function ancestorChain(
  row: MenuRow,
  byPk: Map<string, MenuRow>
): MenuRow[] {
  const chain: MenuRow[] = [row];
  let cursor = row;
  const visited = new Set<string>([String(row.pk)]);
  while (cursor.parent !== null) {
    const parent = byPk.get(String(cursor.parent));
    if (!parent || visited.has(String(parent.pk))) break;
    visited.add(String(parent.pk));
    chain.push(parent);
    cursor = parent;
  }
  return chain;
}

/** 行 → 抽屉表单模型 */
export function toFormModel(row: MenuRow): MenuFormModel {
  return {
    pk: row.pk,
    menuType: row.menuType,
    parent: row.parent ?? "",
    title: row.meta.title,
    icon: row.meta.icon,
    name: row.name,
    path: row.path,
    component: row.component,
    method: row.method,
    model: [...row.modelPks],
    rank: row.rank,
    isActive: row.isActive,
    meta: { ...row.meta }
  };
}

/** 新建表单模型（默认值按「父级类型」推断：目录下加菜单、菜单下加权限点） */
export function emptyFormModel(
  parent: MenuRow | null,
  menuType: number
): MenuFormModel {
  return {
    pk: undefined,
    menuType,
    parent: parent?.pk ?? "",
    title: "",
    icon: "",
    name: "",
    path: "",
    component: "",
    method: "",
    model: [],
    rank: 0,
    isActive: true,
    meta: { ...EMPTY_META }
  };
}

/** 抽屉表单模型 → 接口载荷（meta 整体下发，类型无关字段清空） */
export function toPayload(model: MenuFormModel): Record<string, unknown> {
  const isPermission = model.menuType === MenuChoices.PERMISSION;
  const isMenu = model.menuType === MenuChoices.MENU;
  return {
    menu_type: model.menuType,
    parent: model.parent === "" ? null : model.parent,
    name: model.name,
    path: model.path,
    component: model.component || null,
    method: isPermission ? model.method || null : null,
    model: isPermission ? [...model.model] : [],
    rank: model.rank,
    is_active: model.isActive,
    meta: {
      ...model.meta,
      title: model.title,
      icon: model.icon,
      // 目录/权限点不承载标签页与外链语义，清空避免脏值
      transition_enter: isMenu ? model.meta.transition_enter : "",
      transition_leave: isMenu ? model.meta.transition_leave : "",
      frame_url: model.meta.frame_url,
      frame_loading: Boolean(model.meta.frame_loading),
      watermark: Boolean(model.meta.watermark)
    }
  };
}

/** 类型对应的 el-tag 语义色 */
export function menuTypeTagType(
  menuType: number
): "primary" | "success" | "info" {
  if (menuType === MenuChoices.DIRECTORY) return "info";
  if (menuType === MenuChoices.MENU) return "primary";
  return "success";
}

/** 行次要信息：权限点展示「方法 + 接口路径」，其余展示路由地址 */
export function rowPathText(row: MenuRow): string {
  if (row.menuType === MenuChoices.PERMISSION) {
    return row.method ? `${row.method} ${row.path}` : row.path;
  }
  return row.path;
}
