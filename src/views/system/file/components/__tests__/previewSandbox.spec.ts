import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ preview: vi.fn() }));

vi.mock("@/api/file/file", () => ({
  systemUploadFileApi: { preview: api.preview }
}));
vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (key: string) => key })
}));

import PreviewDrawer from "../PreviewDrawer.vue";

beforeEach(() => {
  api.preview.mockReset();
  // jsdom 未实现 object URL
  Object.defineProperty(URL, "createObjectURL", {
    writable: true,
    value: vi.fn(() => "blob:http://localhost/preview")
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    writable: true,
    value: vi.fn()
  });
});

async function mountPreview(kind: string) {
  api.preview.mockResolvedValue({
    data: new Blob(["pdf"], { type: "application/pdf" }),
    headers: {}
  });
  const wrapper = mount(PreviewDrawer, {
    props: { row: { pk: 1, preview_kind: kind } },
    global: { directives: { loading: {} } }
  });
  await flushPromises();
  return wrapper;
}

describe("文件预览沙箱", () => {
  it("PDF 内嵌不放开 allow-same-origin（默认沙箱仅保留脚本）", async () => {
    const wrapper = await mountPreview("pdf");
    const frame = wrapper.find("iframe");
    expect(frame.exists()).toBe(true);
    const tokens = (frame.attributes("sandbox") ?? "").split(/\s+/);
    expect(tokens).toContain("allow-scripts");
    expect(tokens).not.toContain("allow-same-origin");
    expect(frame.attributes("referrerpolicy")).toBe("no-referrer");
    wrapper.unmount();
  });

  it("Office 转换产物同样按 PDF 沙箱渲染", async () => {
    const wrapper = await mountPreview("office");
    expect(wrapper.find("iframe").attributes("sandbox")).toBe("allow-scripts");
    wrapper.unmount();
  });
});
