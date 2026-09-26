import { describe, expect, beforeEach, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";

import { useNoticeStore } from "../notice";

describe("notice store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("未读计数设置与自增（自 user store 迁入）", () => {
    const store = useNoticeStore();
    store.SET_NOTICECOUNT(2);
    store.INCR_NOTICECOUNT();
    expect(store.noticeCount).toBe(3);
  });

  it("disconnect 幂等：未建连接与关闭后均为 null", () => {
    const store = useNoticeStore();
    store.disconnect();
    expect(store.websocket).toBeNull();
  });
});
