import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ overview: vi.fn() }));

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/plugins/i18n", () => ({
  i18n: { global: { t: (key: string) => key } },
  $t: (key: string) => key,
  transformI18n: (key: string) => key
}));
vi.mock("@/router/utils", () => ({ hasAuth: () => true }));
vi.mock("@/api/system/credential", () => ({
  credentialApi: { overview: api.overview }
}));

import CredentialPage from "./index.vue";

const stubs = {
  CredentialTable: { name: "CredentialTable", template: "<div />" },
  ReEmpty: {
    name: "ReEmpty",
    props: ["description", "hint"],
    template:
      "<div class='empty-stub'>{{ description }}|{{ hint }}<slot /></div>"
  },
  "el-alert": { template: "<div />" },
  "el-card": { template: "<div><slot /><slot name='header' /></div>" },
  "el-button": {
    emits: ["click"],
    template: "<button @click=\"$emit('click')\"><slot /></button>"
  }
};

describe("凭据页加载失败", () => {
  it("overview 异常时渲染可重试空态，不吞成空白页", async () => {
    api.overview.mockRejectedValue({ detail: "network down" });
    const wrapper = mount(CredentialPage, {
      global: { stubs, directives: { loading: {} } }
    });
    await flushPromises();

    expect(wrapper.find(".empty-stub").text()).toContain(
      "credential.loadFailed"
    );
    expect(wrapper.find(".empty-stub").text()).toContain("network down");
    expect(wrapper.text()).toContain("credential.retry");
  });
});
