import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { defineComponent, reactive } from "vue";

vi.mock("vue-i18n", async importOriginal => {
  const actual = await importOriginal<typeof import("vue-i18n")>();
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) };
});

const userInfo = reactive<Record<string, unknown>>({ posts: [] });

vi.mock("../utils/hook", () => ({
  useUserProfileForm: () => ({
    t: (key: string) => key,
    auth: { upload: true, partialUpdate: true },
    columns: [{ prop: "nickname", label: "userinfo.nickname" }],
    userInfo,
    userinfoStore: { avatar: "" },
    handleUpload: vi.fn(),
    handleUpdate: vi.fn()
  })
}));

import Profile from "./Profile.vue";

const PlusFormStub = defineComponent({
  name: "PlusForm",
  props: ["columns", "rules", "hasFooter", "rowProps", "labelPosition"],
  template: "<div class='plus-form-stub' />"
});

/** 岗位 tag：自定义替身（class 不带 el- 前缀，避免 elementPlus 注册面扫描误报） */
const TagChipStub = defineComponent({
  name: "ElTag",
  template: "<span class='tag-chip' />"
});

const mountPanel = () =>
  mount(Profile, {
    global: {
      stubs: {
        PlusForm: PlusFormStub,
        ElAvatar: true,
        ElButton: true,
        ElPopconfirm: true,
        ElTag: TagChipStub,
        IconifyIconOffline: true,
        "plus-field-avatar": true,
        "plus-field-operation": true
      }
    }
  });

describe("个人信息页签", () => {
  it("渲染标题并把列定义交给表单", () => {
    const wrapper = mountPanel();

    expect(wrapper.find("h3").text()).toBe("account.profile");
    const form = wrapper.findComponent(PlusFormStub);
    expect(form.props("columns")).toEqual([
      { prop: "nickname", label: "userinfo.nickname" }
    ]);
    expect(form.props("labelPosition")).toBe("top");
  });

  it("岗位为只读回显：有值时按 tag 列表渲染", async () => {
    userInfo.posts = ["研发工程师", "运维值班"];
    const wrapper = mountPanel();
    await wrapper.vm.$nextTick();

    expect(wrapper.findAll(".tag-chip").length).toBe(2);
    expect(wrapper.text()).toContain("userinfo.posts");
  });

  it("岗位为空时不渲染岗位区块", () => {
    userInfo.posts = [];
    const wrapper = mountPanel();

    expect(wrapper.findAll(".tag-chip").length).toBe(0);
  });
});
