import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

const messageMock = vi.fn();
vi.mock("@/utils/message", () => ({
  message: (...args: unknown[]) => messageMock(...args)
}));

import { SUCCESS_CODE } from "@/api/types";
import { useDialogForm } from "./useDialogForm";

type Payload = { name: string };
type Host = { getPayload: () => Payload | null | undefined };

const makeHost = (payload: Payload | null | undefined): Host => ({
  getPayload: () => payload
});

function setup(options?: {
  payload?: Payload | null | undefined;
  hostMissing?: boolean;
  /** 走 readPayload 自定义读取形态（默认为模板 ref 形态） */
  readPayloadMode?: boolean;
  submit?: (payload: Payload) => Promise<unknown>;
  successText?: string;
  failType?: "error" | "warning";
  onSuccess?: (res: unknown) => void;
  onFail?: (res: unknown) => void;
  scrollToError?: false | (() => void);
  validate?: () => boolean | Promise<boolean>;
}) {
  const host = options?.hostMissing
    ? undefined
    : makeHost(options?.payload ?? null);
  const formRef = ref<Host | undefined>(host);
  const submit = vi.fn(
    options?.submit ?? (async () => ({ code: SUCCESS_CODE }))
  );
  const { beforeSure } = useDialogForm<Payload>({
    formRef: options?.readPayloadMode ? undefined : formRef,
    readPayload: options?.readPayloadMode
      ? () => host?.getPayload()
      : undefined,
    // 测试桩：真实调用点提交动作返回统一信封
    submit: submit as never,
    successText: options?.successText,
    failType: options?.failType,
    onSuccess: options?.onSuccess,
    onFail: options?.onFail,
    scrollToError: options?.scrollToError,
    validate: options?.validate
  });
  const done = vi.fn();
  const closeLoading = vi.fn();
  return { beforeSure, done, closeLoading, submit, formRef };
}

describe("useDialogForm（弹窗表单提交底座）", () => {
  beforeEach(() => {
    messageMock.mockClear();
  });

  it("payload 为 null（校验未通过）：不提交、closeLoading 复位按钮 loading", async () => {
    const { beforeSure, done, closeLoading, submit } = setup({ payload: null });
    await beforeSure(done, { closeLoading });
    expect(submit).not.toHaveBeenCalled();
    expect(closeLoading).toHaveBeenCalledTimes(1);
    expect(done).not.toHaveBeenCalled();
  });

  it("payload 为 null：默认尝试滚动到首个错误字段", async () => {
    const scrollToError = vi.fn();
    const { beforeSure, done, closeLoading } = setup({
      payload: null,
      scrollToError
    });
    await beforeSure(done, { closeLoading });
    expect(scrollToError).toHaveBeenCalledTimes(1);
    expect(closeLoading).toHaveBeenCalledTimes(1);
    expect(done).not.toHaveBeenCalled();
  });

  it("scrollToError=false：校验失败不滚动", async () => {
    const scrollToError = vi.fn();
    const { beforeSure, done, closeLoading } = setup({
      payload: null,
      scrollToError: false
    });
    await beforeSure(done, { closeLoading });
    expect(scrollToError).not.toHaveBeenCalled();
    expect(closeLoading).toHaveBeenCalledTimes(1);
  });

  it("validate 失败：不提交、滚动并收口 loading", async () => {
    const scrollToError = vi.fn();
    const { beforeSure, done, closeLoading, submit } = setup({
      payload: { name: "a" },
      validate: async () => false,
      scrollToError
    });
    await beforeSure(done, { closeLoading });
    expect(submit).not.toHaveBeenCalled();
    expect(scrollToError).toHaveBeenCalledTimes(1);
    expect(closeLoading).toHaveBeenCalledTimes(1);
    expect(done).not.toHaveBeenCalled();
  });

  it("validate 通过后正常提交", async () => {
    const validate = vi.fn(async () => true);
    const { beforeSure, done, submit } = setup({
      payload: { name: "a" },
      validate
    });
    await beforeSure(done, { closeLoading: vi.fn() });
    expect(validate).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith({ name: "a" });
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("payload 为 undefined 同 null 处理", async () => {
    const { beforeSure, done, closeLoading, submit } = setup({
      payload: undefined
    });
    await beforeSure(done, { closeLoading });
    expect(submit).not.toHaveBeenCalled();
    expect(closeLoading).toHaveBeenCalledTimes(1);
    expect(done).not.toHaveBeenCalled();
  });

  it("内容组件实例缺失（未挂载）：不提交、closeLoading", async () => {
    const { beforeSure, done, closeLoading, submit } = setup({
      hostMissing: true
    });
    await beforeSure(done, { closeLoading });
    expect(submit).not.toHaveBeenCalled();
    expect(closeLoading).toHaveBeenCalledTimes(1);
    expect(done).not.toHaveBeenCalled();
  });

  it("成功：done + 成功提示 + onSuccess，不调 closeLoading", async () => {
    const onSuccess = vi.fn();
    const { beforeSure, done, closeLoading, submit } = setup({
      payload: { name: "a" },
      successText: "保存成功",
      onSuccess
    });
    await beforeSure(done, { closeLoading });
    expect(submit).toHaveBeenCalledWith({ name: "a" });
    expect(done).toHaveBeenCalledTimes(1);
    expect(messageMock).toHaveBeenCalledWith("保存成功", { type: "success" });
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(closeLoading).not.toHaveBeenCalled();
  });

  it("无 successText：成功不提示", async () => {
    const { beforeSure, done, closeLoading } = setup({
      payload: { name: "a" }
    });
    await beforeSure(done, { closeLoading });
    expect(messageMock).not.toHaveBeenCalled();
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("业务失败（code 非成功）：提示 detail + closeLoading + 不 done", async () => {
    const { beforeSure, done, closeLoading } = setup({
      payload: { name: "a" },
      submit: async () => ({ code: 1001, data: null, detail: "名称重复" })
    });
    await beforeSure(done, { closeLoading });
    expect(messageMock).toHaveBeenCalledWith("名称重复", { type: "warning" });
    expect(closeLoading).toHaveBeenCalledTimes(1);
    expect(done).not.toHaveBeenCalled();
  });

  it("failType=error：失败提示按指定类型", async () => {
    const { beforeSure, done, closeLoading } = setup({
      payload: { name: "a" },
      failType: "error",
      submit: async () => ({ code: 1001, data: null, detail: "服务器错误" })
    });
    await beforeSure(done, { closeLoading });
    expect(messageMock).toHaveBeenCalledWith("服务器错误", { type: "error" });
  });

  it("提交抛异常（网络层）：归一为 detail 提示 + closeLoading（防 loading 悬挂）", async () => {
    const { beforeSure, done, closeLoading } = setup({
      payload: { name: "a" },
      submit: async () => {
        throw { detail: "网络异常" };
      }
    });
    await beforeSure(done, { closeLoading });
    expect(messageMock).toHaveBeenCalledWith("网络异常", { type: "warning" });
    expect(closeLoading).toHaveBeenCalledTimes(1);
    expect(done).not.toHaveBeenCalled();
  });

  it("提交抛非结构化异常：String 化后提示", async () => {
    const { beforeSure, done, closeLoading } = setup({
      payload: { name: "a" },
      submit: async () => {
        throw "boom";
      }
    });
    await beforeSure(done, { closeLoading });
    expect(messageMock).toHaveBeenCalledWith("boom", { type: "warning" });
    expect(closeLoading).toHaveBeenCalledTimes(1);
  });

  it("失败且无 detail：不提示、closeLoading 仍然复位", async () => {
    const { beforeSure, done, closeLoading } = setup({
      payload: { name: "a" },
      submit: async () => ({ code: 1001, data: null })
    });
    await beforeSure(done, { closeLoading });
    expect(messageMock).not.toHaveBeenCalled();
    expect(closeLoading).toHaveBeenCalledTimes(1);
    expect(done).not.toHaveBeenCalled();
  });

  it("onFail 自定义：接管失败处理（不做默认提示），closeLoading 仍复位", async () => {
    const onFail = vi.fn();
    const { beforeSure, done, closeLoading } = setup({
      payload: { name: "a" },
      onFail,
      submit: async () => ({ code: 1001, data: null, detail: "字段错误" })
    });
    await beforeSure(done, { closeLoading });
    expect(onFail).toHaveBeenCalledWith(
      expect.objectContaining({ code: 1001 })
    );
    expect(messageMock).not.toHaveBeenCalled();
    expect(closeLoading).toHaveBeenCalledTimes(1);
    expect(done).not.toHaveBeenCalled();
  });

  it("readPayload 自定义读取形态：正常取载荷并提交", async () => {
    const { beforeSure, done, submit } = setup({
      payload: { name: "b" },
      readPayloadMode: true
    });
    await beforeSure(done, { closeLoading: vi.fn() });
    expect(submit).toHaveBeenCalledWith({ name: "b" });
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("readPayload 自定义读取形态：载荷为空守卫同样生效", async () => {
    const { beforeSure, done, closeLoading, submit } = setup({
      payload: null,
      readPayloadMode: true
    });
    await beforeSure(done, { closeLoading });
    expect(submit).not.toHaveBeenCalled();
    expect(closeLoading).toHaveBeenCalledTimes(1);
    expect(done).not.toHaveBeenCalled();
  });
});
