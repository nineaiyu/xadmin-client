import { shallowRef } from "vue";
import { tryOnScopeDispose } from "@vueuse/core";

import { responsiveStorageNameSpace } from "@/config";
import {
  createDebouncedPersist,
  mergeViewedKeys,
  parseViewedRowRecord,
  removeViewedKeys,
  resolveViewedRowAdapter,
  viewedRowClassName
} from "./viewedRowStore";
import type { ViewedRowStorage } from "./viewedRowStore";

export { VIEWED_ROW_CLASS } from "./viewedRowStore";
export type { ViewedRowStorage } from "./viewedRowStore";

/**
 * 表格「已读行」状态机：列表行被打开过（详情 / 编辑）后标记已读，行上挂
 * `is-viewed` 弱化样式；记录按作用域隔离，默认 local 存储跨刷新保持。
 *
 * 设计口径：FIFO（超出 maxSize 淘汰最旧）；TTL（读取时整批判定，超时清空）；
 * 防抖持久化（默认 300ms，卸载前 flush）；存储解析与集合逻辑见 viewedRowStore.ts。
 */

export type UseViewedRowOptions = {
  /** 作用域（跨页面唯一，建议取接口路径或页面路由；同页多表用不同 scope） */
  scope: string;
  /** 存储后端（默认 local：跨刷新保持） */
  storage?: ViewedRowStorage;
  /** 过期时长 ms（不传则不过期） */
  ttl?: number;
  /** 容量上限（默认 100；超出按标记顺序淘汰最旧） */
  maxSize?: number;
  /** 持久化防抖 ms（默认 300；0 = 立即写入） */
  debounce?: number;
  /** 行键字段（默认 pk，与 RePlusPage 的 row-key 契约一致） */
  keyField?: string;
};

export function useViewedRow(options: UseViewedRowOptions) {
  const storageKey = `${responsiveStorageNameSpace()}viewed-row:${options.scope}`;
  const maxSize = options.maxSize ?? 100;
  const keyField = options.keyField ?? "pk";
  const adapter = resolveViewedRowAdapter(options.storage, storageKey);

  const viewed = shallowRef<Set<string>>(new Set());
  let savedAt = 0;

  const persist = createDebouncedPersist(options.debounce ?? 300, () =>
    adapter.write(JSON.stringify({ keys: [...viewed.value], savedAt }))
  );

  // 初始化：读取 + TTL 判定（过期即清空并落盘）
  const record = parseViewedRowRecord(adapter.read());
  if (record) {
    if (options.ttl && Date.now() - record.savedAt > options.ttl) {
      savedAt = Date.now();
      adapter.write(JSON.stringify({ keys: [], savedAt }));
    } else {
      viewed.value = new Set(record.keys);
      savedAt = record.savedAt;
    }
  }

  // 卸载时把防抖窗口内的变更落盘，避免丢失
  tryOnScopeDispose(() => persist.flush());

  /** 批量标记已读（幂等；FIFO 超限淘汰最旧） */
  function markKeysAsViewed(keys: (string | number)[]) {
    const next = mergeViewedKeys(viewed.value, keys, maxSize);
    if (!next) return;
    viewed.value = next;
    savedAt = Date.now();
    persist.schedule();
  }

  /** 单条标记已读 */
  const markAsViewed = (key: string | number) => markKeysAsViewed([key]);

  /** 是否已读 */
  const isViewed = (key: string | number) => viewed.value.has(String(key));

  /** 清空全部已读记录（立即落盘） */
  function clearViewed() {
    viewed.value = new Set();
    savedAt = Date.now();
    adapter.write(JSON.stringify({ keys: [], savedAt }));
  }

  /** 移除若干已读记录（立即落盘） */
  function removeKeysFn(keys: (string | number)[]) {
    const next = removeViewedKeys(viewed.value, keys);
    if (!next) return;
    viewed.value = next;
    savedAt = Date.now();
    adapter.write(JSON.stringify({ keys: [...next], savedAt }));
  }

  /** 已读键清单（标记顺序，尾部最新） */
  const getViewedKeys = () => [...viewed.value];

  /** el-table `row-class-name` 绑定（判定实现见 viewedRowStore） */
  const getRowClassName = ({ row }: { row: Record<string, unknown> }) =>
    viewedRowClassName(row, keyField, isViewed);

  return {
    viewed,
    markAsViewed,
    markKeysAsViewed,
    isViewed,
    clearViewed,
    removeKeys: removeKeysFn,
    getViewedKeys,
    getRowClassName
  };
}
