/**
 * 菜单变更动作层：保存 / 快速重命名 / 行内启停（乐观更新 + 失败回滚）/
 * 删除（含级联说明与影响面预检）/ 批量启停 / 排序提交。
 *
 * 数据源（rawRows 及其派生树）与局部更新原语（patchRows / upsertRow /
 * dropRows / setBusy）留在 useMenuData，本模块只消费注入的原语——变更
 * 语义与数据持有分离，单测可脱离树装配独立验证（见 useMenuMutations.spec.ts）。
 */

import type { useI18n } from "vue-i18n";
import type { UnwrapNestedRefs } from "vue";
import type { menuApi } from "@/api/system/menu";
import { SUCCESS_CODE } from "@/api/types";
import { message } from "@/utils/message";
import { confirmBatchActive, confirmMenuDelete } from "./menuActions";
import { flattenMenuTree, toPayload } from "./normalize";
import { displayTitle } from "./useMenuFilter";
import type { MenuFormModel, MenuRow } from "./types";

type TFunction = ReturnType<typeof useI18n>["t"];
// reactive(menuApi) 的类型：UnwrapNestedRefs 映射会剥离类私有成员标记，
// 不能直接写 typeof menuApi（hasFileObject 为 private，赋值检查会缺属性报错）
type MenuApi = UnwrapNestedRefs<typeof menuApi>;

/** 目录删除会级联软删全部后代：本地按行内已装配的 children 一并剔除，避免残影 */
function collectDescendantPks(row: MenuRow): string[] {
  return flattenMenuTree(row.children).map(item => String(item.pk));
}

export function useMenuMutations({
  api,
  t,
  setBusy,
  patchRows,
  upsertRow,
  dropRows
}: {
  api: MenuApi;
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

  /** 删除（含级联说明与影响面预检） */
  const removeRows = async (rows: MenuRow[]) => {
    if (!rows.length) return false;
    if (!(await confirmMenuDelete(api, rows, t))) return false;
    const pks = rows.map(row => row.pk);
    const res =
      pks.length > 1
        ? await api.batchDestroy(pks, { impact_confirmed: true })
        : await api.destroy(pks[0] as number, { impact_confirmed: true });
    if (res.code !== SUCCESS_CODE) {
      message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      return false;
    }
    const removed = new Set(pks.map(String));
    rows.forEach(row =>
      collectDescendantPks(row).forEach(pk => removed.add(pk))
    );
    dropRows([...removed]);
    message(t("results.success"), { type: "success" });
    return true;
  };

  /** 批量启停：确认后调 batch-update（白名单只有 is_active），成功后本地同步 */
  const setRowsActive = async (rows: MenuRow[], isActive: boolean) => {
    if (!rows.length) return false;
    if (!(await confirmBatchActive(rows, isActive, t))) return false;
    const pks = rows.flatMap(row => [
      String(row.pk),
      ...collectDescendantPks(row)
    ]);
    const unique = [...new Set(pks)];
    const res = await api.batchUpdate(unique, { is_active: isActive });
    if (res.code !== SUCCESS_CODE) {
      message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      return false;
    }
    const patch = new Map<string, Record<string, unknown>>();
    unique.forEach(pk => patch.set(pk, { is_active: isActive }));
    patchRows(patch);
    message(t("systemMenu.result.batchActive", { count: unique.length }), {
      type: "success"
    });
    return true;
  };

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
