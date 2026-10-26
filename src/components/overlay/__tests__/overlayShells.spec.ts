import { flushPromises, mount } from "@vue/test-utils";
import { ElButton, ElDialog, ElDrawer } from "element-plus";
import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, nextTick, ref } from "vue";

import OverlayDialog from "../OverlayDialog.vue";
import OverlayDrawer from "../OverlayDrawer.vue";

const mountOptions = () => ({
  global: { components: { ElDialog, ElDrawer, ElButton } },
  attachTo: document.body
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("OverlayDialog 声明式弹层壳", () => {
  it("渲染标题/内容/页脚并透传 EP 属性", async () => {
    const Host = defineComponent({
      components: { OverlayDialog },
      setup: () => ({ open: ref(true) }),
      template: `
        <OverlayDialog v-model="open" title="预览" width="640px" class="probe">
          <p class="body-slot">弹层内容</p>
          <template #footer><button class="footer-slot">确定</button></template>
        </OverlayDialog>
      `
    });
    const wrapper = mount(Host as never, mountOptions());
    await flushPromises();

    expect(document.body.querySelector(".el-dialog")).toBeTruthy();
    expect(document.body.textContent).toContain("预览");
    expect(document.body.querySelector(".body-slot")?.textContent).toBe(
      "弹层内容"
    );
    expect(document.body.querySelector(".footer-slot")?.textContent).toBe(
      "确定"
    );
    expect(
      document.body.querySelector(".el-dialog")?.classList.contains("probe")
    ).toBe(true);
    wrapper.unmount();
  });

  it("v-model 更新随外壳 emit 回传", async () => {
    const Host = defineComponent({
      components: { OverlayDialog },
      setup: () => ({ open: ref(true) }),
      template: `<OverlayDialog v-model="open" title="标题" />`
    });
    const wrapper = mount(Host as never, mountOptions());
    await flushPromises();

    wrapper.findComponent(OverlayDialog).vm.$emit("update:modelValue", false);
    await nextTick();
    expect(wrapper.findComponent(OverlayDialog).props("modelValue")).toBe(
      false
    );
    wrapper.unmount();
  });
});

describe("OverlayDrawer 声明式弹层壳", () => {
  it("渲染标题/内容/页脚并透传 EP 属性", async () => {
    const Host = defineComponent({
      components: { OverlayDrawer },
      setup: () => ({ open: ref(true) }),
      template: `
        <OverlayDrawer v-model="open" title="面板" size="40%">
          <p class="drawer-body">抽屉内容</p>
          <template #footer><button class="drawer-footer">关闭</button></template>
        </OverlayDrawer>
      `
    });
    const wrapper = mount(Host as never, mountOptions());
    await flushPromises();

    expect(document.body.querySelector(".el-drawer")).toBeTruthy();
    expect(document.body.textContent).toContain("面板");
    expect(document.body.querySelector(".drawer-body")?.textContent).toBe(
      "抽屉内容"
    );
    expect(document.body.querySelector(".drawer-footer")?.textContent).toBe(
      "关闭"
    );
    wrapper.unmount();
  });
});
