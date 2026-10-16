import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { mount } from "@vue/test-utils";
import { useCountdownCooldown } from "./useCountdownCooldown";

/** 组合式函数需要组件上下文（onBeforeUnmount），用最小宿主承载 */
function mountHost() {
  let api!: ReturnType<typeof useCountdownCooldown>;
  const Host = defineComponent({
    setup() {
      api = useCountdownCooldown();
      return () => h("div");
    }
  });
  const wrapper = mount(Host);
  return { api, wrapper };
}

describe("useCountdownCooldown", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("start 从指定秒数起每秒递减，归零后停止", () => {
    const { api } = mountHost();
    expect(api.cooldown.value).toBe(0);

    api.start(3);
    expect(api.cooldown.value).toBe(3);

    vi.advanceTimersByTime(1000);
    expect(api.cooldown.value).toBe(2);
    vi.advanceTimersByTime(1000);
    expect(api.cooldown.value).toBe(1);
    vi.advanceTimersByTime(1000);
    expect(api.cooldown.value).toBe(0);

    // 归零后计时器已清理，继续推进不会变负
    vi.advanceTimersByTime(5000);
    expect(api.cooldown.value).toBe(0);
  });

  it("重复 start 重置计时器（重新发送即重新计时）", () => {
    const { api } = mountHost();
    api.start(60);
    vi.advanceTimersByTime(3000);
    expect(api.cooldown.value).toBe(57);

    api.start(60);
    expect(api.cooldown.value).toBe(60);
    vi.advanceTimersByTime(1000);
    expect(api.cooldown.value).toBe(59);
  });

  it("组件卸载后计时器停止，不再改动冷却值", () => {
    const { api, wrapper } = mountHost();
    api.start(60);
    vi.advanceTimersByTime(2000);
    expect(api.cooldown.value).toBe(58);

    wrapper.unmount();
    vi.advanceTimersByTime(5000);
    expect(api.cooldown.value).toBe(58);
  });
});
