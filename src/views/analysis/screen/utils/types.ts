/** 译文函数（组合层只需单键取词）：收窄签名便于组合与测试，`useI18n().t` 可直接传入 */
export type TranslateFn = (
  _key: string,
  _named?: Record<string, unknown>
) => string;

/**
 * 插入类操作的统一回执（粘贴 / 就地复制 / 应用模板共用）：
 * `skippedRefs` = 引用不可见被丢弃的窗格数，`truncated` = 超数量上限被截断的窗格数。
 */
export type InsertSummary = {
  inserted: number;
  skippedRefs: number;
  truncated: number;
};
