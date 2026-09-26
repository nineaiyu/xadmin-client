/**
 * 菜单行操作域：动作清单 + 危险动作确认。
 *
 * 动作清单（行内「更多」下拉与右键菜单共用同一份声明）的单一来源价值：
 * 动作的可用条件（权限点 / 节点类型）只写一次，两个入口不会漂移；新增动作只需在此追加。
 * 确认对话框与动作同域收口：删除必须**始终**告知三件事——① 目录会级联带走全部后代
 * （后端软删级联，同时间戳成组恢复）；② 会被哪些角色引用（后端 impact 计算器的
 * samples）；③ 删错了能从哪里恢复（回收站）。因此不复用「无影响即直接放行」的通用实现。
 */

import { h } from "vue";
import type { useI18n } from "vue-i18n";
import { ElMessageBox } from "element-plus";
import { copyTextToClipboard } from "@pureadmin/utils";
import { message } from "@/utils/message";
import { transformI18n } from "@/plugins/i18n";
import type { BaseApi } from "@/api/base";
import { MenuChoices } from "@/views/system/constants";
import { rowPathText } from "./normalize";
import { displayTitle } from "./useMenuFilter";
import type {
  MenuAuths,
  MenuNodeAction,
  MenuRow,
  MoveDirection
} from "./types";

import EditPen from "~icons/ep/edit-pen";
import DocumentAdd from "~icons/ep/document-add";
import Key from "~icons/ep/key";
import CopyDocument from "~icons/ep/copy-document";
import Files from "~icons/ep/files";
import ArrowUp from "~icons/ep/arrow-up-bold";
import ArrowDown from "~icons/ep/arrow-down-bold";
import Top from "~icons/ep/top";
import SwitchButton from "~icons/ep/switch-button";
import Delete from "~icons/ep/delete";

type TFunction = ReturnType<typeof useI18n>["t"];

// ---------------------------------------------------------------- 动作清单

export interface MenuActionContext {
  t: TFunction;
  auth: MenuAuths;
  openEdit: (row: MenuRow) => void;
  openCreate: (parent: MenuRow) => void;
  openPermission: (row: MenuRow) => void;
  openRename: (row: MenuRow) => void;
  openClone: (row: MenuRow) => void;
  remove: (row: MenuRow) => void;
  move: (row: MenuRow, direction: MoveDirection) => void;
  /** 行内启停：值取反 */
  toggleActive: (row: MenuRow) => void;
}

/** 复制并提示（失败给出可读原因，不静默） */
function copy(value: string) {
  if (!value) return;
  const ok = copyTextToClipboard(value);
  message(transformI18n(ok ? "results.copySuccess" : "results.copyFailed"), {
    type: ok ? "success" : "error"
  });
}

/** 组装某个菜单节点的可用动作（无权限的动作不进入清单） */
export function buildNodeActions(
  row: MenuRow,
  ctx: MenuActionContext
): MenuNodeAction[] {
  const { t, auth } = ctx;
  const isPermission = row.menuType === MenuChoices.PERMISSION;
  const actions: MenuNodeAction[] = [];

  if (auth.partialUpdate) {
    actions.push({
      code: "edit",
      label: t("buttons.edit"),
      icon: EditPen,
      run: () => ctx.openEdit(row)
    });
  }
  if (auth.create && !isPermission) {
    actions.push({
      code: "addChild",
      label: t("systemMenu.action.addChild"),
      icon: DocumentAdd,
      run: () => ctx.openCreate(row)
    });
  }
  if (auth.permissions && row.menuType === MenuChoices.MENU) {
    actions.push({
      code: "permissions",
      label: t("systemMenu.addPermissions"),
      icon: Key,
      run: () => ctx.openPermission(row)
    });
  }
  if (auth.create) {
    actions.push({
      code: "clone",
      label: t("systemMenu.action.clone"),
      icon: Files,
      run: () => ctx.openClone(row)
    });
  }
  if (auth.partialUpdate) {
    actions.push({
      code: "rename",
      label: t("systemMenu.action.rename"),
      icon: EditPen,
      run: () => ctx.openRename(row)
    });
  }

  actions.push({
    code: "copyPath",
    label: isPermission
      ? t("systemMenu.action.copyPermissionPath")
      : t("systemMenu.action.copyPath"),
    icon: CopyDocument,
    run: () => copy(isPermission ? row.path : rowPathText(row))
  });
  if (isPermission) {
    actions.push({
      code: "copyCode",
      label: t("systemMenu.action.copyCode"),
      icon: CopyDocument,
      run: () => copy(row.name)
    });
  }

  if (auth.rank) {
    actions.push({
      code: "moveUp",
      label: t("systemMenu.action.moveUp"),
      icon: ArrowUp,
      run: () => ctx.move(row, "up")
    });
    actions.push({
      code: "moveDown",
      label: t("systemMenu.action.moveDown"),
      icon: ArrowDown,
      run: () => ctx.move(row, "down")
    });
    actions.push({
      code: "moveTop",
      label: t("systemMenu.action.moveTop"),
      icon: Top,
      run: () => ctx.move(row, "top")
    });
  }

  if (auth.partialUpdate) {
    actions.push({
      code: "toggleActive",
      label: row.isActive
        ? t("systemMenu.action.disable")
        : t("systemMenu.action.enable"),
      icon: SwitchButton,
      divided: true,
      run: () => ctx.toggleActive(row)
    });
  }
  if (auth.destroy) {
    actions.push({
      code: "delete",
      label: t("buttons.delete"),
      icon: Delete,
      danger: true,
      run: () => ctx.remove(row)
    });
  }
  return actions;
}

// ---------------------------------------------------------------- 危险动作确认

/** 只依赖通用请求能力：调用方传 reactive 包装后的实例也能通过类型检查 */
type ImpactApi = Pick<BaseApi, "baseApi" | "request">;

interface ImpactItem {
  key: string;
  label: string;
  count: number;
  hint?: string;
  samples?: string[];
}

interface ImpactResult {
  pk: string;
  name: string;
  has_impact: boolean;
  items: ImpactItem[];
}

interface ImpactPayload {
  results: ImpactResult[];
  totals: ImpactItem[];
  has_impact: boolean;
}

/** 拉取影响面（失败返回空：预检不可用不阻断删除，与列表页口径一致） */
async function fetchImpact(
  api: ImpactApi,
  pks: Array<string | number>
): Promise<ImpactPayload | null> {
  try {
    const res = await api.request<{ data?: ImpactPayload }>(
      "post",
      {},
      { pks: pks.map(String) },
      `${api.baseApi}/impact`
    );
    return res?.data ?? null;
  } catch {
    return null;
  }
}

/** 确认内容：级联范围 + 影响面明细 + 恢复路径 */
function renderContent(
  rows: MenuRow[],
  payload: ImpactPayload | null,
  t: TFunction
) {
  const cascade = rows.filter(
    row => row.menuType === MenuChoices.DIRECTORY && row.descendantCount > 0
  );
  const blocks = [
    h(
      "div",
      { class: "mb-2" },
      t("systemMenu.confirm.removeCount", { count: rows.length })
    )
  ];

  cascade.slice(0, 5).forEach(row => {
    blocks.push(
      h(
        "div",
        { class: "pl-2 text-sm text-[var(--el-color-warning)]" },
        t("systemMenu.confirm.cascade", {
          title: displayTitle(row),
          count: row.descendantCount
        })
      )
    );
  });

  const impacted = (payload?.results ?? []).filter(item => item.has_impact);
  impacted.slice(0, 5).forEach(item => {
    blocks.push(
      h("div", { class: "mt-2" }, [
        h("div", { class: "font-medium" }, item.name || item.pk),
        ...item.items.map(child =>
          h(
            "div",
            { class: "pl-2 text-sm text-[var(--el-text-color-secondary)]" },
            [
              `${child.label}：${child.count}`,
              child.samples?.length ? `（${child.samples.join("、")}）` : ""
            ]
          )
        )
      ])
    );
  });

  if (!payload) {
    blocks.push(
      h(
        "div",
        { class: "mt-2 text-sm text-[var(--el-text-color-secondary)]" },
        t("systemMenu.confirm.impactUnavailable")
      )
    );
  }

  blocks.push(
    h(
      "div",
      { class: "mt-3 text-sm text-[var(--el-text-color-secondary)]" },
      t("systemMenu.confirm.recycleHint")
    )
  );
  return h("div", blocks);
}

/** 删除前确认：返回 true = 继续删除 */
export async function confirmMenuDelete(
  api: ImpactApi,
  rows: MenuRow[],
  t: TFunction
): Promise<boolean> {
  if (!rows.length) return false;
  const payload = await fetchImpact(
    api,
    rows.map(row => row.pk)
  );
  try {
    await ElMessageBox.confirm(
      renderContent(rows, payload, t),
      t("systemMenu.confirm.removeTitle"),
      {
        confirmButtonText: t("buttons.delete"),
        cancelButtonText: t("buttons.cancel"),
        confirmButtonClass: "el-button--danger",
        type: "warning",
        customClass: "menu-confirm-box"
      }
    );
    return true;
  } catch {
    return false;
  }
}

/** 批量启停前的后果说明（停用目录会让子级被提升为顶级菜单） */
export async function confirmBatchActive(
  rows: MenuRow[],
  isActive: boolean,
  t: TFunction
): Promise<boolean> {
  if (!rows.length) return false;
  const directories = rows.filter(
    row => row.menuType === MenuChoices.DIRECTORY && row.descendantCount > 0
  );
  const blocks = [
    h(
      "div",
      { class: "mb-2" },
      isActive
        ? t("systemMenu.confirm.activeCount", { count: rows.length })
        : t("systemMenu.confirm.inactiveCount", { count: rows.length })
    )
  ];
  if (!isActive && directories.length) {
    blocks.push(
      h(
        "div",
        { class: "text-sm text-[var(--el-color-warning)]" },
        t("systemMenu.confirm.inactiveDirectoryHint")
      )
    );
  }
  try {
    await ElMessageBox.confirm(
      h("div", blocks),
      isActive
        ? t("systemMenu.confirm.activeTitle")
        : t("systemMenu.confirm.inactiveTitle"),
      {
        confirmButtonText: t("buttons.sure"),
        cancelButtonText: t("buttons.cancel"),
        type: "warning"
      }
    );
    return true;
  } catch {
    return false;
  }
}
