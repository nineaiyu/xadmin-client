import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, ref, type Ref } from "vue";

import { useDashboardAutoRefresh } from "./useDashboardAutoRefresh";

function mountAutoRefresh(options: {
  kiosk: boolean;
  requestedSeconds?: unknown;
}) {
  const kiosk = ref(options.kiosk);
  const refresh = vi.fn();
  let seconds: Ref<number>;
  const Harness = defineComponent({
    setup() {
      ({ seconds } = useDashboardAutoRefresh({
        kiosk,
        requestedSeconds: options.requestedSeconds,
        refresh
      }));
      return () => null;
    }
  });
  const wrapper = mount(Harness);
  return { wrapper, refresh, seconds: seconds! };
}

describe("useDashboardAutoRefresh 挂屏自动刷新", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("普通模式默认关闭", () => {
    const { seconds } = mountAutoRefresh({ kiosk: false });
    expect(seconds.value).toBe(0);
  });

  it("kiosk 模式默认 60s 并按档位触发刷新", async () => {
    const { refresh, seconds } = mountAutoRefresh({ kiosk: true });
    expect(seconds.value).toBe(60);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(refresh).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("kiosk 模式接受地址栏档位覆盖，非法档位回落 60s", () => {
    expect(
      mountAutoRefresh({ kiosk: true, requestedSeconds: "30" }).seconds.value
    ).toBe(30);
    expect(
      mountAutoRefresh({ kiosk: true, requestedSeconds: "999" }).seconds.value
    ).toBe(60);
  });

  it("卸载后停止定时器", async () => {
    const { wrapper, refresh } = mountAutoRefresh({ kiosk: true });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(refresh).toHaveBeenCalledTimes(1);

    wrapper.unmount();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
