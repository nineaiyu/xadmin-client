import { ref, watch, onBeforeUnmount } from "vue";
import Storage from "responsive-storage";
import { configApi } from "@/api/config";
import { responsiveStorageNameSpace } from "@/store/utils";
import { useSiteConfigStoreHook } from "@/store/modules/siteConfig";

/** WEB_SITE_CONFIG.SplitPanes 的本地缓存键（responsive- 前缀由 nameSpace 提供） */
const STORAGE_KEY = "splitPanes";
/** 远端 PATCH 防抖窗口：本地已即写，这里只合并连续拖拽的请求次数 */
const SAVE_DEBOUNCE_MS = 400;

type SplitPanesMap = Record<string, number>;

export interface SplitPaneOptions {
  /** 重置按钮/双击分隔条恢复到的默认左栏百分比 */
  defaultPercent: number;
  /** 双侧最小百分比边界（左栏与右栏对称，与组件 minPercent 同口径） */
  minPercent?: number;
}

/**
 * 分栏宽度持久化：`localStorage 即时层 + WEB_SITE_CONFIG.SplitPanes 跨设备层`。
 *
 * - 初始化：本地缓存优先（同设备无闪烁），本地没有该页配置时采用远端值
 *   （远端晚到由 watch 兜底——router/utils.ts 中的 getSiteConfig 未被 await）；
 * - 保存：拖拽结束/重置后本地立即写入（防刷新丢失），服务端 debounce 单键
 *   PATCH {"SplitPanes": map}——后端 dict merge 语义下其余站点配置字段取现值，
 *   互不破坏；组件卸载时若有待发 PATCH 则立即补发。
 *
 * @param pageKey 页面标识（建议用路由 path，如 "system/user"）
 */
export function useSplitPaneConfig(pageKey: string, options: SplitPaneOptions) {
  const defaultPercent = options.defaultPercent;
  const minPercent = options.minPercent ?? 0;
  const nameSpace = responsiveStorageNameSpace();
  const siteConfigStore = useSiteConfigStoreHook();

  const clamp = (value: number) =>
    Math.min(Math.max(value, minPercent), 100 - minPercent);

  const readLocalMap = (): SplitPanesMap => {
    const data = Storage.getData(STORAGE_KEY, nameSpace);
    return data && typeof data === "object" ? (data as SplitPanesMap) : {};
  };

  const percent = ref(defaultPercent);

  const localValue = readLocalMap()[pageKey];
  if (typeof localValue === "number") {
    percent.value = clamp(localValue);
  }

  /** 写本地缓存 + 同步 store 快照（同步执行，刷新/关标签页前已落盘） */
  const writeLocal = () => {
    const map: SplitPanesMap = { ...readLocalMap(), [pageKey]: percent.value };
    // responsive-storage 运行时对 string 直接存储、getData 自动 JSON.parse，
    // 显式 stringify 以匹配其 .d.ts 中过窄的 set(key, val: string) 签名
    Storage.set(`${nameSpace}${STORAGE_KEY}`, JSON.stringify(map));
    // store.config 是 saveSiteConfig（主题保存）整包 PATCH 的数据源，必须同步，
    // 否则随后的主题保存会用旧 SplitPanes 回滚分栏配置
    siteConfigStore.config = { ...siteConfigStore.config, SplitPanes: map };
  };

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
          writeLocal();
        }
      }
    },
    { immediate: true }
  );

  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  /** 单键 PATCH 远端（其余站点配置字段由后端 merge 保留） */
  const patchRemote = () => {
    configApi.setSiteConfig({ SplitPanes: { ...readLocalMap() } });
  };

  const persist = () => {
    // 本地即写：F5/关闭标签页不触发组件卸载钩子，本地若也走 debounce 会丢配置
    writeLocal();
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      patchRemote();
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
      patchRemote();
    }
  });

  return { percent, handleDragEnd };
}
