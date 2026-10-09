import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { defineComponent } from "vue";

vi.mock("vue-i18n", async importOriginal => {
  const actual = await importOriginal<typeof import("vue-i18n")>();
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) };
});
vi.mock("@/router/utils", () => ({ hasAuth: () => true }));
vi.mock("@/api/user/logs", () => ({
  userLoginLogApi: { baseApi: "/api/audit/user/log" }
}));
vi.mock("@/views/system/hooks", () => ({
  usePublicHooks: () => ({ tagStyle: vi.fn(() => ({})) })
}));

import SecurityLog from "./SecurityLog.vue";

/** RePlusPage 替身：捕获列表页收到的 props（搜索区开关是本次缺陷的守护点）。 */
const RePlusPageStub = defineComponent({
  name: "RePlusPage",
  props: [
    "api",
    "auth",
    "operation",
    "selection",
    "fetchSearchFields",
    "pagination",
    "listColumnsFormat",
    "title",
    "localeName"
  ],
  template: "<div class='re-plus-page-stub' />"
});

const mountPanel = () =>
  mount(SecurityLog, {
    global: { stubs: { RePlusPage: RePlusPageStub } }
  });

describe("安全日志（个人登录记录）列表装配", () => {
  it("列表页使用 /api/audit/user/log 前缀", () => {
    const props = mountPanel().findComponent(RePlusPageStub).props();

    expect((props.api as { baseApi: string }).baseApi).toBe(
      "/api/audit/user/log"
    );
  });

  it("未关闭 search-fields（搜索区字段元数据来源，缺失时只有搜索按钮没有搜索框）", () => {
    const props = mountPanel().findComponent(RePlusPageStub).props();

    expect(props.fetchSearchFields).not.toBe(false);
  });

  it("个人日志页无操作列 / 无多选（只读收口）", () => {
    const props = mountPanel().findComponent(RePlusPageStub).props();

    expect(props.operation).toBe(false);
    expect(props.selection).toBe(false);
  });

  it("列文案走 logsLogin 命名空间（与登录日志页共用词条）", () => {
    const props = mountPanel().findComponent(RePlusPageStub).props();

    expect(props.localeName).toBe("logsLogin");
  });
});
