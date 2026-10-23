import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";

import { buildNoticeFormColumns } from "../noticeColumns";
import { resolveMessageFormat } from "../noticeFormat";

const mocks = vi.hoisted(() => ({
  confirm: vi.fn()
}));

vi.mock("element-plus", () => ({
  ElMessageBox: { confirm: mocks.confirm }
}));
vi.mock("@/hooks/useConfirm", () => ({
  useConfirm: () => async () => {
    try {
      await mocks.confirm();
      return true;
    } catch {
      return false;
    }
  }
}));
vi.mock("@/router/utils", () => ({ hasAuth: () => true }));
vi.mock("@/components/RePlusPage/src/components/WangEditor.vue", () => ({
  default: { name: "WangEditor", render: () => null }
}));

const t = (key: string) => key;

function buildFormValue(overrides: Record<string, unknown> = {}) {
  return ref<Record<string, unknown>>({
    message_format: { value: "html", label: "富文本" },
    message: "",
    files: [],
    ...overrides
  });
}

describe("公告表单正文格式列", () => {
  it("编辑态锁定格式并给出不可修改提示", () => {
    const column: Record<string, unknown> = { fieldProps: {}, options: [] };
    buildNoticeFormColumns({ t }).message_format({
      column,
      formValue: buildFormValue(),
      isAdd: false
    });

    expect((column.fieldProps as { disabled?: boolean }).disabled).toBe(true);
    expect(column.tooltip).toBe("systemNotice.formatLocked");
    expect(
      (column.fieldProps as { onChange?: unknown }).onChange
    ).toBeUndefined();
  });

  it("新增态空正文切换格式不弹确认，直接生效", async () => {
    const column: Record<string, unknown> = { fieldProps: {}, options: [] };
    const formValue = buildFormValue();
    buildNoticeFormColumns({ t }).message_format({
      column,
      formValue,
      isAdd: true
    });

    formValue.value.message_format = { value: "markdown", label: "Markdown" };
    await (
      column.fieldProps as { onChange: (value: unknown) => Promise<void> }
    ).onChange({ value: "markdown" });

    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(resolveMessageFormat(formValue.value.message_format)).toBe(
      "markdown"
    );
  });

  it("WangEditor 空文档占位（<p><br></p>）不算正文，不弹确认", async () => {
    const column: Record<string, unknown> = { fieldProps: {}, options: [] };
    const formValue = buildFormValue({ message: "<p><br></p>" });
    buildNoticeFormColumns({ t }).message_format({
      column,
      formValue,
      isAdd: true
    });

    formValue.value.message_format = { value: "markdown", label: "Markdown" };
    await (
      column.fieldProps as { onChange: (value: unknown) => Promise<void> }
    ).onChange({ value: "markdown" });

    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(formValue.value.message).toBe("<p><br></p>");
  });

  it("非空正文切换格式：确认后清空正文与附件", async () => {
    const column: Record<string, unknown> = { fieldProps: {}, options: [] };
    const formValue = buildFormValue({
      message: "已有正文",
      files: ["/media/upload/a.png"]
    });
    buildNoticeFormColumns({ t }).message_format({
      column,
      formValue,
      isAdd: true
    });
    mocks.confirm.mockResolvedValueOnce("confirm");

    formValue.value.message_format = { value: "markdown", label: "Markdown" };
    await (
      column.fieldProps as { onChange: (value: unknown) => Promise<void> }
    ).onChange({ value: "markdown" });

    expect(mocks.confirm).toHaveBeenCalledTimes(1);
    expect(formValue.value.message).toBe("");
    expect(formValue.value.files).toEqual([]);
  });

  it("取消切换时恢复原格式，正文保持不变", async () => {
    const column: Record<string, unknown> = { fieldProps: {}, options: [] };
    const formValue = buildFormValue({ message: "已有正文" });
    buildNoticeFormColumns({ t }).message_format({
      column,
      formValue,
      isAdd: true
    });
    mocks.confirm.mockRejectedValueOnce(new Error("cancel"));

    formValue.value.message_format = { value: "markdown", label: "Markdown" };
    await (
      column.fieldProps as { onChange: (value: unknown) => Promise<void> }
    ).onChange({ value: "markdown" });

    expect(resolveMessageFormat(formValue.value.message_format)).toBe("html");
    expect(formValue.value.message).toBe("已有正文");
  });
});

describe("公告表单正文列", () => {
  it("按正文格式渲染编辑器，并把附件清单回写表单", () => {
    const column: Record<string, unknown> = {};
    const formValue = buildFormValue({
      message_format: { value: "markdown", label: "Markdown" }
    });
    const result = buildNoticeFormColumns({ t }).message({
      column,
      formValue
    }) as Record<string, unknown>;

    const onChange = vi.fn();
    const vnode = (
      result.renderField as (
        value: unknown,
        onChange: (value: unknown) => void
      ) => { props: Record<string, unknown> }
    )(formValue.value.message, onChange);

    expect(vnode.props.format).toEqual({
      value: "markdown",
      label: "Markdown"
    });
    const messages = ref<string | undefined>("## 标题");
    (
      vnode.props.onChange as (payload: {
        messages: typeof messages;
        files: string[];
      }) => void
    )({ messages, files: ["/media/upload/a.png"] });

    expect(onChange).toHaveBeenCalledWith(messages);
    expect(formValue.value.files).toEqual(["/media/upload/a.png"]);
  });
});
