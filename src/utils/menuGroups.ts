import type { menuType } from "@/layout/types";

/**
 * 侧栏菜单分组的渲染层装配。
 *
 * 后端菜单 meta 的 groupName/groupRank 描述「同级聚合」关系：本模块把同级 children
 * 重新编排为「普通节点 + 分组虚拟节点」的混合序列，交由 SidebarItem 渲染
 * el-menu-item-group。分组虚拟节点只存在于渲染阶段（由 SidebarItem 在渲染 children
 * 时调用），不写回 permission store 的菜单树，因此不影响激活路径推导、面包屑、
 * 单子级折叠等既有逻辑。
 *
 * 规则：
 * - 无 groupName 的节点保持原相对顺序；
 * - 同组节点聚合到该组首次出现的位置（组内保持原顺序）；
 * - 组之间按 groupRank 升序（缺省取组内首成员的 groupRank，再缺省取首成员 rank，仍无按 0）。
 */

/** 分组虚拟节点 path 前缀（仅作 v-for key 与调试识别，不参与路由匹配） */
const GROUP_PATH_PREFIX = "__menu-group__:";

/** 分组虚拟节点判定：渲染层插入的容器节点 */
export function isMenuGroupNode(item: menuType | undefined | null): boolean {
  return item?.meta?.group === true;
}

/** 取节点的分组名（去空白；空串视为未分组） */
function groupNameOf(item: menuType): string {
  return String(item.meta?.groupName ?? "").trim();
}

/** 组的排序权重：组节点显式 groupRank 优先，其次组内首成员的 groupRank，再取首成员 rank，最后 0 */
function groupWeight(groupNode: menuType): number {
  const explicit = groupNode.meta?.groupRank;
  if (typeof explicit === "number" && Number.isFinite(explicit))
    return explicit;
  const first = groupNode.children?.[0];
  const memberRank = first?.meta?.groupRank;
  if (typeof memberRank === "number" && Number.isFinite(memberRank)) {
    return memberRank;
  }
  const fallback = first?.meta?.rank;
  return typeof fallback === "number" && Number.isFinite(fallback)
    ? fallback
    : 0;
}

/**
 * 同级 children → 渲染序列：分组节点聚合同组项，其余保持原顺序。
 * 入参为空或没有任何分组配置时原样返回（同一引用，零开销）。
 */
export function groupMenuChildren(children: menuType[]): menuType[] {
  if (!children?.length) return children ?? [];
  if (!children.some(child => groupNameOf(child))) return children;

  const slots: menuType[] = [];
  const groupSlots: menuType[] = [];
  const groupIndex = new Map<string, menuType>();

  children.forEach(child => {
    const name = groupNameOf(child);
    if (!name) {
      slots.push(child);
      return;
    }
    const existing = groupIndex.get(name);
    if (existing) {
      existing.children!.push(child);
      return;
    }
    const groupNode: menuType = {
      value: undefined,
      path: `${GROUP_PATH_PREFIX}${name}`,
      meta: { title: name, group: true },
      children: [child]
    };
    groupIndex.set(name, groupNode);
    groupSlots.push(groupNode);
    slots.push(groupNode);
  });

  // 组间排序：稳定升序，仅重排「组槽」之间的相对顺序，普通节点位置不动。
  // 先取全部组槽位置再整体回填：边算边替换会让后续 indexOf 命中已替换内容
  const ordered = [...groupSlots].sort(
    (a, b) => groupWeight(a) - groupWeight(b)
  );
  const groupPositions = groupSlots.map(slot => slots.indexOf(slot));
  groupPositions.forEach((position, index) => {
    slots[position] = ordered[index];
  });
  return slots;
}
