/**
 * 菜单变更动作层：保存 / 快速重命名 / 行内启停（乐观更新 + 失败回滚）/ 排序提交。
 * 删除与批量启停拆至 menuMutationBatch.ts（同一返回面，页面无感）。
 *
 * 数据源（rawRows 及其派生树）与局部更新原语（patchRows / upsertRow /
 * dropRows / setBusy）留在 useMenuData，本模块只消费注入的原语——变更
 * 语义与数据持有分离，单测可脱离树装配独立验证（见 useMenuMutations.spec.ts）。
 */

import type { useI18n } from "vue-i18n";
import { SUCCESS_CODE } from "@/api/types";
import { message } from "@/utils/message";
import { toPayload } from "./normalize";
import { displayTitle } from "./useMenuFilter";
import { removeMenuRows, setMenuRowsActive } from "./menuMutationBatch";
import type { MenuMutationApi } from "./menuMutationTypes";
import type { MenuFormModel, MenuRow } from "./types";

type TFunction = ReturnType<typeof useI18n>["t"];

export function useMenuMutations({
  api,
  t,
  setBusy,
  patchRows,
  upsertRow,
  dropRows
}: {
  api: MenuMutationApi;
  t: TFunction;
  setBusy: (pk: string | number, busy: boolean) => void;
  patchRows: (patch: Map<string, Record<string, unknown>>) => void;
  upsertRow: (raw: Record<string, unknown>) => void;
  dropRows: (pks: Array<string | number>) => void;
}) {
  /** 保存（新增/编辑）：成功后用接口返回行局部更新树 */
  const saveNode = async (model: MenuFormModel, isAdd: boolean) => {
    const payload = toPayload(model);
    const res = isAdd
      ? await api.create(payload)
      : await api.partialUpdate(model.pk as number, payload);
    if (res.code === SUCCESS_CODE && res.data) {
      upsertRow(res.data);
    }
    return res;
  };

  /** 快速重命名：只提交 meta.title（后端 meta 缺省其余字段不动） */
  const renameNode = async (row: MenuRow, title: string) => {
    const res = await api.partialUpdate(row.pk as number, {
      meta: { title }
    });
    if (res.code === SUCCESS_CODE && res.data) {
      upsertRow(res.data);
    }
    return res;
  };

  /** 行内启停：乐观更新 + 失败回滚（状态唯一来源是 rawRows，改它才会触发重渲染） */
  const toggleActive = async (row: MenuRow, value: boolean) => {
    const previous = row.isActive;
    patchRows(new Map([[String(row.pk), { is_active: value }]]));
    setBusy(row.pk, true);
    try {
      const res = await api.partialUpdate(row.pk as number, {
        is_active: value
      });
      if (res.code !== SUCCESS_CODE) {
        patchRows(new Map([[String(row.pk), { is_active: previous }]]));
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
        return false;
      }
      message(
        value
          ? t("systemMenu.result.enabled", { title: displayTitle(row) })
          : t("systemMenu.result.disabled", { title: displayTitle(row) }),
        { type: "success" }
      );
      return true;
    } catch (error) {
      patchRows(new Map([[String(row.pk), { is_active: previous }]]));
      message(String((error as { detail?: string })?.detail ?? error), {
        type: "error"
      });
      return false;
    } finally {
      setBusy(row.pk, false);
    }
  };

  /** 删除（含级联说明与影响面预检，见 menuMutationBatch） */
  const removeRows = (rows: MenuRow[]) =>
    removeMenuRows({ api, t, rows, dropRows });

  /** 批量启停（见 menuMutationBatch） */
  const setRowsActive = (rows: MenuRow[], isActive: boolean) =>
    setMenuRowsActive({ api, t, rows, isActive, patchRows });

  /** 提交排序：前序 pk 列表（后端单条 SQL 落库 rank） */
  const submitRank = async (pks: Array<number | string>) => {
    const res = await api.rank(pks);
    if (res.code !== SUCCESS_CODE) {
      message(res.detail, { type: "error" });
      return false;
    }
    return true;
  };

  return {
    saveNode,
    renameNode,
    toggleActive,
    removeRows,
    setRowsActive,
    submitRank
  };
}
