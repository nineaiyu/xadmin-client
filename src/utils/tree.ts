/**
 * 树工具的最小节点约束。
 * 工具函数在原地补齐 id / parentId / pathList / uniqueId 等层级字段；
 * 调用方传入的节点 children 与节点本身同构（运行时保证），递归处统一收窄。
 */
export interface TreeHelperNode {
  path?: string;
  id?: number | string;
  parentId?: number | string | null;
  pathList?: Array<number | string>;
  uniqueId?: number | string;
  children?: TreeHelperNode[];
}

/**
 * @description 提取菜单树中的每一项uniqueId
 * @param tree 树
 * @returns 每一项uniqueId组成的数组
 */
export const extractPathList = <T extends TreeHelperNode>(
  tree: T[] | null | undefined
): Array<number | string> => {
  if (!Array.isArray(tree)) {
    console.warn("tree must be an array");
    return [];
  }
  if (!tree || tree.length === 0) return [];
  const expandedPaths: Array<number | string> = [];
  for (const node of tree) {
    const hasChildren = node.children && node.children.length > 0;
    if (hasChildren) {
      extractPathList(node.children);
    }
    expandedPaths.push(node.uniqueId);
  }
  return expandedPaths;
};

/**
 * @description 如果父级下children的length为1，删除children并自动组建唯一uniqueId
 * @param tree 树
 * @param pathList 每一项的id组成的数组
 * @returns 组件唯一uniqueId后的树
 */
export const deleteChildren = <T extends TreeHelperNode>(
  tree: T[] | null | undefined,
  pathList: Array<number | string> = []
): T[] => {
  if (!Array.isArray(tree)) {
    console.warn("menuTree must be an array");
    return [];
  }
  if (!tree || tree.length === 0) return [];
  for (const [key, node] of tree.entries()) {
    if (node.children && node.children.length === 1) delete node.children;
    node.id = key;
    node.parentId = pathList.length ? pathList[pathList.length - 1] : null;
    node.pathList = [...pathList, node.id];
    node.uniqueId =
      node.pathList.length > 1 ? node.pathList.join("-") : node.pathList[0];
    const hasChildren = node.children && node.children.length > 0;
    if (hasChildren) {
      deleteChildren(node.children as T[], node.pathList);
    }
  }
  return tree;
};

/**
 * @description 创建层级关系
 * @param tree 树
 * @param pathList 每一项的id组成的数组
 * @returns 创建层级关系后的树
 */
export const buildHierarchyTree = <T extends TreeHelperNode>(
  tree: T[] | null | undefined,
  pathList: Array<number | string> = []
): T[] => {
  if (!Array.isArray(tree)) {
    console.warn("tree must be an array");
    return [];
  }
  if (!tree || tree.length === 0) return [];
  for (const [key, node] of tree.entries()) {
    node.id = key;
    node.parentId = pathList.length ? pathList[pathList.length - 1] : null;
    node.pathList = [...pathList, node.id];
    const hasChildren = node.children && node.children.length > 0;
    if (hasChildren) {
      buildHierarchyTree(node.children as T[], node.pathList);
    }
  }
  return tree;
};

/**
 * @description 广度优先遍历，根据唯一uniqueId找当前节点信息
 * @param tree 树
 * @param uniqueId 唯一uniqueId
 * @returns 当前节点信息，未找到时返回 undefined
 */
export const getNodeByUniqueId = <T extends TreeHelperNode>(
  tree: T[] | null | undefined,
  uniqueId: number | string
): T | undefined => {
  if (!Array.isArray(tree)) {
    console.warn("menuTree must be an array");
    return undefined;
  }
  if (!tree || tree.length === 0) return undefined;
  const item = tree.find(node => node.uniqueId === uniqueId);
  if (item) return item as T;
  const childrenList = tree
    .filter(node => node.children)
    .map(i => i.children)
    .flat(1) as T[];
  return getNodeByUniqueId(childrenList, uniqueId);
};

/**
 * @description 向当前唯一uniqueId节点中追加字段
 * @param tree 树
 * @param uniqueId 唯一uniqueId
 * @param fields 需要追加的字段
 * @returns 追加字段后的树
 */
export const appendFieldByUniqueId = <T extends TreeHelperNode>(
  tree: T[] | null | undefined,
  uniqueId: number | string,
  fields: object
): T[] => {
  if (!Array.isArray(tree)) {
    console.warn("menuTree must be an array");
    return [];
  }
  if (!tree || tree.length === 0) return [];
  for (const node of tree) {
    const hasChildren = node.children && node.children.length > 0;
    if (
      node.uniqueId === uniqueId &&
      Object.prototype.toString.call(fields) === "[object Object]"
    )
      Object.assign(node, fields);
    if (hasChildren) {
      appendFieldByUniqueId(node.children as T[], uniqueId, fields);
    }
  }
  return tree;
};

/** handleTree 的返回节点：原行字段 + 运行时挂载的 children */
export type TreeResult<T> = T & { children?: TreeResult<T>[] };

/**
 * @description 构造树型结构数据
 * @param data 数据源
 * @param id id字段 默认id
 * @param parentId 父节点字段，默认parentId
 * @param children 子节点字段，默认children
 * @returns 追加字段后的树
 */
export const handleTree = <T extends object>(
  data: T[],
  id?: string,
  parentId?: string,
  children?: string
): Array<TreeResult<T>> => {
  if (!Array.isArray(data)) {
    console.warn("data must be an array");
    return [];
  }
  const config = {
    id: id || "pk",
    parentId: parentId || "parent",
    childrenList: children || "children"
  };

  const childrenListMap: Record<PropertyKey, T[]> = {};
  const nodeIds: Record<PropertyKey, T> = {};
  const tree: T[] = [];

  for (const d of data) {
    // 行字段动态，读取父级引用走 unknown 边界；JS 对象键会将 undefined/null 字符串化，与原实现一致
    const row = d as unknown as Record<string, unknown>;
    const parentId =
      (row[config.parentId] as { pk?: PropertyKey } | undefined)?.pk ??
      (row[config.parentId] as PropertyKey | undefined);
    if (childrenListMap[parentId as PropertyKey] == null) {
      childrenListMap[parentId as PropertyKey] = [];
    }
    nodeIds[row[config.id] as PropertyKey] = d;
    childrenListMap[parentId as PropertyKey].push(d);
  }

  for (const d of data) {
    const row = d as unknown as Record<string, unknown>;
    const parentId =
      (row[config.parentId] as { pk?: PropertyKey } | undefined)?.pk ??
      (row[config.parentId] as PropertyKey | undefined);
    if (nodeIds[parentId as PropertyKey] == null) {
      tree.push(d);
    }
  }

  for (const t of tree) {
    adaptToChildrenList(t);
  }

  function adaptToChildrenList(o: T) {
    const row = o as unknown as Record<string, unknown>;
    const key = row[config.id] as PropertyKey;
    if (childrenListMap[key] !== null) {
      row[config.childrenList] = childrenListMap[key];
    }
    const children = row[config.childrenList] as T[] | undefined;
    if (children) {
      for (const c of children) {
        adaptToChildrenList(c);
      }
    }
  }

  return tree;
};
