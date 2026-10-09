/**
 * 菜单数据源持有（自 useMenuData 抽出）：rawRows 为唯一数据源 + 全量拉取 +
 * 局部更新原语（单行 upsert / 移除 / 批量补丁 / 行内忙标记）。
 *
 * 树派生（层级、计数、排序）与变更动作分别见 useMenuData / useMenuMutations。
 */

import { ref, type UnwrapNestedRefs } from "vue";
import { useI18n } from "vue-i18n";
import { SUCCESS_CODE } from "@/api/types";
import { message } from "@/utils/message";
import { fetchAllRows } from "@/utils/fetchAllRows";
import { fetchMetaList, META_KEYS } from "@/utils/metaCache";
import type { menuApi } from "@/api/system/menu";

// reactive(menuApi) 的类型：UnwrapNestedRefs 映射会剥离类私有成员标记
type MenuApi = UnwrapNestedRefs<typeof menuApi>;

export function useMenuRows(api: MenuApi) {
  const { t } = useI18n();

  const rawRows = ref<Array<Record<string, unknown>>>([]);
  const loading = ref(true);
  /** 行内启停中：pk 集合（按钮 loading 用） */
  const busyPks = ref<Set<string>>(new Set());

  const setBusy = (pk: string | number, busy: boolean) => {
    const next = new Set(busyPks.value);
    if (busy) next.add(String(pk));
    else next.delete(String(pk));
    busyPks.value = next;
  };

  /** 拉取菜单全量（强制刷新共享缓存，供角色/权限页复用） */
  const getMenuData = () => {
    loading.value = true;
    return fetchMetaList(META_KEYS.menu, () => fetchAllRows(api.list), {
      force: true
    })
      .then(res => {
        if (res.code === SUCCESS_CODE) {
          rawRows.value = res.data.results as Array<Record<string, unknown>>;
        } else {
          message(`${t("results.failed")}，${res.detail}`, { type: "error" });
        }
      })
      .catch(() => undefined)
      .finally(() => {
        loading.value = false;
      });
  };

  /** 单行替换/插入（保存后局部更新，保持展开状态与滚动位置） */
  const upsertRow = (raw: Record<string, unknown>) => {
    const pk = String(raw.pk);
    const next = [...rawRows.value];
    const index = next.findIndex(row => String(row.pk) === pk);
    if (index >= 0) next.splice(index, 1, raw);
    else next.push(raw);
    rawRows.value = next;
  };

  /** 移除若干行（删除后局部更新；后代由后端级联软删，这里按 pk 一并剔除） */
  const dropRows = (pks: Array<string | number>) => {
    const set = new Set(pks.map(String));
    rawRows.value = rawRows.value.filter(row => !set.has(String(row.pk)));
  };

  /** 批量打补丁（排序后的 rank / 拖拽换父后的 parent 等局部字段变更） */
  const patchRows = (patch: Map<string, Record<string, unknown>>) => {
    if (!patch.size) return;
    rawRows.value = rawRows.value.map(row => {
      const next = patch.get(String(row.pk));
      return next ? { ...row, ...next } : row;
    });
  };

  return {
    rawRows,
    loading,
    busyPks,
    setBusy,
    getMenuData,
    upsertRow,
    dropRows,
    patchRows
  };
}
