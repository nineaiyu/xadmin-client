import { effectScope, nextTick, ref } from "vue";
import { describe, expect, it, vi } from "vitest";

import { bindMessageWindow } from "../messageWindow";

type Row = { id: number };

/** 每行固定高度（用条数推导 scrollHeight，模拟 DOM 增长/裁剪） */
const ROW_HEIGHT = 20;
const CLIENT_HEIGHT = 100;

function setup(limit: number, options: { loadingMore?: boolean } = {}) {
  const messages = ref<Row[]>([]);
  const loadingMore = ref(options.loadingMore ?? false);
  const scrollToBottom = vi.fn();
  const container = {
    clientHeight: CLIENT_HEIGHT,
    scrollTop: 0,
    get scrollHeight() {
      return messages.value.length * ROW_HEIGHT;
    }
  } as unknown as HTMLElement;
  const scroller = ref<HTMLElement | null>(container);
  const scope = effectScope();
  scope.run(() =>
    bindMessageWindow(
      { messages, scroller, loadingMore, scrollToBottom },
      limit
    )
  );
  /** 灌入消息并等待裁剪与滚动补偿完成 */
  const feed = async (count: number, top: number) => {
    messages.value = Array.from({ length: count }, (_, index) => ({
      id: index
    }));
    container.scrollTop = top;
    await nextTick();
    await nextTick();
  };
  return { messages, scrollToBottom, container, scope, feed };
}

describe("bindMessageWindow 消息窗口裁剪", () => {
  it("贴底时裁剪到窗口上限，并继续跟随最新消息", async () => {
    const { messages, scrollToBottom, feed } = setup(10);
    // 12 行 = 240px，视口 100px：贴底位置 140
    await feed(12, 140);

    expect(messages.value).toHaveLength(10);
    expect(messages.value[0]).toEqual({ id: 2 });
    expect(scrollToBottom).toHaveBeenCalledTimes(1);
  });

  it("非贴底时按裁剪高度差补偿 scrollTop，视觉位置不动", async () => {
    const { messages, container, scrollToBottom, feed } = setup(30);
    // 32 行 = 640px，视口 100px；离底 400px，属非贴底
    await feed(32, 100);

    expect(messages.value).toHaveLength(30);
    expect(messages.value[0]).toEqual({ id: 2 });
    // 裁掉 2 行（40px）：scrollTop 同步回退 40
    expect(container.scrollTop).toBe(60);
    expect(scrollToBottom).not.toHaveBeenCalled();
  });

  it("上翻加载中不裁剪（旧页前插后视觉位置保持）", async () => {
    const { messages, feed } = setup(30, { loadingMore: true });
    await feed(40, 100);

    expect(messages.value).toHaveLength(40);
  });

  it("未超限不动消息数组", async () => {
    const { messages, feed } = setup(30);
    await feed(10, 10);

    expect(messages.value).toHaveLength(10);
  });
});
