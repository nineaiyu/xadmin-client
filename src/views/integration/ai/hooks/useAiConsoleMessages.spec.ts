import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";

import type { AiConsoleFeature, AiConsoleMessage } from "@/api/ai/ai";
import { TIME_GROUP_GAP, formatTimeDivider } from "@/utils/timeGroups";

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));

import { toIncoming, useAiConsoleMessages } from "./useAiConsoleMessages";

/** 助手消息样本（服务端持久化契约） */
const consoleMessage = (
  overrides: Partial<AiConsoleMessage>
): AiConsoleMessage =>
  ({
    id: 1,
    feature: "docs",
    role: "assistant",
    content: "回答",
    reasoning: "",
    extra: {},
    created_time: "2026-10-02T10:00:00Z",
    ...overrides
  }) as AiConsoleMessage;

function build(isAtBottom = true) {
  const feature = ref<AiConsoleFeature>("docs");
  const atBottom = ref(isAtBottom);
  const pendingCount = ref(0);
  const scrollToBottom = vi.fn();
  const store = useAiConsoleMessages({
    feature,
    atBottom,
    pendingCount,
    scrollToBottom
  });
  return { feature, atBottom, pendingCount, scrollToBottom, ...store };
}

describe("useAiConsoleMessages 消息集合写入口径", () => {
  it("pushOptimistic 以负 id 追加 user 占位，feature 随当前入口", () => {
    const store = build();
    store.pushOptimistic("近 7 天登录数");

    expect(store.messages.value).toHaveLength(1);
    const optimistic = store.messages.value[0];
    expect(optimistic.id).toBeLessThan(0);
    expect(optimistic).toMatchObject({
      feature: "docs",
      role: "user",
      content: "近 7 天登录数"
    });
    // created_time 为可解析的本地生成时刻
    expect(Number.isNaN(new Date(optimistic.created_time).getTime())).toBe(
      false
    );
  });

  it("upsert 按 id 对齐原位覆盖，不追加重复行", () => {
    const store = build();
    store.upsertMessage(consoleMessage({ id: 7, content: "旧答案" }));
    store.upsertMessage(consoleMessage({ id: 7, content: "新答案" }));

    expect(store.messages.value).toHaveLength(1);
    expect(store.messages.value[0].content).toBe("新答案");
  });

  it("upsert 按「同角色 + 同内容」把负 id 乐观占位对齐为服务端正式载荷", () => {
    const store = build();
    store.pushOptimistic("帮我查数");
    const optimisticId = store.messages.value[0].id;

    // 服务端落库回执（新 id + 正式字段）与占位同角色同内容
    store.upsertMessage(
      consoleMessage({
        id: 42,
        role: "user",
        content: "帮我查数",
        feature: "nl"
      })
    );

    expect(store.messages.value).toHaveLength(1);
    expect(store.messages.value[0]).toMatchObject({ id: 42, role: "user" });
    expect(store.messages.value[0].id).not.toBe(optimisticId);
    // 对齐替换属于覆盖而非新消息：不触发滚动与新消息计数
    expect(store.scrollToBottom).not.toHaveBeenCalled();
    expect(store.pendingCount.value).toBe(0);
  });

  it("upsert 全新消息追加：贴底跟随滚动，离底改为累计新消息数", () => {
    const atBottomStore = build(true);
    atBottomStore.upsertMessage(consoleMessage({ id: 7 }));
    expect(atBottomStore.messages.value).toHaveLength(1);
    expect(atBottomStore.scrollToBottom).toHaveBeenCalledTimes(1);
    expect(atBottomStore.pendingCount.value).toBe(0);

    const awayStore = build(false);
    awayStore.upsertMessage(consoleMessage({ id: 8 }));
    awayStore.upsertMessage(consoleMessage({ id: 9 }));
    expect(awayStore.scrollToBottom).not.toHaveBeenCalled();
    expect(awayStore.pendingCount.value).toBe(2);
  });

  it("removeOptimistic 只移除负 id 的 user 占位，服务端同内容消息不受影响", () => {
    const store = build();
    store.upsertMessage(
      consoleMessage({ id: 7, role: "user", content: "重复内容" })
    );
    store.pushOptimistic("重复内容");
    expect(store.messages.value).toHaveLength(2);

    store.removeOptimistic("重复内容");

    expect(store.messages.value).toHaveLength(1);
    expect(store.messages.value[0]).toMatchObject({ id: 7, role: "user" });
  });

  it("messageGroups 按时间阈值插入分隔行，消息行保留原顺序与原对象", () => {
    const store = build();
    const now = Date.now();
    const first = consoleMessage({
      id: 11,
      content: "早",
      created_time: new Date(now - TIME_GROUP_GAP - 60_000).toISOString()
    });
    const second = consoleMessage({
      id: 12,
      content: "晚",
      created_time: new Date(now).toISOString()
    });
    store.messages.value = [first, second];

    const rows = store.messageGroups.value;
    expect(rows.map(row => row.type)).toEqual([
      "divider",
      "message",
      "divider",
      "message"
    ]);
    expect(rows.map(row => row.key)).toEqual(["d-11", "m-11", "d-12", "m-12"]);
    // 消息行按原顺序映射原消息（ref 深层代理后结构一致）
    expect(
      rows
        .filter(row => row.type === "message")
        .map(row => (row.type === "message" ? row.item : null))
    ).toEqual([first, second]);
    // 分隔标签沿用公共口径（今日消息为 HH:mm）
    const divider = rows[0];
    expect(
      divider.type === "divider" &&
        divider.label ===
          formatTimeDivider(new Date(first.created_time).getTime(), "昨天")
    ).toBe(true);
  });

  it("messageGroups 间隔小于阈值的消息共享同一分隔行", () => {
    const store = build();
    const now = Date.now();
    store.messages.value = [
      consoleMessage({ id: 1, created_time: new Date(now).toISOString() }),
      consoleMessage({
        id: 2,
        created_time: new Date(now + 60_000).toISOString()
      })
    ];
    expect(store.messageGroups.value.map(row => row.type)).toEqual([
      "divider",
      "message",
      "message"
    ]);
  });

  it("toIncoming 校验服务端载荷：缺角色或内容非字符串判为无效", () => {
    const row = consoleMessage({});
    expect(toIncoming(row)).toBe(row);
    expect(toIncoming({ content: "有内容没角色" })).toBeNull();
    expect(toIncoming(consoleMessage({ content: 1 as never }))).toBeNull();
    expect(toIncoming(undefined)).toBeNull();
  });
});
