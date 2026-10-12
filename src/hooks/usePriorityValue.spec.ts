import { mount } from "@vue/test-utils";
import { defineComponent, h, ref, type ComputedRef, type Ref } from "vue";
import { describe, expect, it } from "vitest";

import {
  useForwardPriorityValues,
  usePriorityValue,
  usePriorityValues
} from "./usePriorityValue";

interface ChildProps {
  title: string;
}

function mountChild(options: {
  passed?: Record<string, unknown>;
  slot?: () => unknown;
  state?: Ref<Record<string, unknown>>;
}) {
  let single: ComputedRef<string> | undefined;
  let batch: { [K in keyof ChildProps]: ComputedRef<string> } | undefined;
  let forward: ComputedRef<ChildProps> | undefined;

  const Child = defineComponent({
    props: { title: { type: String, default: "default-title" } },
    setup(props) {
      single = usePriorityValue("title", props, options.state);
      batch = usePriorityValues(props, options.state);
      forward = useForwardPriorityValues(props, options.state);
      return () => h("div");
    }
  });

  mount(Child, {
    props: options.passed,
    slots: options.slot ? { title: options.slot } : undefined
  });

  return {
    get single() {
      return single!;
    },
    get batch() {
      return batch!;
    },
    get forward() {
      return forward!;
    }
  };
}

describe("usePriorityValue 取值优先级", () => {
  it("调用方传入 props 时取 props", () => {
    const { single, batch, forward } = mountChild({
      passed: { title: "from-props" }
    });
    expect(single.value).toBe("from-props");
    expect(batch.title.value).toBe("from-props");
    expect(forward.value.title).toBe("from-props");
  });

  it("props 未传时忽略其默认值（交由 state 兜底）", () => {
    const { single } = mountChild({});
    expect(single.value).toBeUndefined();
  });

  it("props 未传时回落到 state", () => {
    const state = ref<Record<string, unknown>>({ title: "from-state" });
    const { single } = mountChild({ state });
    expect(single.value).toBe("from-state");
  });

  it("props 已传时 state 不覆盖", () => {
    const state = ref<Record<string, unknown>>({ title: "from-state" });
    const { single } = mountChild({ passed: { title: "from-props" }, state });
    expect(single.value).toBe("from-props");
  });

  it("插槽优先级最高，压过 props", () => {
    const { single } = mountChild({
      passed: { title: "from-props" },
      slot: () => "from-slot"
    });
    expect(typeof single.value).toBe("function");
  });
});
