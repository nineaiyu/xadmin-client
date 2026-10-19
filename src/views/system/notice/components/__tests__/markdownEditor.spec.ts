import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MarkdownEditor from "../MarkdownEditor.vue";

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  config: vi.fn(),
  message: vi.fn(),
  auth: { canUpload: false }
}));

vi.mock("vue-i18n", async importOriginal => ({
  ...(await importOriginal<typeof import("vue-i18n")>()),
  useI18n: () => ({ t: (key: string) => key })
}));
vi.mock("@/router/utils", () => ({
  hasAuth: (key: string) =>
    key === "upload:SystemUploadFile" && mocks.auth.canUpload
}));
vi.mock("@/api/file/file", () => ({
  systemUploadFileApi: { upload: mocks.upload, config: mocks.config }
}));
vi.mock("@/utils/message", () => ({ message: mocks.message }));

const mountEditor = () =>
  mount(MarkdownEditor, {
    props: { modelValue: "", minHeight: 200 },
    global: {
      stubs: {
        "el-tooltip": { template: "<span><slot /></span>" },
        "el-button": { template: "<button type='button'><slot /></button>" },
        "el-radio-group": { template: "<div><slot /></div>" },
        "el-radio-button": {
          template: "<button type='button'><slot /></button>"
        },
        "el-text": { template: "<span><slot /></span>" }
      }
    }
  });

describe("MarkdownEditor 输入 / 预览 / 上传", () => {
  beforeEach(() => {
    mocks.auth.canUpload = false;
    mocks.upload.mockReset();
    mocks.message.mockReset();
  });

  it("输入 Markdown 后同步 v-model 与实时预览", async () => {
    const wrapper = mountEditor();
    const textarea = wrapper.find("textarea");
    await textarea.setValue("## 维护窗口\n\n- 第一项");

    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([
      "## 维护窗口\n\n- 第一项"
    ]);
    expect(wrapper.find(".md-view h2").text()).toBe("维护窗口");
    expect(wrapper.find(".md-view li").text()).toBe("第一项");
    expect(wrapper.find(".md-editor__footer").text()).toContain(
      "systemNotice.markdownWordCount"
    );
  });

  it("正文中的媒体链接回填 files，供附件关联使用", async () => {
    const wrapper = mountEditor();
    await wrapper
      .find("textarea")
      .setValue("![截图](/media/upload/a.png)\n\n正文");

    const payload = wrapper.emitted("change")?.at(-1)?.[0] as {
      files: string[];
    };
    expect(payload.files).toEqual(["/media/upload/a.png"]);
  });

  it("选择附件后调用上传接口并插入 Markdown 语法、回填 files", async () => {
    mocks.auth.canUpload = true;
    mocks.upload.mockResolvedValue({
      code: 1000,
      data: [{ filename: "e2e-note.txt", access_url: "/media/upload/e2e.txt" }]
    });
    const wrapper = mountEditor();
    const input = wrapper.find('input[type="file"]');
    const file = new File(["hello"], "e2e-note.txt", { type: "text/plain" });
    Object.defineProperty(input.element, "files", {
      value: [file],
      configurable: true
    });

    await input.trigger("change");
    await flushPromises();

    await vi.waitFor(() =>
      expect(
        (wrapper.find("textarea").element as HTMLTextAreaElement).value
      ).toContain("[e2e-note.txt](</media/upload/e2e.txt>)")
    );
    expect(mocks.upload).toHaveBeenCalledTimes(1);
    const payload = wrapper.emitted("change")?.at(-1)?.[0] as {
      files: string[];
    };
    expect(payload.files).toEqual(["/media/upload/e2e.txt"]);
  });

  it("无上传权限时隐藏上传按钮", () => {
    const wrapper = mountEditor();
    expect(wrapper.text()).not.toContain(
      "systemNotice.markdownUploadAttachment"
    );
  });
});
