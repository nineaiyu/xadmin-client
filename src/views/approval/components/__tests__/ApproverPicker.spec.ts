import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent } from "vue";
import { enableAutoUnmount, mount } from "@vue/test-utils";

vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (key: string) => key })
}));

vi.mock("@/components/SearchPicker", async () => {
  const { defineComponent } = await import("vue");
  return {
    default: defineComponent({
      name: "SearchPicker",
      props: { modelValue: { type: null, default: undefined } },
      template: '<div class="search-picker-stub" />'
    })
  };
});

vi.mock("@/views/approval/utils/useAssigneeCandidates", async () => {
  const { ref } = await import("vue");
  return {
    useAssigneeCandidates: () => {
      const userOptions = ref([{ username: "alice", label: "Alice(alice)" }]);
      const roleOptions = ref([{ code: "admin", name: "Admin" }]);
      const postOptions = ref([{ code: "dev", name: "Developer" }]);
      const ensureUserOption = (username: string) => {
        if (!userOptions.value.some(item => item.username === username)) {
          userOptions.value.push({ username, label: username });
        }
      };
      return {
        userOptions,
        userLoading: ref(false),
        candidateTruncated: ref(true),
        roleOptions,
        postOptions,
        searchUsers: vi.fn(),
        ensureUserOption
      };
    }
  };
});

import ApproverPicker from "../ApproverPicker.vue";

enableAutoUnmount(afterEach);

const ElSelectStub = defineComponent({
  name: "ElSelect",
  props: {
    modelValue: { type: null, default: undefined },
    multiple: { type: Boolean, default: false },
    size: { type: String, default: "" }
  },
  emits: ["update:modelValue", "focus"],
  template:
    '<div class="select-stub" :data-multiple="String(multiple)" :data-size="size"><slot /></div>'
});

const ElOptionStub = defineComponent({
  name: "ElOption",
  props: {
    label: { type: String, default: "" },
    value: { type: [String, Number], default: "" }
  },
  template: '<span class="option-stub">{{ label }}</span>'
});

const ElAlertStub = defineComponent({
  name: "ElAlert",
  props: { title: { type: String, default: "" } },
  template: '<div class="alert-stub">{{ title }}</div>'
});

/** 每个用例用独立 fetcher，避免共享候选登记表在用例间串数据 */
const mountPicker = (props: Record<string, unknown>) =>
  mount(ApproverPicker, {
    props: {
      ...props,
      fetcher: () => Promise.resolve({ code: 1000, data: {} })
    } as never,
    global: {
      stubs: {
        "el-select": ElSelectStub,
        "el-option": ElOptionStub,
        "el-alert": ElAlertStub
      }
    }
  });

const optionTexts = (wrapper: ReturnType<typeof mountPicker>) =>
  wrapper.findAll(".option-stub").map(item => item.text());

describe("ApproverPicker", () => {
  it("type=user：远程搜索候选 + 已选用户回显", () => {
    const wrapper = mountPicker({
      modelValue: "alice,bob",
      type: "user"
    });
    expect(optionTexts(wrapper)).toContain("Alice(alice)");
    // 已选但不在候选目录里的用户名自动并入选项（回显）
    expect(optionTexts(wrapper)).toContain("bob");
    expect(wrapper.find(".select-stub").attributes("data-size")).toBe("small");
  });

  it("切换 type：角色候选按名称展示，showCode 时附带 code", async () => {
    const wrapper = mountPicker({ modelValue: "", type: "user" });
    await wrapper.setProps({ type: "role", modelValue: "admin" });
    expect(optionTexts(wrapper)).toEqual(["Admin"]);
    await wrapper.setProps({ showCode: true });
    expect(optionTexts(wrapper)).toEqual(["Admin(admin)"]);
    await wrapper.setProps({ type: "post", modelValue: "dev" });
    expect(optionTexts(wrapper)).toEqual(["Developer(dev)"]);
  });

  it("multiple：多选与单选分别透传", async () => {
    const wrapper = mountPicker({
      modelValue: "",
      type: "role",
      multiple: true
    });
    expect(wrapper.find(".select-stub").attributes("data-multiple")).toBe(
      "true"
    );
    await wrapper.setProps({ multiple: false });
    expect(wrapper.find(".select-stub").attributes("data-multiple")).toBe(
      "false"
    );
  });

  it("truncatedHint：候选目录被截断时展示提示", () => {
    const wrapper = mountPicker({
      modelValue: "",
      type: "role",
      truncatedHint: true
    });
    expect(wrapper.find(".alert-stub").text()).toBe(
      "approval.candidateTruncated"
    );
  });
});
