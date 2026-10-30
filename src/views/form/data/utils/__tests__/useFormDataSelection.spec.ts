import { defineComponent, h } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FormDataApi, FormDataFormOption } from "@/api/dataset/dform";
import { useFormDataSelection } from "../useFormDataSelection";

const { messageMock } = vi.hoisted(() => ({ messageMock: vi.fn() }));

vi.mock("@/utils/message", () => ({ message: messageMock }));

const OPTION: FormDataFormOption = {
  pk: "f1",
  name: "入职登记",
  description: "",
  is_active: true,
  schema: { fields: [] },
  schema_version: 1
};

let state: ReturnType<typeof useFormDataSelection>;

/** 挂载宿主组件执行 composable（onMounted 内拉取表单选项） */
const mountHost = (formOptions: () => Promise<unknown>) => {
  const api = { formOptions } as Pick<FormDataApi, "formOptions">;
  const Host = defineComponent({
    setup() {
      state = useFormDataSelection({ api });
      return () => h("div");
    }
  });
  mount(Host);
};

beforeEach(() => {
  messageMock.mockReset();
});

describe("useFormDataSelection 截断提示", () => {
  it("成功响应的默认 detail（操作成功）不弹提示", async () => {
    // 复现修复前缺陷：以「detail 非空」判断截断，打开页面即弹「操作成功」
    mountHost(
      vi.fn().mockResolvedValue({
        code: 1000,
        detail: "操作成功",
        data: [OPTION]
      })
    );
    await flushPromises();

    expect(messageMock).not.toHaveBeenCalled();
    expect(state.forms.value).toHaveLength(1);
    expect(state.selectedFormPk.value).toBe("f1");
  });

  it("truncated=true 时展示服务端截断提示", async () => {
    mountHost(
      vi.fn().mockResolvedValue({
        code: 1000,
        detail: "表单数量超过单次加载上限",
        truncated: true,
        data: [OPTION]
      })
    );
    await flushPromises();

    expect(messageMock).toHaveBeenCalledWith("表单数量超过单次加载上限", {
      type: "warning"
    });
  });

  it("加载失败只置失败态，不弹成功/截断提示", async () => {
    mountHost(vi.fn().mockResolvedValue({ code: 500, detail: "服务暂不可用" }));
    await flushPromises();

    expect(state.formsLoadFailed.value).toBe(true);
    expect(messageMock).not.toHaveBeenCalled();
  });
});
