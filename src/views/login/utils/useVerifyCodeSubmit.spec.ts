import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { useVerifyCodeSubmit } from "./useVerifyCodeSubmit";

describe("useVerifyCodeSubmit", () => {
  it("两级校验均通过才提交", () => {
    const submit = vi.fn();
    const verifyValidate = vi.fn(cb => cb(true));
    const formValidate = vi.fn(cb => cb(true));
    const verifyRef = ref({ getRef: () => ({ validate: verifyValidate }) });
    const formRef = ref({ validate: formValidate });
    useVerifyCodeSubmit({
      verifyRef: verifyRef as never,
      formRef: formRef as never,
      onSubmit: submit
    })();
    expect(verifyValidate).toHaveBeenCalled();
    expect(formValidate).toHaveBeenCalled();
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("验证码表单校验失败不提交", () => {
    const submit = vi.fn();
    const formValidate = vi.fn((cb: (valid: boolean) => void) => cb(true));
    const verifyRef = ref({
      getRef: () => ({ validate: (cb: (valid: boolean) => void) => cb(false) })
    });
    const formRef = ref({ validate: formValidate });
    useVerifyCodeSubmit({
      verifyRef: verifyRef as never,
      formRef: formRef as never,
      onSubmit: submit
    })();
    expect(submit).not.toHaveBeenCalled();
    expect(formValidate).not.toHaveBeenCalled();
  });

  it("本表单校验失败不提交", () => {
    const submit = vi.fn();
    const verifyRef = ref({
      getRef: () => ({ validate: (cb: (valid: boolean) => void) => cb(true) })
    });
    const formRef = ref({
      validate: (cb: (valid: boolean) => void) => cb(false)
    });
    useVerifyCodeSubmit({
      verifyRef: verifyRef as never,
      formRef: formRef as never,
      onSubmit: submit
    })();
    expect(submit).not.toHaveBeenCalled();
  });

  it("ref 为空（组件未就绪）不抛错、不提交（空值保护）", () => {
    const submit = vi.fn();
    const verifyRef = ref(undefined);
    const formRef = ref(undefined);
    expect(() =>
      useVerifyCodeSubmit({
        verifyRef: verifyRef as never,
        formRef: formRef as never,
        onSubmit: submit
      })()
    ).not.toThrow();
    expect(submit).not.toHaveBeenCalled();
  });

  it("省略 formRef 时只校验验证码表单即提交", () => {
    const submit = vi.fn();
    const verifyValidate = vi.fn(cb => cb(true));
    const verifyRef = ref({ getRef: () => ({ validate: verifyValidate }) });
    useVerifyCodeSubmit({
      verifyRef: verifyRef as never,
      onSubmit: submit
    })();
    expect(verifyValidate).toHaveBeenCalled();
    expect(submit).toHaveBeenCalledTimes(1);
  });
});
