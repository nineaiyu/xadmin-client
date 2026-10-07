import { mount } from "@vue/test-utils";
import { ElIcon, ElScrollbar, ElUpload } from "element-plus";
import { flushPromises } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hasAuth: vi.fn(() => true),
  message: vi.fn(),
  config: vi.fn()
}));

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/router/utils", () => ({ hasAuth: mocks.hasAuth }));
vi.mock("@/utils/message", () => ({ message: mocks.message }));
vi.mock("@/api/system/file", () => ({
  systemUploadFileApi: {
    config: mocks.config,
    upload: vi.fn(),
    download: vi.fn()
  }
}));
vi.mock("@/utils/upload/chunked", () => ({
  DEFAULT_CHUNK_SIZE: 5 * 1024 * 1024,
  ChunkUploadBusinessError: class ChunkUploadBusinessError extends Error {},
  uploadFileChunked: vi.fn()
}));

import FileUpload from "./FileUpload.vue";

const SUCCESS_CODE = 1000;

const mountUpload = async () => {
  const wrapper = mount(FileUpload, {
    global: { components: { ElIcon, ElScrollbar, ElUpload } }
  });
  await flushPromises();
  return wrapper;
};

describe("FileUpload 上传大小配置回退", () => {
  it("config 读取成功时应用下发配置且不提示", async () => {
    mocks.hasAuth.mockReturnValue(true);
    mocks.config.mockResolvedValue({
      code: SUCCESS_CODE,
      data: { file_upload_size: 50 * 1024 * 1024 }
    });
    const wrapper = await mountUpload();

    expect(mocks.message).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("50 MB");
  });

  it("config 缺权限/读取失败回退默认限制时一次性提示", async () => {
    // 无 config 权限：直接回退并提示一次
    mocks.hasAuth.mockReturnValue(false);
    await mountUpload();
    expect(mocks.message).toHaveBeenCalledTimes(1);
    expect(mocks.message.mock.calls[0][0]).toBe(
      "systemUploadFile.defaultSizeTip"
    );
    expect(mocks.message.mock.calls[0][1]).toEqual({ type: "warning" });

    // 再打开（组件重新挂载）不再重复提示
    await mountUpload();
    expect(mocks.message).toHaveBeenCalledTimes(1);

    // 有权限但业务码失败：同样只走一次性提示
    mocks.hasAuth.mockReturnValue(true);
    mocks.config.mockResolvedValue({ code: 500 });
    await mountUpload();
    expect(mocks.message).toHaveBeenCalledTimes(1);

    // 提示后仍按默认 1MB 限制拦截超大文件（tip 文案可感知）
    const wrapper = await mountUpload();
    expect(wrapper.text()).toContain("1 MB");
  });
});
