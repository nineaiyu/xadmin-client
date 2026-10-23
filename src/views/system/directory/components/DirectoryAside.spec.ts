import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/router/utils", () => ({ hasAuth: () => false }));
vi.mock("@/api/system/search", () => ({
  searchDeptApi: { list: vi.fn() },
  searchPostApi: { list: vi.fn() }
}));
vi.mock("@/utils/fetchAllRows", () => ({ fetchAllRows: vi.fn() }));
vi.mock("@/utils/message", () => ({ message: vi.fn() }));

import DirectoryAside from "./DirectoryAside.vue";

const stubs = {
  "el-radio-group": { template: "<div><slot /></div>" },
  "el-radio-button": { template: "<div><slot /></div>" },
  "el-input": { template: "<div />" },
  "el-button": { template: "<button><slot /></button>" },
  "el-icon": { template: "<span><slot /></span>" },
  "el-divider": { template: "<div />" },
  "el-scrollbar": { template: "<div><slot /></div>" },
  "el-tree": { template: "<div />" },
  "el-empty": {
    props: ["description"],
    template: "<div class='empty-stub'>{{ description }}</div>"
  },
  IconifyIconOffline: { template: "<i />" }
};

const mountAside = (mode: "dept" | "post") =>
  mount(DirectoryAside, {
    props: {
      mode,
      dept: "",
      post: "",
      "onUpdate:mode": vi.fn(),
      "onUpdate:dept": vi.fn(),
      "onUpdate:post": vi.fn()
    },
    global: { stubs, directives: { loading: {} } }
  });

describe("通讯录左栏权限空态", () => {
  it("无部门搜索权限：给出可读说明，不显示普通空数据文案", () => {
    const wrapper = mountAside("dept");
    expect(wrapper.find(".empty-stub").text()).toBe(
      "directory.noDeptPermission"
    );
  });

  it("无岗位搜索权限：给出可读说明", () => {
    const wrapper = mountAside("post");
    expect(wrapper.find(".empty-stub").text()).toBe(
      "directory.noPostPermission"
    );
  });
});
