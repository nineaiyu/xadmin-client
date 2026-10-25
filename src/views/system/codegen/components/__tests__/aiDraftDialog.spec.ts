import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import {
  ElAlert,
  ElButton,
  ElCheckbox,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElTable,
  ElTableColumn
} from "element-plus";

const api = vi.hoisted(() => ({ aiDraft: vi.fn() }));
vi.mock("@/api/system/codegen", () => ({
  systemCodeGenApi: { aiDraft: (payload: unknown) => api.aiDraft(payload) }
}));
vi.mock("vue-i18n", () => ({
  useI18n: () => ({
    t: (key: string, args?: Record<string, unknown>) =>
      args ? `${key}:${JSON.stringify(args)}` : key
  })
}));
vi.mock("@/utils/message", () => ({
  message: vi.fn()
}));

import AiDraftDialog from "../AiDraftDialog.vue";

const draftResult = {
  model: "demo.Book",
  summary: "草案就绪",
  warnings: ["status: unknown dict code x dropped"],
  fields: [
    { name: "name", label: "书名", required: true },
    { name: "author", input_type: "api-search-user" }
  ]
};

const mountDialog = async () => {
  const wrapper = mount(AiDraftDialog, {
    props: { model: "demo.Book" },
    global: {
      components: {
        ElAlert,
        ElButton,
        ElCheckbox,
        ElDialog,
        ElForm,
        ElFormItem,
        ElInput,
        ElTable,
        ElTableColumn
      }
    }
  });
  wrapper.vm.open?.();
  await flushPromises();
  return wrapper;
};

const fillDescription = async (
  wrapper: Awaited<ReturnType<typeof mountDialog>>,
  text: string
) => {
  // textarea 模式下 data-testid 直接落在原生 textarea 上
  await wrapper.find('[data-testid="ai-draft-description"]').setValue(text);
  await wrapper.find('[data-testid="ai-draft-run"]').trigger("click");
  await flushPromises();
};

describe("AiDraftDialog", () => {
  it("生成草案：渲染摘要 / 告警 / 勾选表", async () => {
    api.aiDraft.mockResolvedValue({ code: 1000, data: draftResult });
    const wrapper = await mountDialog();
    await fillDescription(wrapper, "书籍管理页");
    expect(api.aiDraft).toHaveBeenCalledWith({
      model: "demo.Book",
      description: "书籍管理页"
    });
    expect(wrapper.find('[data-testid="ai-draft-summary"]').text()).toContain(
      "草案就绪"
    );
    expect(wrapper.text()).toContain("codegen.aiDraftWarnings");
    expect(
      wrapper.findAll('[data-testid="ai-draft-table"] .el-table__row')
    ).toHaveLength(2);
  });

  it("人审勾选：仅采纳选中项并 emit apply", async () => {
    api.aiDraft.mockResolvedValue({ code: 1000, data: draftResult });
    const wrapper = await mountDialog();
    await fillDescription(wrapper, "书籍页");
    // 取消第二行（author）的勾选：仅采纳 name
    const boxes = wrapper.findAll(
      '[data-testid="ai-draft-table"] input[type="checkbox"]'
    );
    await boxes[1].setValue(false);
    await wrapper.find('[data-testid="ai-draft-apply"]').trigger("click");
    const emitted = wrapper.emitted("apply");
    expect(emitted).toHaveLength(1);
    expect(emitted![0]).toEqual([
      [{ name: "name", label: "书名", required: true }]
    ]);
  });

  it("接口失败：不出结果表、采纳按钮禁用", async () => {
    api.aiDraft.mockRejectedValue(new Error("1001"));
    const wrapper = await mountDialog();
    await fillDescription(wrapper, "书籍页");
    expect(wrapper.find('[data-testid="ai-draft-table"]').exists()).toBe(false);
    expect(
      wrapper.find('[data-testid="ai-draft-apply"]').attributes("disabled")
    ).toBeDefined();
  });
});
