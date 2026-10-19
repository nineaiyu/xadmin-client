import {
  FREE_GRID_DEFAULT_STEP,
  FREE_GRID_STEPS,
  type FreeGridSnap
} from "./freeSnap";
import { readScreenStorage, writeScreenStorage } from "./screenStorage";

/**
 * 元素级网格吸附的本地偏好（拆分动机：编辑域组合层行数门禁）。
 *
 * 选择记忆在浏览器侧（换会话仍然生效）：非法 / 缺失一律回落缺省（关闭 + 8px），
 * 与服务端无关——网格只是编辑体验，不进载荷。
 */
const GRID_SNAP_KEY = "free-grid-snap";

/** 读取网格吸附偏好（缺省：关闭 + 8px） */
export function readGridSnap(): FreeGridSnap {
  const raw = readScreenStorage<FreeGridSnap>(GRID_SNAP_KEY);
  return {
    enabled: Boolean(raw?.enabled),
    step: FREE_GRID_STEPS.includes(Number(raw?.step))
      ? Number(raw?.step)
      : FREE_GRID_DEFAULT_STEP
  };
}

/** 写入网格吸附偏好（步长只接受档位内的值） */
export function writeGridSnap(value: FreeGridSnap): void {
  writeScreenStorage(GRID_SNAP_KEY, value);
}
