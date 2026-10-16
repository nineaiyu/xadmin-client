import { storageLocal } from "@pureadmin/utils";

import { responsiveStorageNameSpace } from "@/config";

/**
 * 悬浮球位置（本地偏好，不进站点配置）：拖动后记录球体左上角在视口中的坐标。
 *
 * 未拖动过（无记录）时返回 `null`，由样式回落到默认的「右下角 24px」；
 * 一旦有记录就以绝对定位还原，并在窗口尺寸变化时重新钳制回视口内
 * （记录来自另一台设备 / 更宽的窗口时不会跑到屏幕外）。
 */

export interface FabPosition {
  x: number;
  y: number;
}

export interface FabViewport {
  width: number;
  height: number;
}

const STORAGE_KEY = "preferences-fab-position";

/** 球体直径：与 `.setting-fab` 的 44px 保持同步 */
export const FAB_SIZE = 44;

/** 贴边留白：即便拖到最角上也保留一点可抓取余量 */
export const FAB_MARGIN = 8;

/** 把位置钳制回视口内（左上角至少留白、右下角整球可见） */
export function clampFabPosition(
  position: FabPosition,
  viewport: FabViewport
): FabPosition {
  // 视口比球体还窄时（理论极端值）退化为左上留白，避免出现负值
  const maxX = Math.max(FAB_MARGIN, viewport.width - FAB_SIZE - FAB_MARGIN);
  const maxY = Math.max(FAB_MARGIN, viewport.height - FAB_SIZE - FAB_MARGIN);
  return {
    x: Math.min(Math.max(position.x, FAB_MARGIN), maxX),
    y: Math.min(Math.max(position.y, FAB_MARGIN), maxY)
  };
}

/** 读取已保存的位置（无记录或数据损坏时返回 `null`，回落默认角落） */
export function readFabPosition(): FabPosition | null {
  let raw: FabPosition | null = null;
  try {
    raw = storageLocal().getItem<FabPosition>(
      `${responsiveStorageNameSpace()}${STORAGE_KEY}`
    );
  } catch {
    // 存储里是非法 JSON（人工改过 / 旧格式）时不能中断布局渲染
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const { x, y } = raw;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

export function writeFabPosition(position: FabPosition | null): void {
  const key = `${responsiveStorageNameSpace()}${STORAGE_KEY}`;
  if (!position) {
    storageLocal().removeItem(key);
    return;
  }
  storageLocal().setItem(key, position);
}
