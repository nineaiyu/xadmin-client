import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";

const mocks = vi.hoisted(() => ({ message: vi.fn() }));
vi.mock("@/utils/message", () => ({ message: mocks.message }));

import MemberTagEditor from "../MemberTagEditor.vue";
import type { MemberTagOption } from "../memberTag";

/** MemberTagEditor 的 props 形态（测试侧显式声明，替代宽泛的 Record） */
type EditorProps = {
  members: MemberTagOption[];
  hint: string;
  emptyText: string;
  noChangeText: string;
  readonly?: boolean;
  loading?: boolean;
  placeholder?: string;
  testid?: string;
  search: (keyword: string) => Promise<MemberTagOption[]>;
};

const ElTagStub = {
  name: "ElTag",
  props: { closable: { type: Boolean, default: false } },
  emits: ["close"],
  template: '<span class="tag-stub"><slot /></span>'
};

const ElSelectStub = {
  name: "ElSelect",
  props: ["modelValue", "placeholder", "loading", "remoteMethod"],
  emits: ["update:modelValue"],
  template: '<div class="select-stub"><slot /></div>'
};

const ElOptionStub = {
  name: "ElOption",
  props: ["label", "value"],
  template: "<div />"
};

// eslint-disable-next-line @typescript-eslint/no-empty-function
const loadingDirective = { mounted() {}, updated() {} };

function mountEditor(props: EditorProps) {
  return mount(MemberTagEditor, {
    props,
    global: {
      directives: { loading: loadingDirective },
      stubs: {
        "el-tag": ElTagStub,
        "el-select": ElSelectStub,
        "el-option": ElOptionStub
      }
    }
  });
}

const baseProps = {
  members: [{ pk: 1, username: "alice", nickname: "Alice" }],
  hint: "hint",
  emptyText: "empty",
  noChangeText: "nochange",
  search: async () => []
};

const getPayload = (wrapper: ReturnType<typeof mountEditor>) =>
  wrapper.vm.getPayload();

describe("MemberTagEditor", () => {
  it("无变更时提示 noChangeText 并返回 null", () => {
    const wrapper = mountEditor(baseProps);
    expect(getPayload(wrapper)).toBeNull();
    expect(mocks.message).toHaveBeenCalledWith("nochange", { type: "warning" });
  });

  it("只读模式恒返回 null 且不提示", () => {
    const wrapper = mountEditor({ ...baseProps, readonly: true });
    expect(getPayload(wrapper)).toBeNull();
    expect(mocks.message).not.toHaveBeenCalled();
  });

  it("新增与移除生成 {add, remove} 增量载荷", async () => {
    const wrapper = mountEditor(baseProps);
    wrapper
      .findComponent(ElSelectStub)
      .vm.$emit("update:modelValue", [{ pk: 2, username: "bob" }]);
    await nextTick();
    wrapper.findComponent(ElTagStub).vm.$emit("close");
    await nextTick();

    expect(getPayload(wrapper)).toEqual({ add: [2], remove: [1] });
    expect(mocks.message).not.toHaveBeenCalled();
  });
});
