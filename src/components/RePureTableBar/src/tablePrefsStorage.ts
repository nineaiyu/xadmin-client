import Storage from "responsive-storage";
import { configApi } from "@/api/config";

/** WEB_SITE_CONFIG.TablePrefs 的键名（本地与远端同名） */
export const STORAGE_KEY = "tablePrefs";
/** 远端 PATCH 防抖窗口：本地已即写，这里只合并连续操作 */
export const SAVE_DEBOUNCE_MS = 600;

export type TablePrefs = {
  /** 表格密度（EP size：large / default / small） */
  size?: string;
  /** 被隐藏列的 label；缺省 = 未持久化过（此时不改变列的默认显隐） */
  hidden?: string[];
  /** 列顺序（label 序列）；未出现的列按默认顺序排在后面 */
  order?: string[];
};

export type PrefsMap = Record<string, TablePrefs>;

/**
 * 表格偏好持久化（自 useTablePrefs.ts 抽出）：本地即时层（responsive-storage）
 * 与 WEB_SITE_CONFIG 跨设备层（单键 PATCH `{TablePrefs: {<page>: {...}}}`，
 * 后端 dict merge 语义下不影响其它站点配置字段）。
 */
export function createTablePrefsStorage({
  nameSpace,
  syncConfig
}: {
  nameSpace: string | undefined;
  /** 同步 siteConfig store（主题保存整包 PATCH 的数据源） */
  syncConfig: (map: PrefsMap) => void;
}) {
  const readLocalMap = (): PrefsMap => {
    const data = Storage.getData(STORAGE_KEY, nameSpace);
    return data && typeof data === "object" ? (data as PrefsMap) : {};
  };

  const patchRemote = () => {
    configApi.setSiteConfig({ TablePrefs: { ...readLocalMap() } });
  };

  const writeLocal = (key: string, value: TablePrefs) => {
    const map: PrefsMap = { ...readLocalMap(), [key]: value };
    // responsive-storage 运行时对 string 直接存储、getData 自动 JSON.parse
    Storage.set(`${nameSpace}${STORAGE_KEY}`, JSON.stringify(map));
    // store.config 是 saveSiteConfig（主题保存）整包 PATCH 的数据源，必须同步，
    // 否则随后的主题保存会用旧 TablePrefs 回滚表格偏好
    syncConfig(map);
  };

  return { readLocalMap, writeLocal, patchRemote };
}
