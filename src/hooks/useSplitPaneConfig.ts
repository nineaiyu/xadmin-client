import { ref, watch, onBeforeUnmount } from "vue";
import { responsiveStorageNameSpace } from "@/store/utils";
import { useSiteConfigStoreHook } from "@/store/modules/siteConfig";
import {
  SAVE_DEBOUNCE_MS,
  createSplitPaneStorage,
  type SplitPaneOptions
} from "./splitPaneStorage";

export type { SplitPaneOptions } from "./splitPaneStorage";

/**
 * 分栏宽度持久化：`localStorage 即时层 + WEB_SITE_CONFIG.SplitPanes 跨设备层`。
 *
 * - 初始化：本地缓存优先（同设备无闪烁），本地没有该页配置时采用远端值
 *   （远端晚到由 watch 兜底——router/utils.ts 中的 getSiteConfig 未被 await）；
 * - 保存：拖拽结束/重置后本地立即写入（防刷新丢失），服务端 debounce 单键
 *   PATCH {"SplitPanes": map}；组件卸载时若有待发 PATCH 则立即补发。
 *
 * 存储与远端同步见 splitPaneStorage.ts。
 *
 * @param pageKey 页面标识（建议用路由 path，如 "system/user"）
 */
export function useSplitPaneConfig(pageKey: string, options: SplitPaneOptions) {
  const defaultPercent = options.defaultPercent;
  const minPercent = options.minPercent ?? 0;
  const nameSpace = responsiveStorageNameSpace();
  const siteConfigStore = useSiteConfigStoreHook();

  const storage = createSplitPaneStorage({
    pageKey,
    nameSpace,
    syncConfig: map => {
      siteConfigStore.config = { ...siteConfigStore.config, SplitPanes: map };
    }
  });

  const clamp = (value: number) =>
    Math.min(Math.max(value, minPercent), 100 - minPercent);

  const percent = ref(defaultPercent);

  const localValue = storage.readLocalMap()[pageKey];
  if (typeof localValue === "number") {
    percent.value = clamp(localValue);
  }

  // 远端权威 + 本地即时：本地缓存只负责首帧无闪烁，服务端值才是唯一事实源。
  // 每次挂载（含刷新）读到远端值即应用并回写本地——否则本机曾拖过一次后
  // 本地旧值会永久压制其他设备/本机后续保存的新值（跨浏览器看老数据）。
  // 会话内用户一旦拖拽（interacted）即停止应用远端，避免拖拽中/待 PATCH
  // 期间被晚到的旧值回拉。回写只走 writeLocal，不得反向 PATCH。
  let interacted = false;
  const stopRemoteWatch = watch(
    () =>
      (siteConfigStore.config as PlatformConfigs | undefined)?.SplitPanes?.[
        pageKey
      ],
    remoteValue => {
      if (!interacted && typeof remoteValue === "number") {
        const next = clamp(remoteValue);
        if (next !== percent.value) {
          percent.value = next;
          storage.writeLocal(next);
        }
      }
    },
    { immediate: true }
  );

  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  const persist = () => {
    // 本地即写：F5/关闭标签页不触发组件卸载钩子，本地若也走 debounce 会丢配置
    storage.writeLocal(percent.value);
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      storage.patchRemote();
    }, SAVE_DEBOUNCE_MS);
  };

  /** 组件 drag-end 事件入口（拖拽结束与重置共用） */
  const handleDragEnd = (value: number) => {
    interacted = true;
    percent.value = clamp(value);
    persist();
  };

  onBeforeUnmount(() => {
    stopRemoteWatch();
    if (saveTimer) {
      // 卸载时立即补发待保存的远端 PATCH（本地缓存已在拖拽结束时写好）
      clearTimeout(saveTimer);
      saveTimer = null;
      storage.patchRemote();
    }
  });

  return { percent, handleDragEnd };
}
