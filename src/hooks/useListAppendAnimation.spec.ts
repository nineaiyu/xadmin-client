import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick, ref } from "vue";
import { describe, expect, it } from "vitest";
import { useListAppendAnimation } from "./useListAppendAnimation";

function mountHost(initial: string[]) {
  const keys = ref<string[]>(initial);
  let isFreshRef: ((key: string) => boolean) | undefined;

  const Host = defineComponent({
    setup() {
      const { isFresh } = useListAppendAnimation(() => keys.value);
      isFreshRef = isFresh;
      return () => h("div");
    }
  });
  mount(Host);

  return {
    keys,
    isFresh: (key: string) => isFreshRef!(key)
  };
}

describe("useListAppendAnimation", () => {
  it("does not mark anything on first render", () => {
    const host = mountHost(["a", "b"]);
    expect(host.isFresh("a")).toBe(false);
    expect(host.isFresh("b")).toBe(false);
  });

  it("marks only the appended keys", async () => {
    const host = mountHost(["a"]);
    host.keys.value = ["a", "b"];
    await nextTick();
    expect(host.isFresh("b")).toBe(true);
    expect(host.isFresh("a")).toBe(false);
  });

  it("does not mark on replace / prepend / delete", async () => {
    const host = mountHost(["a", "b"]);

    host.keys.value = ["c", "d"];
    await nextTick();
    expect(host.isFresh("c")).toBe(false);
    expect(host.isFresh("d")).toBe(false);

    host.keys.value = ["x", "c", "d"];
    await nextTick();
    expect(host.isFresh("x")).toBe(false);

    host.keys.value = ["x", "c"];
    await nextTick();
    expect(host.isFresh("x")).toBe(false);
  });

  it("clears previously marked keys when the next change is not an append", async () => {
    const host = mountHost(["a"]);
    host.keys.value = ["a", "b"];
    await nextTick();
    expect(host.isFresh("b")).toBe(true);

    host.keys.value = ["z"];
    await nextTick();
    expect(host.isFresh("b")).toBe(false);
  });
});
