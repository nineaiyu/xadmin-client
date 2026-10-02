/**
 * 菜单数据层：数据源持有（rawRows → 树派生 / 行索引 / 统计）、全量拉取、
 * 局部更新原语，并组装变更动作（useMenuMutations）与导入导出（useMenuTransfer）。
 *
 * 口径：
 * - `rawRows` 为唯一数据源（接口原始行），`treeData` 由它派生——保存/删除后只需替换
 *   或移除对应行，树结构（层级、计数、排序）自动重算，不必整树重拉；
 * - 排名提交沿用后端 `rank` 接口（接收前序 pk 列表，单条 SQL 落库组）；
 * - 删除走影响面预检（后端 `POST {baseApi}/impact`），确认后带 `impact_confirmed`；
 *   变更动作（保存/启停/删除/批量/排序）与导入导出分别收口在
 *   useMenuMutations.ts / useMenuTransfer.ts，本文件持有状态并注入更新原语。
 *
 * 字典/接口清单/关联模型候选/组件路径清单等「下拉与候选」装配见 useMenuMeta.ts。
 */

import { computed, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { SUCCESS_CODE } from "@/api/types";
import { message } from "@/utils/message";
import { menuApi } from "@/api/system/menu";
import { fetchAllRows } from "@/utils/fetchAllRows";
import { fetchMetaList, META_KEYS } from "@/utils/metaCache";
import { MenuChoices } from "@/views/system/constants";
import {
  buildMenuTree,
  buildRowIndex,
  flattenMenuTree,
  normalizeMenuRow
} from "./normalize";
import { useMenuMeta } from "./useMenuMeta";
import { useMenuMutations } from "./useMenuMutations";
import { useMenuTransfer } from "./useMenuTransfer";
import type { MenuRow } from "./types";

export function useMenuData() {
  const { t } = useI18n();
  const api = reactive(menuApi);

  const rawRows = ref<Array<Record<string, unknown>>>([]);
  const loading = ref(true);
  /** 行内启停中：pk 集合（按钮 loading 用） */
  const busyPks = ref<Set<string>>(new Set());

  const meta = useMenuMeta({ api });

  const treeData = computed<MenuRow[]>(() =>
    buildMenuTree(rawRows.value.map(normalizeMenuRow))
  );
  const flatRows = computed<MenuRow[]>(() => flattenMenuTree(treeData.value));
  const rowIndex = computed(() => buildRowIndex(treeData.value));
  const stats = computed(() => {
    const rows = flatRows.value;
    const count = (type: number) =>
      rows.filter(row => row.menuType === type).length;
    return {
      total: rows.length,
      directory: count(MenuChoices.DIRECTORY),
      menu: count(MenuChoices.MENU),
      permission: count(MenuChoices.PERMISSION),
      inactive: rows.filter(row => !row.isActive).length
    };
  });

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

  const mutations = useMenuMutations({
    api,
    t,
    setBusy,
    patchRows,
    upsertRow,
    dropRows
  });

  const transfer = useMenuTransfer({ t, api, reload: getMenuData });

  return {
    api,
    loading,
    treeData,
    flatRows,
    rowIndex,
    stats,
    busyPks,
    choicesDict: meta.choicesDict,
    menuUrlList: meta.menuUrlList,
    modelList: meta.modelList,
    viewList: meta.viewList,
    getMenuData,
    getMenuApiList: meta.getMenuApiList,
    loadModels: meta.loadModels,
    loadViews: meta.loadViews,
    upsertRow,
    dropRows,
    patchRows,
    ...mutations,
    exportData: transfer.exportData,
    importData: transfer.importData
  };
}
