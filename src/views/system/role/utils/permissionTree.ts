/**
 * 角色授权树（菜单权限 + 注入的字段权限合成节点）纯逻辑。
 *
 * 职责：树索引构建、父子联动、全选/反选/清空、状态标识（已选/部分选中/未选）、
 * 搜索匹配与关键词高亮切分、提交载荷拆分。全部为无副作用函数，不引用组件状态，
 * 便于单测覆盖联动与统计口径。
 *
 * 合成键约定（字段分组 `+{fieldPk}`、字段叶子 `{menuPk}+{fieldPk}`）见 ./treeKeys.ts：
 * 合成节点不参与菜单父子联动，也不计入菜单状态统计；联动只在真实菜单节点
 * （目录/菜单/权限点）之间传播。
 */

import { isSyntheticKey, parseMenuFieldKey } from "./treeKeys";

/** 菜单类型（与后端 Menu.MenuChoices 对齐） */
export const MenuTypeValue = {
  DIRECTORY: 0,
  MENU: 1,
  PERMISSION: 2
} as const;

/** 授权树节点：真实菜单节点 + 注入的模型字段合成节点 */
export interface PermissionTreeNode {
  pk?: string | number;
  name?: string;
  path?: string;
  method?: string | null;
  menu_type?: { value?: number } | number | null;
  label?: string;
  model?: unknown[];
  children?: PermissionTreeNode[];
  meta?: { title?: string; icon?: string } | null;
  /** 后端字段按原样保留 */
  [key: string]: unknown;
}

export type PermissionNodeKind =
  "directory" | "menu" | "permission" | "fieldGroup" | "field";

export type PermissionNodeStatus = "checked" | "partial" | "unchecked";

export interface PermissionTreeIndex {
  /** 真实菜单节点键（深度优先先序：任一节点都排在其后代之前） */
  menuKeys: string[];
  /** 字段分组节点键（`+{fieldPk}`） */
  fieldGroupKeys: string[];
  /** 字段叶子节点键（`{menuPk}+{fieldPk}`） */
  fieldKeys: string[];
  /** 全部节点（含合成节点） */
  nodeMap: Map<string, PermissionTreeNode>;
  /** 真实菜单子节点（不含合成节点） */
  childrenMap: Map<string, string[]>;
  /** 真实菜单父节点 */
  parentMap: Map<string, string>;
  /** 分类总数：目录/菜单/权限点/字段 */
  counts: {
    directory: number;
    menu: number;
    permission: number;
    field: number;
  };
}

export interface PermissionSelectionStats {
  /** 已选真实菜单节点总数 */
  checked: number;
  /** 真实菜单节点总数 */
  total: number;
  directory: { checked: number; total: number };
  menu: { checked: number; total: number };
  permission: { checked: number; total: number };
  field: { checked: number; total: number };
  /** 部分选中的节点数（存在未选子级） */
  partial: number;
}

export interface PermissionSubmitPayload {
  /** 真实菜单父键（目录/菜单/权限点 pk） */
  menu: string[];
  /** 字段权限：`{菜单pk: [字段pk]}` */
  fields: Record<string, string[]>;
}

/** 节点稳定键（el-tree 的 node-key） */
export function nodeKey(node: PermissionTreeNode): string {
  return node?.pk === undefined || node?.pk === null ? "" : String(node.pk);
}

/** 菜单类型值（兼容 `{value,label}` 字典形态与裸数字） */
export function menuTypeValue(node: PermissionTreeNode): number | null {
  const raw = node?.menu_type;
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return raw;
  if (typeof raw === "object") {
    const value = (raw as { value?: unknown }).value;
    return typeof value === "number" ? value : null;
  }
  return null;
}

/** 节点类型：合成键优先判定，其余按 menu_type 归类 */
export function nodeKind(node: PermissionTreeNode): PermissionNodeKind {
  const key = nodeKey(node);
  if (parseMenuFieldKey(key)) return "field";
  if (isSyntheticKey(key)) return "fieldGroup";
  const type = menuTypeValue(node);
  if (type === MenuTypeValue.DIRECTORY) return "directory";
  if (type === MenuTypeValue.MENU) return "menu";
  return "permission";
}

/** 是否为真实菜单节点（目录/菜单/权限点） */
export function isMenuNode(node: PermissionTreeNode): boolean {
  return !isSyntheticKey(nodeKey(node));
}

/** 构建树索引（含父链、子集与分类总数） */
export function buildPermissionTreeIndex(
  treeData: PermissionTreeNode[]
): PermissionTreeIndex {
  const index: PermissionTreeIndex = {
    menuKeys: [],
    fieldGroupKeys: [],
    fieldKeys: [],
    nodeMap: new Map(),
    childrenMap: new Map(),
    parentMap: new Map(),
    counts: { directory: 0, menu: 0, permission: 0, field: 0 }
  };

  const walk = (nodes: PermissionTreeNode[], parentKey: string | null) => {
    nodes.forEach(node => {
      const key = nodeKey(node);
      if (!key) return;
      index.nodeMap.set(key, node);
      const kind = nodeKind(node);
      let childParent = parentKey;
      if (kind === "field") {
        index.fieldKeys.push(key);
        childParent = null;
      } else if (kind === "fieldGroup") {
        index.fieldGroupKeys.push(key);
        childParent = null;
      } else {
        index.menuKeys.push(key);
        index.counts[kind] += 1;
        childParent = key;
        if (parentKey) {
          index.parentMap.set(key, parentKey);
          const siblings = index.childrenMap.get(parentKey);
          if (siblings) siblings.push(key);
          else index.childrenMap.set(parentKey, [key]);
        }
      }
      if (node.children?.length) walk(node.children, childParent);
    });
  };

  walk(treeData ?? [], null);
  index.counts.field = index.fieldKeys.length;
  return index;
}

/** 节点的真实菜单后代（含自身） */
export function menuDescendants(
  index: PermissionTreeIndex,
  key: string
): string[] {
  const result: string[] = [];
  const stack = [key];
  while (stack.length) {
    const current = stack.pop() as string;
    result.push(current);
    (index.childrenMap.get(current) ?? []).forEach(child => stack.push(child));
  }
  return result;
}

/** 节点的真实菜单祖先（由近及远） */
export function menuAncestors(
  index: PermissionTreeIndex,
  key: string
): string[] {
  const result: string[] = [];
  let parent = index.parentMap.get(key);
  while (parent) {
    result.push(parent);
    parent = index.parentMap.get(parent);
  }
  return result;
}

/** 只保留索引内的菜单键与既有字段键（丢弃未知键） */
function sanitizeSelection(
  index: PermissionTreeIndex,
  selection: Iterable<string>
): Set<string> {
  const menuKeySet = new Set(index.menuKeys);
  const next = new Set<string>();
  for (const key of selection) {
    if (menuKeySet.has(key) || isSyntheticKey(key)) next.add(key);
  }
  return next;
}

/**
 * 规范化勾选集合：保证「父节点选中 ⟺ 自身被选中或存在选中子节点」。
 * 自底向上重算（menuKeys 为深度优先先序，倒序即为子先父后），
 * 用于反选/全选后修复父链一致性。
 */
export function normalizeSelection(
  index: PermissionTreeIndex,
  selection: Iterable<string>
): Set<string> {
  const next = sanitizeSelection(index, selection);
  for (let i = index.menuKeys.length - 1; i >= 0; i--) {
    const key = index.menuKeys[i];
    const children = index.childrenMap.get(key) ?? [];
    if (!children.length) continue;
    if (children.some(child => next.has(child))) next.add(key);
    else next.delete(key);
  }
  return next;
}

/**
 * 点击节点后的联动结果。
 *
 * 选中：自身与全部真实菜单后代置为选中，祖先目录一并选中（授权链完整，
 * 勾选子菜单时父目录必须可见）。取消：自身与后代取消，祖先按「是否仍有
 * 选中子节点」自底向上重算。字段合成节点不参与联动（由调用方拦截）。
 */
export function cascadeSelection(
  index: PermissionTreeIndex,
  key: string,
  checked: boolean,
  selection: Iterable<string>
): Set<string> {
  const next = sanitizeSelection(index, selection);
  if (checked) {
    menuDescendants(index, key).forEach(item => next.add(item));
    menuAncestors(index, key).forEach(item => next.add(item));
    return next;
  }
  menuDescendants(index, key).forEach(item => next.delete(item));
  let parent = index.parentMap.get(key);
  while (parent) {
    const children = index.childrenMap.get(parent) ?? [];
    if (children.some(child => next.has(child))) next.add(parent);
    else next.delete(parent);
    parent = index.parentMap.get(parent);
  }
  return next;
}

/** 全选（checked=true）或清空（checked=false）全部真实菜单节点，字段勾选保持不动 */
export function toggleMenuSelection(
  index: PermissionTreeIndex,
  checked: boolean,
  selection: Iterable<string>
): Set<string> {
  const next = sanitizeSelection(index, selection);
  index.menuKeys.forEach(key => {
    if (checked) next.add(key);
    else next.delete(key);
  });
  return next;
}

/**
 * 反选：对 scope（缺省为全部菜单节点）及其后代取反，随后按父链一致性规范化。
 * 搜索态下传入命中节点，实现「只反选当前搜索结果」。
 */
export function invertSelection(
  index: PermissionTreeIndex,
  selection: Iterable<string>,
  scope: Iterable<string> = index.menuKeys
): Set<string> {
  const next = sanitizeSelection(index, selection);
  const targets = new Set<string>();
  for (const key of scope) {
    if (!index.nodeMap.has(key) || isSyntheticKey(key)) continue;
    menuDescendants(index, key).forEach(item => targets.add(item));
  }
  targets.forEach(key => {
    if (next.has(key)) next.delete(key);
    else next.add(key);
  });
  return normalizeSelection(index, next);
}

/** 节点状态：已选（自身与子级均选中）/ 部分选中（自身选中但有未选子级）/ 未选 */
export function computeNodeStatusMap(
  index: PermissionTreeIndex,
  selection: Iterable<string>
): Map<string, PermissionNodeStatus> {
  const selected = sanitizeSelection(index, selection);
  const statuses = new Map<string, PermissionNodeStatus>();
  for (let i = index.menuKeys.length - 1; i >= 0; i--) {
    const key = index.menuKeys[i];
    const children = index.childrenMap.get(key) ?? [];
    if (!children.length) {
      statuses.set(key, selected.has(key) ? "checked" : "unchecked");
      continue;
    }
    if (!selected.has(key)) {
      statuses.set(key, "unchecked");
      continue;
    }
    const allChecked = children.every(
      child => statuses.get(child) === "checked"
    );
    statuses.set(key, allChecked ? "checked" : "partial");
  }
  return statuses;
}

/** 勾选统计（分类计数 + 部分选中节点数） */
export function computeSelectionStats(
  index: PermissionTreeIndex,
  selection: Iterable<string>
): PermissionSelectionStats {
  const selected = sanitizeSelection(index, selection);
  const stats: PermissionSelectionStats = {
    checked: 0,
    total: index.menuKeys.length,
    directory: { checked: 0, total: index.counts.directory },
    menu: { checked: 0, total: index.counts.menu },
    permission: { checked: 0, total: index.counts.permission },
    field: {
      checked: index.fieldKeys.filter(key => selected.has(key)).length,
      total: index.counts.field
    },
    partial: 0
  };
  const statuses = computeNodeStatusMap(index, selected);
  index.menuKeys.forEach(key => {
    const node = index.nodeMap.get(key);
    if (!node || !selected.has(key)) return;
    stats.checked += 1;
    const kind = nodeKind(node);
    if (kind === "directory") stats.directory.checked += 1;
    else if (kind === "menu") stats.menu.checked += 1;
    else if (kind === "permission") stats.permission.checked += 1;
    if (statuses.get(key) === "partial") stats.partial += 1;
  });
  return stats;
}

/** 字段分组节点下的字段勾选进度（`已选/总数`） */
export function countFieldSelection(
  node: PermissionTreeNode,
  selection: Iterable<string>
): { checked: number; total: number } {
  const selected = new Set(selection);
  const children = node?.children ?? [];
  return {
    checked: children.filter(child => selected.has(nodeKey(child))).length,
    total: children.length
  };
}

/** 勾选集合拆分为提交载荷（菜单 pk 数组 + 字段权限字典） */
export function collectSelectionPayload(
  selection: Iterable<string>
): PermissionSubmitPayload {
  const menu: string[] = [];
  const fields: Record<string, string[]> = {};
  for (const key of selection) {
    const parsed = parseMenuFieldKey(key);
    if (parsed) {
      const [menuPk, fieldPk] = parsed;
      if (fields[menuPk]) fields[menuPk].push(fieldPk);
      else fields[menuPk] = [fieldPk];
      continue;
    }
    if (!isSyntheticKey(key)) menu.push(key);
  }
  return { menu, fields };
}

/**
 * 搜索匹配：标题（调用方可传入 i18n 转换后的文本，缺省回落到 meta.title）/
 * 权限码（name）/ 路由或接口路径 / 字段标签。关键词两端空白忽略，大小写不敏感。
 */
export function matchPermissionNode(
  node: PermissionTreeNode,
  keyword: string,
  title?: string
): boolean {
  const needle = keyword.trim().toLowerCase();
  if (!needle) return true;
  const candidates: unknown[] = [
    title ?? node?.meta?.title,
    node?.name,
    node?.path,
    node?.label
  ];
  return candidates.some(
    candidate =>
      typeof candidate === "string" && candidate.toLowerCase().includes(needle)
  );
}

/** 关键词高亮切分：按命中片段切成 [{text, hit}]，供模板分段渲染 */
export function splitHighlight(
  text: string,
  keyword: string
): Array<{ text: string; hit: boolean }> {
  const needle = keyword.trim();
  if (!text || !needle) return [{ text: text ?? "", hit: false }];
  const haystack = text.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  const segments: Array<{ text: string; hit: boolean }> = [];
  let cursor = 0;
  let found = haystack.indexOf(lowerNeedle);
  while (found >= 0) {
    if (found > cursor) {
      segments.push({ text: text.slice(cursor, found), hit: false });
    }
    segments.push({
      text: text.slice(found, found + needle.length),
      hit: true
    });
    cursor = found + needle.length;
    found = haystack.indexOf(lowerNeedle, cursor);
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), hit: false });
  }
  return segments.length ? segments : [{ text, hit: false }];
}
