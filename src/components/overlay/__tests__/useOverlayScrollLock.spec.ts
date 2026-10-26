import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { defineComponent, nextTick, ref } from "vue";

const mocks = vi.hoisted(() => ({
  locked: { value: false },
  layout: null as HTMLElement | null
}));

vi.mock("@/hooks/useScrollLock", () => ({
  useScrollLock: () => mocks.locked
}));

vi.mock("@/utils/dom", () => ({
  getLayoutScrollElement: () => mocks.layout
}));

import { useOverlayScrollLock } from "../useOverlayScrollLock";

const Host = defineComponent({
  props: { visible: { type: Boolean, default: false } },
  setup(props) {
    useOverlayScrollLock(() => props.visible);
    return () => null;
  }
});

describe("useOverlayScrollLock", () => {
  it("声明式可见源：布局滚动容器存在时随可见性加锁/解锁", async () => {
    mocks.layout = document.createElement("div");
    const wrapper = mount(Host, { props: { visible: false } });
    expect(mocks.locked.value).toBe(false);

    await wrapper.setProps({ visible: true });
    await nextTick();
    expect(mocks.locked.value).toBe(true);

    await wrapper.setProps({ visible: false });
    await nextTick();
    expect(mocks.locked.value).toBe(false);
    wrapper.unmount();
  });

  it("无布局滚动容器时不重复锁定（独立页交给 EP body 锁）", async () => {
    mocks.layout = null;
    const wrapper = mount(Host, { props: { visible: true } });
    await nextTick();
    expect(mocks.locked.value).toBe(false);
    await wrapper.setProps({ visible: false });
    wrapper.unmount();
  });

  it("命令式队列：任一弹层可见即锁定", async () => {
    mocks.layout = document.createElement("div");
    mocks.locked.value = false;
    const store = ref<Array<{ visible?: boolean }>>([{ visible: false }]);
    const QueueHost = defineComponent({
      setup() {
        useOverlayScrollLock(store);
        return () => null;
      }
    });
    const wrapper = mount(QueueHost);
    expect(mocks.locked.value).toBe(false);

    store.value[0].visible = true;
    await nextTick();
    expect(mocks.locked.value).toBe(true);

    store.value = [];
    await nextTick();
    expect(mocks.locked.value).toBe(false);
    wrapper.unmount();
  });
});
