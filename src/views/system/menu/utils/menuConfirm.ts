/**
 * 菜单删除确认（带影响面预检）。
 *
 * 与列表页的 `confirmImpact` 不同：菜单删除必须**始终**告知三件事——
 * ① 目录会级联带走全部后代（后端软删级联，同时间戳成组恢复）；
 * ② 会被哪些角色引用（后端 impact 计算器的 samples）；
 * ③ 删错了能从哪里恢复（回收站）。
 * 因此这里不复用「无影响即直接放行」的通用实现。
 */

import { h } from "vue";
import { ElMessageBox } from "element-plus";
import type { useI18n } from "vue-i18n";
import type { BaseApi } from "@/api/base";
import { MenuChoices } from "@/views/system/constants";
import { displayTitle } from "./useMenuFilter";
import type { MenuRow } from "./types";

type TFunction = ReturnType<typeof useI18n>["t"];

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
