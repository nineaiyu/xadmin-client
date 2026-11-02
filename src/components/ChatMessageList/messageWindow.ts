import { nextTick, watch, type Ref } from "vue";

/**
 * 消息列表的窗口裁剪（聊天室 / 助手页共用）。
 *
 * 长会话连续上翻或持续收到新消息时，消息数组会线性增长，导致消息行
 * （Markdown / 代码高亮 / 图片）全部常驻 DOM、流式增量触发的整列 patch 越来越重。
 * 这里在数据层保留最近 `limit` 条：超出后从最旧端丢弃，并按裁剪前后的
 * 内容高度差补偿 `scrollTop`，保证用户当前看到的位置不跳变；贴底时继续跟随最新消息。
 */
export const MESSAGE_WINDOW_LIMIT = 300;

/** 距底部该像素内视为「跟随最新消息」（与滚动到底的判定同量级） */
const FOLLOW_BOTTOM_GAP = 48;

export interface MessageWindowContext<T> {
  messages: Ref<T[]>;
  scroller: Ref<HTMLElement | null>;
  loadingMore: Ref<boolean>;
  scrollToBottom: () => void;
}

export function bindMessageWindow<T>(
  { messages, scroller, loadingMore, scrollToBottom }: MessageWindowContext<T>,
  limit = MESSAGE_WINDOW_LIMIT
): void {
  watch(
    () => messages.value.length,
    length => {
      // 上翻加载中不裁剪：旧页刚前插，裁掉会让视觉位置与游标都跳动
      if (length <= limit || loadingMore.value) return;
      const container = scroller.value;
      const previousHeight = container?.scrollHeight ?? 0;
      const previousTop = container?.scrollTop ?? 0;
      const followLatest = container
        ? container.scrollHeight -
            container.scrollTop -
            container.clientHeight <=
          FOLLOW_BOTTOM_GAP
        : true;
      messages.value = messages.value.slice(length - limit);
      void nextTick(() => {
        if (!container) return;
        if (followLatest) {
          scrollToBottom();
          return;
        }
        // 裁掉的是视口上方内容：把消失的高度从 scrollTop 里扣回
        const removed = previousHeight - container.scrollHeight;
        if (removed > 0) {
          container.scrollTop = Math.max(0, previousTop - removed);
        }
      });
    }
  );
}
