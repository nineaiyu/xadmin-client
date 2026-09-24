/**
 * 菜单排序：同层上移/下移/置顶（键盘可达）与拖拽（含换父）。
 *
 * 排序统一落到后端 `rank` 接口（接收前序 pk 列表，单条 SQL 批量写 rank）。
 * 拖拽只写「换了父级」的节点（PATCH parent），顺序由 rank 提交承载——旧实现
 * 每次拖拽都无差别 PATCH 一次父级，制造无意义的审计记录。
 */

import { useI18n } from "vue-i18n";
import type { Reactive, Ref } from "vue";
import { SUCCESS_CODE } from "@/api/types";
import { message } from "@/utils/message";
import type { menuApi } from "@/api/system/menu";
import { flattenMenuTree } from "./normalize";
import type { MenuRow } from "./types";

export type MoveDirection = "up" | "down" | "top";

interface MenuOrderDeps {
  api: Reactive<typeof menuApi>;
  /** 源树（数据层派生） */
  treeData: Ref<MenuRow[]>;
  /** 渲染树（el-tree 直接绑定的本地副本，拖拽会就地改写） */
  renderedTree: Ref<MenuRow[]>;
  rowIndex: Ref<{ byParent: Map<string, MenuRow[]> }>;
  patchRows: (patch: Map<string, Record<string, unknown>>) => void;
  submitRank: (pks: Array<number | string>) => Promise<boolean>;
  reload: () => void;
}

export function useMenuOrder({
  api,
  treeData,
  renderedTree,
  rowIndex,
  patchRows,
  submitRank,
  reload
}: MenuOrderDeps) {
  const { t } = useI18n();

  /** 前序 pk 顺序 + rank 写回（rank 取前序序号，与后端 rank 接口口径一致） */
  const persistOrder = async (pks: Array<string | number>) => {
    const patch = new Map<string, Record<string, unknown>>();
    pks.forEach((pk, index) => patch.set(String(pk), { rank: index + 1 }));
    patchRows(patch);
    const ok = await submitRank(pks);
    if (!ok) reload();
    return ok;
  };

  /** 同层移动：把 pk 序列在所属兄弟区间内重排后提交 */
  const moveSibling = async (row: MenuRow, direction: MoveDirection) => {
    const parentKey = row.parent === null ? "" : String(row.parent);
    const siblings = rowIndex.value.byParent.get(parentKey) ?? [];
    const index = siblings.findIndex(
      item => String(item.pk) === String(row.pk)
    );
    if (index < 0) return false;
    const target =
      direction === "up" ? index - 1 : direction === "down" ? index + 1 : 0;
    if (target < 0 || target >= siblings.length || target === index) {
      // 边界（已在首/末位）不属于失败：静默返回，避免噪音提示
      return false;
    }

    const order = flattenMenuTree(treeData.value).map(item => String(item.pk));
    const siblingPks = siblings.map(item => String(item.pk));
    const positions = siblingPks
      .map(pk => order.indexOf(pk))
      .filter(pos => pos >= 0);
    const reordered = [...siblingPks];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(target, 0, moved);
    positions.forEach((position, i) => {
      order[position] = reordered[i];
    });

    const ok = await persistOrder(order);
    if (ok) message(t("systemMenu.result.sorted"), { type: "success" });
    return ok;
  };

  /**
   * 拖拽落点处理：
   * - `inner` = 成为目标子级；`before/after` = 与目标同层插入；
   * - 仅当父级真的变化时才 PATCH 父级（顺序交给 rank）。
   */
  const handleDrag = async (
    draggingNode: unknown,
    dropNode: unknown,
    dropType: string
  ) => {
    const node = (draggingNode as { data?: MenuRow } | null | undefined)?.data;
    const target = (dropNode as { data?: MenuRow } | null | undefined)?.data;
    if (!node || !target) return;
    const nextParent =
      dropType === "inner"
        ? target.pk
        : (target.parent as number | string | null);

    if (String(nextParent ?? "") !== String(node.parent ?? "")) {
      const res = await api.partialUpdate(node.pk as number, {
        parent: nextParent ?? null
      });
      if (res.code !== SUCCESS_CODE) {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
        reload();
        return;
      }
      patchRows(new Map([[String(node.pk), { parent: nextParent ?? null }]]));
    }

    // el-tree 已就地改写渲染树：按渲染树的前序顺序提交 rank
    const order = flattenMenuTree(renderedTree.value).map(item => item.pk);
    const ok = await persistOrder(order);
    if (ok) message(t("systemMenu.result.sorted"), { type: "success" });
  };

  return { moveSibling, handleDrag };
}
