import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));

import RePermissionPreviewShell from "../src/PreviewShell.vue";
import PreviewNotes from "../src/PreviewNotes.vue";

/** v-loading 指令桩：测试不关心遮罩，仅避免未注册指令告警 */
// eslint-disable-next-line @typescript-eslint/no-empty-function
const loadingDirective = { mounted() {}, updated() {} };

const ReEmptyStub = {
  name: "ReEmpty",
  props: { description: { type: String, default: "" } },
  template: '<div class="empty-stub" :data-desc="description" />'
};

function mountShell(data: unknown) {
  return mount(RePermissionPreviewShell, {
    props: { loading: false, data },
    slots: { default: '<div class="content">内容</div>' },
    global: {
      directives: { loading: loadingDirective },
      stubs: { ReEmpty: ReEmptyStub }
    }
  });
}

describe("RePermissionPreviewShell", () => {
  it("data 存在时渲染插槽、不渲染空态", () => {
    const wrapper = mountShell({ ok: true });
    expect(wrapper.find(".content").exists()).toBe(true);
    expect(wrapper.find(".empty-stub").exists()).toBe(false);
  });

  it("data 为空时渲染失败空态并不渲染插槽", () => {
    const wrapper = mountShell(null);
    expect(wrapper.find(".content").exists()).toBe(false);
    expect(wrapper.find(".empty-stub").attributes("data-desc")).toBe(
      "permissionPreview.loadFailed"
    );
  });
});

describe("PreviewNotes", () => {
  it("逐条渲染说明条目（标题 + info 类型）", () => {
    const wrapper = mount(PreviewNotes, {
      props: { notes: ["第一条", "第二条"] },
      global: {
        stubs: {
          "el-alert": {
            name: "ElAlert",
            props: { title: { type: String, default: "" }, type: String },
            template:
              '<div class="alert-stub" :data-title="title" :data-type="type" />'
          }
        }
      }
    });

    const alerts = wrapper.findAll(".alert-stub");
    expect(alerts).toHaveLength(2);
    expect(alerts[0].attributes("data-title")).toBe("第一条");
    expect(alerts[0].attributes("data-type")).toBe("info");
    expect(alerts[1].attributes("data-title")).toBe("第二条");
  });
});
