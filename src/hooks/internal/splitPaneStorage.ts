import Storage from "responsive-storage";
import { configApi } from "@/api/config";

/** WEB_SITE_CONFIG.SplitPanes 的本地缓存键（responsive- 前缀由 nameSpace 提供） */
export const STORAGE_KEY = "splitPanes";
/** 远端 PATCH 防抖窗口：本地已即写，这里只合并连续拖拽的请求次数 */
export const SAVE_DEBOUNCE_MS = 400;

type SplitPanesMap = Record<string, number>;

export interface SplitPaneOptions {
  /** 重置按钮/双击分隔条恢复到的默认左栏百分比 */
  defaultPercent: number;
  /** 双侧最小百分比边界（左栏与右栏对称，与组件 minPercent 同口径） */
  minPercent?: number;
}

/**
 * 分栏宽度持久化（自 useSplitPaneConfig.ts 抽出）：本地即写层（responsive-storage）
 * 与 WEB_SITE_CONFIG 跨设备层（单键 PATCH {"SplitPanes": map}，后端 dict merge
 * 语义下其余站点配置字段互不破坏）。
 */
export function createSplitPaneStorage({
  pageKey,
  nameSpace,
  syncConfig
}: {
  pageKey: string;
  nameSpace: string | undefined;
  /** 同步 siteConfig store（主题保存整包 PATCH 的数据源） */
  syncConfig: (map: SplitPanesMap) => void;
}) {
  const readLocalMap = (): SplitPanesMap => {
    const data = Storage.getData(STORAGE_KEY, nameSpace);
    return data && typeof data === "object" ? (data as SplitPanesMap) : {};
  };

  /** 写本地缓存 + 同步 store 快照（同步执行，刷新/关标签页前已落盘） */
  const writeLocal = (percent: number) => {
    const map: SplitPanesMap = { ...readLocalMap(), [pageKey]: percent };
    // responsive-storage 运行时对 string 直接存储、getData 自动 JSON.parse，
    // 显式 stringify 以匹配其 .d.ts 中过窄的 set(key, val: string) 签名
    Storage.set(`${nameSpace}${STORAGE_KEY}`, JSON.stringify(map));
    // store.config 是 saveSiteConfig（主题保存）整包 PATCH 的数据源，必须同步，
    // 否则随后的主题保存会用旧 SplitPanes 回滚分栏配置
    syncConfig(map);
  };

  /** 单键 PATCH 远端（其余站点配置字段由后端 merge 保留） */
  const patchRemote = () => {
    configApi.setSiteConfig({ SplitPanes: { ...readLocalMap() } });
  };

  return { readLocalMap, writeLocal, patchRemote };
}
