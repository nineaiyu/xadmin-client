import { mount } from "@vue/test-utils";
import { ElPopconfirm } from "element-plus";
import { describe, expect, it, vi } from "vitest";
import { h } from "vue";

const { hasAuthMock } = vi.hoisted(() => ({
  hasAuthMock: vi.fn((code: string) => code !== "denied:Demo")
}));

vi.mock("@/router/utils", () => ({
  hasAuth: (code: string) => hasAuthMock(code)
}));

vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (key: string) => key })
}));

import ReTableAction from "../src/index";
import { checkActionVisible, toOperationRow } from "../src/action-rows";

const alwaysVisible = () => true;

const mountTableAction = (props: Record<string, unknown> = {}) =>
  mount(ReTableAction, { props });

describe("ReTableAction 通用操作列", () => {
  it("渲染主操作按钮文案", () => {
    const wrapper = mountTableAction({
      actions: [
        { text: "编辑", key: "edit" },
        { text: "删除", key: "delete" }
      ]
    });
    const buttons = wrapper.findAll("button");
    expect(buttons).toHaveLength(2);
    expect(buttons[0].text()).toBe("编辑");
    expect(buttons[1].text()).toBe("删除");
  });

  it("danger 操作渲染为危险样式", () => {
    const wrapper = mountTableAction({
      actions: [{ text: "删除", danger: true }]
    });
    expect(wrapper.find("button").classes()).toContain("el-button--danger");
  });

  it("ifShow=false 的操作不渲染", () => {
    const wrapper = mountTableAction({
      actions: [
        { text: "编辑", ifShow: false },
        { text: "查看", ifShow: () => true }
      ]
    });
    const buttons = wrapper.findAll("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0].text()).toBe("查看");
  });

  it("auth 无权限的操作缺省被隐藏", () => {
    const wrapper = mountTableAction({
      actions: [
        { text: "放行", auth: "list:Demo" },
        { text: "拦截", auth: "denied:Demo" }
      ]
    });
    const buttons = wrapper.findAll("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0].text()).toBe("放行");
  });

  it("auth 为数组时任一命中即显示", () => {
    const wrapper = mountTableAction({
      actions: [{ text: "操作", auth: ["denied:Demo", "list:Demo"] }]
    });
    expect(wrapper.findAll("button")).toHaveLength(1);
  });

  it("自定义 hasPermission 覆盖缺省鉴权", () => {
    const wrapper = mountTableAction({
      hasPermission: () => false,
      actions: [{ text: "操作", auth: "list:Demo" }]
    });
    expect(wrapper.findAll("button")).toHaveLength(0);
  });

  it("popConfirm 操作渲染确认框，确认文案经 okText/cancelText 定制", () => {
    const wrapper = mountTableAction({
      actions: [
        {
          text: "删除",
          popConfirm: {
            title: "确定删除？",
            okText: "删除",
            cancelText: "再想想"
          }
        }
      ]
    });
    expect(wrapper.findComponent(ElPopconfirm).exists()).toBe(true);
    const row = toOperationRow(
      { text: "删除", popConfirm: { title: "确定删除？", okText: "删除" } },
      0,
      alwaysVisible
    );
    expect(row.confirm?.title).toBe("确定删除？");
    expect(row.confirm?.props).toMatchObject({ confirmButtonText: "删除" });
  });

  it("popConfirm 缺省标题回落通用提示文案", () => {
    const row = toOperationRow(
      { text: "删除", popConfirm: {} },
      0,
      alwaysVisible,
      "tableAction.confirmTitle"
    );
    expect(row.confirm?.title).toBe("tableAction.confirmTitle");
  });

  it("dropdownActions 非空时渲染「更多」触发器，为空时不渲染", () => {
    const withMore = mountTableAction({
      actions: [{ text: "编辑" }],
      dropdownActions: [{ text: "复制", key: "copy" }]
    });
    const trigger = withMore.find(".re-table-action__more button");
    expect(trigger.exists()).toBe(true);
    expect(trigger.attributes("aria-label")).toBe("layout.more");

    const noMore = mountTableAction({ actions: [{ text: "编辑" }] });
    expect(noMore.find(".re-table-action__more").exists()).toBe(false);
  });

  it("moreText 展示在「更多」按钮上", () => {
    const wrapper = mountTableAction({
      moreText: "更多操作",
      dropdownActions: [{ text: "复制" }]
    });
    expect(wrapper.find(".re-table-action__more button").text()).toBe(
      "更多操作"
    );
  });

  it("点击回调携带 row / item / loading", async () => {
    const onClick = vi.fn();
    const wrapper = mountTableAction({
      row: { pk: 7 },
      actions: [{ text: "编辑", key: "edit", onClick }]
    });
    await wrapper.find("button").trigger("click");
    expect(onClick).toHaveBeenCalledTimes(1);
    const params = onClick.mock.calls[0][0];
    expect(params.row).toEqual({ pk: 7 });
    expect(params.item).toMatchObject({ key: "edit" });
    expect(params.loading).toHaveProperty("value");
  });

  it("divider 在主操作之间渲染分割线", () => {
    const wrapper = mountTableAction({
      divider: true,
      actions: [{ text: "编辑" }, { text: "复制" }]
    });
    expect(wrapper.find(".el-divider").exists()).toBe(true);
  });

  it("icon-only 操作由 tooltip 补可访问名", () => {
    const row = toOperationRow(
      { icon: h("i"), tooltip: "详情" },
      0,
      alwaysVisible
    );
    const rowProps = row.props as Record<string, unknown>;
    expect(rowProps["aria-label"]).toBe("详情");
    expect(row.text).toBeUndefined();
  });

  it("checkActionVisible 组合权限与 ifShow", () => {
    expect(checkActionVisible({ auth: "denied:Demo" }, () => false)).toBe(
      false
    );
    expect(checkActionVisible({ ifShow: false }, alwaysVisible)).toBe(false);
    expect(checkActionVisible({ ifShow: () => true }, alwaysVisible)).toBe(
      true
    );
    expect(checkActionVisible({}, alwaysVisible)).toBe(true);
  });
});
