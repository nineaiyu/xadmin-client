/**
 * 菜单数据层：拉取与树装配、局部更新、删除/批量删除（带影响面）、批量启停、排序提交、导入导出。
 *
 * 口径：
 * - `rawRows` 为唯一数据源（接口原始行），`treeData` 由它派生——保存/删除后只需替换
 *   或移除对应行，树结构（层级、计数、排序）自动重算，不必整树重拉；
 * - 排名提交沿用后端 `rank` 接口（接收前序 pk 列表，单条 SQL 落库组）；
 * - 删除走影响面预检（后端 `POST {baseApi}/impact`），确认后带 `impact_confirmed`。
 */

import { computed, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { isEmpty, isNullOrUnDef } from "@pureadmin/utils";
import type { RecordType } from "plus-pro-components";
import { SUCCESS_CODE } from "@/api/types";
import { message } from "@/utils/message";
import { menuApi } from "@/api/system/menu";
import { modelLabelFieldApi } from "@/api/system/field";
import { fetchAllRows } from "@/utils/fetchAllRows";
import { fetchMetaList, META_KEYS } from "@/utils/metaCache";
import { handleExportData, handleImportData } from "@/components/RePlusPage";
import { formatFiledAppParent } from "@/views/system/hooks";
import { handleTree } from "@/utils/tree";
import { FieldChoices, MenuChoices } from "@/views/system/constants";
import {
  buildMenuTree,
  buildRowIndex,
  flattenMenuTree,
  normalizeMenuRow,
  toPayload
} from "./normalize";
import { confirmBatchActive, confirmMenuDelete } from "./menuConfirm";
import { displayTitle } from "./useMenuFilter";
import type {
  MenuAuths,
  MenuChoiceItem,
  MenuFormModel,
  MenuRow,
  MenuUrlItem,
  ModelTreeItem
} from "./types";

export function useMenuData() {
  const { t } = useI18n();
  const api = reactive(menuApi);

  const rawRows = ref<Array<Record<string, unknown>>>([]);
  const loading = ref(true);
  const choicesDict = ref<Record<string, MenuChoiceItem[]>>({});
  const menuUrlList = ref<MenuUrlItem[]>([]);
  const modelList = ref<ModelTreeItem[]>([]);
  /** 组件路径清单（value → 视图组件 name，空闲时异步填充） */
  const viewList = ref<Record<string, string>>({});
  /** 行内启停中：pk 集合（按钮 loading 用） */
  const busyPks = ref<Set<string>>(new Set());

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

  /** 保存（新增/编辑）：成功后用接口返回行局部更新树 */
  const saveNode = async (model: MenuFormModel, isAdd: boolean) => {
    const payload = toPayload(model);
    const res = isAdd
      ? await api.create(payload)
      : await api.partialUpdate(model.pk as number, payload);
    if (res.code === SUCCESS_CODE && res.data) {
      upsertRow(res.data as unknown as Record<string, unknown>);
    }
    return res;
  };

  /** 快速重命名：只提交 meta.title（后端 meta 缺省其余字段不动） */
  const renameNode = async (row: MenuRow, title: string) => {
    const res = await api.partialUpdate(row.pk as number, {
      meta: { title }
    });
    if (res.code === SUCCESS_CODE && res.data) {
      upsertRow(res.data as unknown as Record<string, unknown>);
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
    // 目录删除会级联软删全部后代：本地一并剔除，避免残影
    const removed = new Set(pks.map(String));
    rows.forEach(row =>
      collectDescendantPks(row).forEach(pk => removed.add(pk))
    );
    dropRows([...removed]);
    message(t("results.success"), { type: "success" });
    return true;
  };

  const collectDescendantPks = (row: MenuRow): string[] =>
    flattenMenuTree(row.children).map(item => String(item.pk));

  /** 批量启停：确认后调 batch-update（白名单只有 is_active），成功后本地同步 */
  const setRowsActive = async (rows: MenuRow[], isActive: boolean) => {
    if (!rows.length) return false;
    if (!(await confirmBatchActive(rows, isActive, t))) return false;
    const pks = rows.flatMap(row => [
      row.pk as number,
      ...collectDescendantPks(row).map(pk => pk as unknown as number)
    ]);
    const unique = [...new Set(pks.map(String))].map(pk => pk);
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

  const exportData = (treeRef: {
    getCheckedKeys?: (leafOnly?: boolean) => unknown[];
  }) => {
    const pks = (treeRef?.getCheckedKeys?.(false) ?? []) as Array<
      string | number
    >;
    handleExportData({ t, pks, api, allowTypes: ["selected", "all"] });
  };

  const importData = () => {
    handleImportData({ t, api, success: () => getMenuData() });
  };

  /** 字典 + 后端接口清单（权限路由下拉） */
  const getMenuApiList = (auth: MenuAuths) => {
    if (auth.apiUrl) {
      api.apiUrl().then(res => {
        if (res.code === SUCCESS_CODE) {
          menuUrlList.value = res.data as unknown as MenuUrlItem[];
        }
      });
    }
    api.choices().then(res => {
      if (res.code === SUCCESS_CODE) {
        choicesDict.value = res.choices_dict as Record<
          string,
          MenuChoiceItem[]
        >;
      }
    });
  };

  /** 关联模型（数据/字段权限绑定）候选：需具备模型字段权限列表权限 */
  const loadModels = () => {
    fetchAllRows(modelLabelFieldApi.list, {
      parent: 0,
      field_type: FieldChoices.ROLE
    }).then(res => {
      if (res.code !== SUCCESS_CODE) return;
      const results: RecordType[] = [];
      res.data.results.forEach(item => {
        // 级联值取 pk：与行数据 model（pk 列表）及提交载荷同口径，
        // 取对象会让「已有选中项回显」与提交形态不一致
        results.push({
          pk: item.pk,
          name: item.name,
          label: item.label,
          value: item.pk
        });
      });
      formatFiledAppParent(results);
      modelList.value = handleTree(results) as ModelTreeItem[];
    });
  };

  // 组件路径清单需逐个 import 视图组件才能读到 name，成本高且仅用于下拉：幂等 + 空闲加载
  let viewsLoading = false;
  const loadViews = () => {
    if (viewsLoading) return;
    viewsLoading = true;
    const files = import.meta.glob<{ default: { name?: string } }>(
      "@/views/**/*.vue"
    );
    Object.keys(files).forEach((file: string) => {
      // components 目录为依赖组件而非页面组件，不入候选
      if (/\/components\//.test(file)) return;
      files[file]().then(data => {
        if (
          isEmpty(data?.default?.name) ||
          isNullOrUnDef(data?.default?.name)
        ) {
          return;
        }
        viewList.value[
          file.replace(/(\.\/|\.vue)/g, "").replace("/src/views/", "")
        ] = data?.default?.name as string;
      });
    });
  };

  return {
    api,
    loading,
    treeData,
    flatRows,
    rowIndex,
    stats,
    busyPks,
    choicesDict,
    menuUrlList,
    modelList,
    viewList,
    getMenuData,
    getMenuApiList,
    loadModels,
    loadViews,
    upsertRow,
    dropRows,
    patchRows,
    saveNode,
    renameNode,
    toggleActive,
    removeRows,
    setRowsActive,
    submitRank,
    exportData,
    importData
  };
}
