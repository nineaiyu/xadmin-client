import { onBeforeUnmount, ref } from "vue";
import { useRoute } from "vue-router";
import Storage from "responsive-storage";
import { configApi } from "@/api/config";
import { responsiveStorageNameSpace } from "@/store/utils";
import { useSiteConfigStoreHook } from "@/store/modules/siteConfig";
import type { TableColumnLike } from "./utils";

/**
 * 表格偏好持久化：列显隐 / 列顺序 / 密度「本地即时层 + WEB_SITE_CONFIG 跨设备层」。
 *
 * - 页面标识用路由 path（同一页面在不同入口下保持一套偏好）；
 * - 列用 **label（i18n key）** 作为稳定标识：切换语言不改偏好，列被删除时静默忽略；
 * - 本地即写（刷新不丢），远端 debounce 单键 PATCH `{TablePrefs: {<page>: {...}}}`，
 *   后端 dict merge 语义下不影响其它站点配置字段；
 * - 未持久化过任何偏好的页面行为完全不变（apply 是幂等的无副作用操作）。
 */

/** WEB_SITE_CONFIG.TablePrefs 的键名（本地与远端同名） */
const STORAGE_KEY = "tablePrefs";
/** 远端 PATCH 防抖窗口：本地已即写，这里只合并连续操作 */
const SAVE_DEBOUNCE_MS = 600;

export type TablePrefs = {
  /** 表格密度（EP size：large / default / small） */
  size?: string;
  /** 被隐藏列的 label；缺省 = 未持久化过（此时不改变列的默认显隐） */
  hidden?: string[];
  /** 列顺序（label 序列）；未出现的列按默认顺序排在后面 */
  order?: string[];
};

type PrefsMap = Record<string, TablePrefs>;

export function useTablePrefs(pageKey?: string) {
  const route = useRoute();
  const key = pageKey || route.path || "unknown";
  const nameSpace = responsiveStorageNameSpace();
  const siteConfigStore = useSiteConfigStoreHook();

  const readLocalMap = (): PrefsMap => {
    const data = Storage.getData(STORAGE_KEY, nameSpace);
    return data && typeof data === "object" ? (data as PrefsMap) : {};
  };

  const current = readLocalMap()[key] ?? {};
  /** 表格密度（供组件初始化 ref 使用） */
  const size = ref<string>(current.size || "default");
  const prefs = ref<TablePrefs>(current);

  const labelOf = (column: TableColumnLike) =>
    typeof column?.label === "string" ? column.label : "";

  /** 应用已保存偏好（无偏好时零变化；列被删除/无 label 的列静默忽略） */
  const apply = (columns: TableColumnLike[]) => {
    const saved = prefs.value;
    if (!columns?.length) return;
    if (Array.isArray(saved.hidden)) {
      columns.forEach(column => {
        const label = labelOf(column);
        if (!label) return;
        column.hide = saved.hidden?.includes(label) ?? false;
      });
    }
    if (Array.isArray(saved.order) && saved.order.length) {
      const rank = new Map(saved.order.map((label, index) => [label, index]));
      const sorted = [...columns].sort((left, right) => {
        const leftRank = rank.get(labelOf(left));
        const rightRank = rank.get(labelOf(right));
        if (leftRank === undefined && rightRank === undefined) return 0;
        if (leftRank === undefined) return 1;
        if (rightRank === undefined) return -1;
        return leftRank - rightRank;
      });
      columns.splice(0, columns.length, ...sorted);
    }
    if (saved.size) size.value = saved.size;
  };

  const writeLocal = (value: TablePrefs) => {
    const map: PrefsMap = { ...readLocalMap(), [key]: value };
    // responsive-storage 运行时对 string 直接存储、getData 自动 JSON.parse
    Storage.set(`${nameSpace}${STORAGE_KEY}`, JSON.stringify(map));
    // store.config 是 saveSiteConfig（主题保存）整包 PATCH 的数据源，必须同步，
    // 否则随后的主题保存会用旧 TablePrefs 回滚表格偏好
    siteConfigStore.config = {
      ...siteConfigStore.config,
      TablePrefs: map
    } as typeof siteConfigStore.config;
  };

  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  const patchRemote = () => {
    configApi.setSiteConfig({ TablePrefs: { ...readLocalMap() } });
  };

  /** 保存当前列状态（列显隐 + 顺序 + 密度）：本地即写，远端防抖 */
  const save = (columns: TableColumnLike[], tableSize?: string) => {
    const hidden = (columns ?? [])
      .filter(column => column?.hide === true)
      .map(labelOf)
      .filter(Boolean);
    const order = (columns ?? []).map(labelOf).filter(Boolean);
    const value: TablePrefs = { size: tableSize || size.value, hidden, order };
    prefs.value = value;
    writeLocal(value);
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      patchRemote();
    }, SAVE_DEBOUNCE_MS);
  };

  /** 重置偏好（恢复默认列配置后由调用方重新 apply 默认值） */
  const reset = () => {
    prefs.value = {};
    writeLocal({});
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      patchRemote();
    }, SAVE_DEBOUNCE_MS);
  };

  onBeforeUnmount(() => {
    if (saveTimer) {
      // 卸载时立即补发待保存的远端 PATCH（本地缓存已在 save 中写好）
      clearTimeout(saveTimer);
      saveTimer = null;
      patchRemote();
    }
  });

  return { size, prefs, apply, save, reset };
}
