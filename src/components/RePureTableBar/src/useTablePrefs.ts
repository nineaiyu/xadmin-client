import { onBeforeUnmount, ref } from "vue";
import { useRoute } from "vue-router";
import { responsiveStorageNameSpace } from "@/store/utils";
import { useSiteConfigStoreHook } from "@/store/modules/siteConfig";
import { applyTablePrefs } from "./tablePrefsApply";
import {
  SAVE_DEBOUNCE_MS,
  createTablePrefsStorage,
  type PrefsMap,
  type TablePrefs
} from "./tablePrefsStorage";
import type { TableColumnLike } from "./utils";

export type { TablePrefs } from "./tablePrefsStorage";

/**
 * 表格偏好持久化：列显隐 / 列顺序 / 密度「本地即时层 + WEB_SITE_CONFIG 跨设备层」。
 *
 * - 页面标识用路由 path（同一页面在不同入口下保持一套偏好）；
 * - 列用 **label（i18n key）** 作为稳定标识：切换语言不改偏好，列被删除时静默忽略；
 * - 本地即写（刷新不丢），远端 debounce 单键 PATCH；
 * - 未持久化过任何偏好的页面行为完全不变（apply 是幂等的无副作用操作）。
 *
 * 存储与远端同步见 tablePrefsStorage.ts，偏好应用见 tablePrefsApply.ts。
 */
export function useTablePrefs(pageKey?: string) {
  const route = useRoute();
  const key = pageKey || route.path || "unknown";
  const nameSpace = responsiveStorageNameSpace();
  const siteConfigStore = useSiteConfigStoreHook();

  const storage = createTablePrefsStorage({
    nameSpace,
    syncConfig: (map: PrefsMap) => {
      siteConfigStore.config = {
        ...siteConfigStore.config,
        TablePrefs: map
      } as typeof siteConfigStore.config;
    }
  });

  const current = storage.readLocalMap()[key] ?? {};
  /** 表格密度（供组件初始化 ref 使用） */
  const size = ref<string>(current.size || "default");
  const prefs = ref<TablePrefs>(current);

  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  /** 远端防抖提交：连续操作合并为一次 PATCH */
  const scheduleRemote = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      storage.patchRemote();
    }, SAVE_DEBOUNCE_MS);
  };

  /** 应用已保存偏好（无偏好时零变化；列被删除/无 label 的列静默忽略） */
  const apply = (columns: TableColumnLike[]) => {
    const { size: savedSize } = applyTablePrefs(prefs.value, columns);
    if (savedSize) size.value = savedSize;
  };

  /** 保存当前列状态（列显隐 + 顺序 + 密度）：本地即写，远端防抖 */
  const save = (columns: TableColumnLike[], tableSize?: string) => {
    const hidden = (columns ?? [])
      .filter(column => column?.hide === true)
      .map(column => (typeof column?.label === "string" ? column.label : ""))
      .filter(Boolean);
    const order = (columns ?? [])
      .map(column => (typeof column?.label === "string" ? column.label : ""))
      .filter(Boolean);
    const value: TablePrefs = { size: tableSize || size.value, hidden, order };
    prefs.value = value;
    storage.writeLocal(key, value);
    scheduleRemote();
  };

  /** 重置偏好（恢复默认列配置后由调用方重新 apply 默认值） */
  const reset = () => {
    prefs.value = {};
    storage.writeLocal(key, {});
    scheduleRemote();
  };

  onBeforeUnmount(() => {
    if (saveTimer) {
      // 卸载时立即补发待保存的远端 PATCH（本地缓存已在 save 中写好）
      clearTimeout(saveTimer);
      saveTimer = null;
      storage.patchRemote();
    }
  });

  return { size, prefs, apply, save, reset };
}
