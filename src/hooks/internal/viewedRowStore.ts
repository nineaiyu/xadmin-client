/**
 * 表格已读行的存储与集合逻辑（纯逻辑段，供 useViewedRow 接线；不依赖 Vue）。
 *
 * 三段：存储适配器解析（local/session/memory/custom）、持久化记录解析（脏数据容错）、
 * 集合合并与移除（FIFO 淘汰，无变化返回 null 避免多余响应式更新）、防抖落盘器。
 */

/** 已读行的行类名（RePlusPage 表格样式挂点） */
export const VIEWED_ROW_CLASS = "is-viewed";

/** 持久化记录（keys 尾部最新；savedAt 为最近一次标记时间） */
export type ViewedRowRecord = {
  keys: string[];
  savedAt: number;
};

/** 存储适配器 */
export type ViewedRowAdapter = {
  read: () => string | null;
  write: (raw: string) => void;
};

/** 内置后端名或自定义适配器 */
export type ViewedRowStorage =
  "local" | "session" | "memory" | ViewedRowAdapter;

/** 解析存储后端为适配器（web 后端读写键在 storageKey 上） */
export function resolveViewedRowAdapter(
  storage: ViewedRowStorage | undefined,
  storageKey: string
): ViewedRowAdapter {
  if (storage && typeof storage === "object") return storage;
  if (storage === "memory") {
    let memoryRaw: string | null = null;
    return {
      read: () => memoryRaw,
      write: raw => {
        memoryRaw = raw;
      }
    };
  }
  const web =
    storage === "session" ? window.sessionStorage : window.localStorage;
  return {
    read: () => web.getItem(storageKey),
    write: raw => web.setItem(storageKey, raw)
  };
}

/** 解析持久化记录；缺失 / 脏数据（手改、旧格式）按空处理不抛错 */
export function parseViewedRowRecord(
  raw: string | null
): ViewedRowRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ViewedRowRecord>;
    if (!Array.isArray(parsed.keys)) return null;
    return {
      keys: parsed.keys.map(String),
      savedAt: Number(parsed.savedAt) || 0
    };
  } catch {
    return null;
  }
}

/** 合并已读键并做 FIFO 淘汰（超出 maxSize 从最旧一端删）；无变化返回 null */
export function mergeViewedKeys(
  current: Iterable<string>,
  keys: (string | number)[],
  maxSize: number
): Set<string> | null {
  const next = new Set(current);
  let changed = false;
  for (const key of keys) {
    const normalized = String(key);
    if (!next.has(normalized)) {
      next.add(normalized);
      changed = true;
    }
  }
  if (!changed) return null;
  if (next.size > maxSize) {
    const overflow = next.size - maxSize;
    const iterator = next.values();
    for (let i = 0; i < overflow; i += 1) {
      next.delete(iterator.next().value as string);
    }
  }
  return next;
}

/** 移除指定键；无变化返回 null */
export function removeViewedKeys(
  current: Iterable<string>,
  keys: (string | number)[]
): Set<string> | null {
  const next = new Set(current);
  let changed = false;
  for (const key of keys) {
    if (next.delete(String(key))) changed = true;
  }
  return changed ? next : null;
}

/** el-table `row-class-name` 判定：命中已读返回行类，否则空串 */
export function viewedRowClassName(
  row: Record<string, unknown> | undefined,
  keyField: string,
  isViewed: (key: string) => boolean
): string {
  const key = row?.[keyField];
  if (key === undefined || key === null || key === "") return "";
  return isViewed(String(key)) ? VIEWED_ROW_CLASS : "";
}

/** 防抖落盘器：合并窗口内多次变更；delay=0 立即写；卸载前用 flush 落盘 */
export function createDebouncedPersist(delay: number, write: () => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    schedule() {
      if (!delay) {
        write();
        return;
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        write();
      }, delay);
    },
    flush() {
      if (!timer) return;
      clearTimeout(timer);
      timer = undefined;
      write();
    },
    hasPending: () => timer !== undefined
  };
}
