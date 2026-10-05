/** 菜单树行：`pk` 唯一标识，`parent` 指向父级 pk，`children` 为子树 */
export type MenuTreeNode = {
  pk: number;
  parent?: number;
  children?: MenuTreeNode[];
} & Record<string, unknown>;

/** 前序遍历收集树中全部节点 pk（非数组入参原样返回累计数组） */
export const getMenuOrderPk = (
  data: unknown,
  x: Array<number | string> = []
): Array<number | string> => {
  if (data instanceof Array && data.length > 0) {
    data.forEach((res: MenuTreeNode) => {
      x.push(res.pk);
      const children = res.children;
      if (children instanceof Array && children.length > 0) {
        getMenuOrderPk(children, x);
      }
    });
  }
  return x;
};

//查找父节点（返回 [自身, 父, 祖父...]；沿 parent 上溯时做环检测，脏数据不会无限递归）
export const getMenuFromPk = (
  data: MenuTreeNode[],
  id: number
): MenuTreeNode[] => {
  const temp: MenuTreeNode[] = [];
  const visited = new Set<number>();
  const findNode = (arr: MenuTreeNode[], pk: number): MenuTreeNode | null => {
    for (const item of arr) {
      if (item.pk === pk) return item;
      if (item.children?.length) {
        const found = findNode(item.children, pk);
        if (found) return found;
      }
    }
    return null;
  };
  let current = findNode(data, id);
  // visited 兜底：parent 形成环（或指向自身）时及时终止，避免栈溢出
  while (current && !visited.has(current.pk)) {
    visited.add(current.pk);
    temp.push(current);
    if (current.parent === undefined || current.parent === null) break;
    current = findNode(data, current.parent) as MenuTreeNode;
  }
  return temp;
};
