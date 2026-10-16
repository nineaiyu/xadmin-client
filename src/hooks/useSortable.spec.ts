import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, nextTick, ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface MockSortableOptions {
  animation?: number;
  handle?: string;
  onStart?: (evt: unknown) => void;
  onEnd?: (evt: unknown) => void;
  onUpdate?: (evt: unknown) => void;
}

const { createMock, destroyMock } = vi.hoisted(() => {
  const destroyMock = vi.fn();
  const createMock = vi.fn(
    (_el: HTMLElement, _options: MockSortableOptions) => ({
      destroy: destroyMock
    })
  );
  return { createMock, destroyMock };
});

vi.mock("sortablejs", () => ({ default: { create: createMock } }));

import { useSortable, type UseSortableOptions } from "./useSortable";

/** 挂载一个带目标元素的宿主组件，返回 hook 句柄 */
function mountHost(
  options: UseSortableOptions = {},
  targetGetter?: () => HTMLElement | null | undefined
) {
  const hostRef = ref<HTMLElement>();
  let api: ReturnType<typeof useSortable> | undefined;
  const host = defineComponent({
    setup() {
      api = useSortable(targetGetter ?? (() => hostRef.value), options);
      return () => h("ul", { ref: hostRef });
    }
  });
  const wrapper = mount(host);
  return {
    wrapper,
    get api() {
      return api!;
    }
  };
}

describe("useSortable 通用拖拽 hook", () => {
  beforeEach(() => {
    createMock.mockImplementation(() => ({ destroy: destroyMock }));
  });

  it("目标元素就绪后按选项初始化（sortablejs 动态加载）", async () => {
    const { wrapper } = mountHost({ animation: 150, handle: ".drag" });
    await nextTick();
    await flushPromises();

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock.mock.calls[0][0]).toBe(wrapper.element);
    expect(createMock.mock.calls[0][1]).toMatchObject({
      animation: 150,
      handle: ".drag"
    });
  });

  it("目标为空时不初始化", async () => {
    mountHost({}, () => null);
    await nextTick();
    await flushPromises();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("重复 init 不会重复创建实例", async () => {
    const { api } = mountHost();
    await nextTick();
    await flushPromises();
    await api.init();
    await api.init();
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("组件卸载自动销毁实例", async () => {
    const { wrapper } = mountHost();
    await nextTick();
    await flushPromises();
    wrapper.unmount();
    expect(destroyMock).toHaveBeenCalledTimes(1);
  });

  it("destroy 后可重新 init", async () => {
    const { api } = mountHost();
    await nextTick();
    await flushPromises();
    api.destroy();
    expect(destroyMock).toHaveBeenCalledTimes(1);
    await api.init();
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  it("onEnd 回调载荷抽出 oldIndex / newIndex 并透传原始事件", async () => {
    const onEnd = vi.fn();
    mountHost({ onEnd });
    await nextTick();
    await flushPromises();

    const passedOptions = createMock.mock.calls[0][1];
    const evt = { oldIndex: 1, newIndex: 3, item: {} };
    passedOptions.onEnd?.(evt);
    expect(onEnd).toHaveBeenCalledWith({ oldIndex: 1, newIndex: 3, evt });
  });

  it("未提供的回调不注入（create 选项中为 undefined）", async () => {
    mountHost({ animation: 100 });
    await nextTick();
    await flushPromises();
    const passedOptions = createMock.mock.calls[0][1];
    expect(passedOptions.onStart).toBeUndefined();
    expect(passedOptions.onUpdate).toBeUndefined();
  });
});
