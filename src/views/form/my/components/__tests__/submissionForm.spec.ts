import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

import SubmissionForm from "../SubmissionForm.vue";
import type { FillableFormItem, SubmissionItem } from "@/api/dataset/dform";

/**
 * 动态填报表单（SubmissionForm）单测。
 *
 * 核心回归：编辑既有提交时按当前 schema 裁剪历史键——schema 演进（字段删除/
 * 改名）后旧 data 的已删字段键渲染不出、用户无法清理，不裁剪会随载荷提交被
 * 后端「未知键拒绝」口径卡死。
 */

const { userOptionsMock } = vi.hoisted(() => ({ userOptionsMock: vi.fn() }));

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/components/RePlusPage/src/components/UploadFiles.vue", () => ({
  default: { name: "UploadFiles", template: "<div />" }
}));
vi.mock("@/utils/dict", () => ({
  getDictItems: vi.fn().mockResolvedValue([])
}));
vi.mock("@/api/dataset/dform", () => ({
  submissionApi: { userOptions: userOptionsMock }
}));

const FORM: FillableFormItem = {
  pk: "form-1",
  name: "测试表单",
  description: "",
  approval_required: false,
  approval_flow: null,
  schema: {
    fields: [
      { key: "name", label: "姓名", type: "input", required: true },
      { key: "score", label: "得分", type: "number" }
    ]
  }
};

const SUBMISSION: SubmissionItem = {
  pk: "sub-1",
  form: "form-1",
  form_name: "测试表单",
  // ghost 为 schema 删掉的历史键；renamed_away 模拟改名前的旧键
  data: { name: "张三", ghost: "x", renamed_away: 1 },
  status: { value: "REJECTED", label: "已驳回" },
  created_time: "2026-01-01T00:00:00"
};

type SubmissionFormProps = {
  form: FillableFormItem;
  submission?: SubmissionItem | null;
};

const mountForm = (props: SubmissionFormProps) =>
  mount(SubmissionForm, {
    props,
    global: {
      stubs: {
        "el-alert": true,
        "el-form": { template: "<form><slot /></form>" },
        "el-form-item": { template: "<div><slot /></div>" },
        "el-input": true,
        "el-input-number": true
      }
    }
  });

const payloadOf = (wrapper: ReturnType<typeof mountForm>) =>
  (
    wrapper.vm as {
      getPayload: () => { data: Record<string, unknown> };
    }
  ).getPayload().data;

const validateOf = (wrapper: ReturnType<typeof mountForm>) =>
  (
    wrapper.vm as {
      validateRequired: () => { key: string; label: string } | null;
    }
  ).validateRequired();

describe("SubmissionForm 历史键裁剪", () => {
  it("编辑既有提交：formData 只保留当前 schema 的键，历史键不随载荷提交", async () => {
    userOptionsMock.mockResolvedValue({ data: [] });
    const wrapper = mountForm({ form: FORM, submission: SUBMISSION });
    await flushPromises();

    const data = payloadOf(wrapper);
    expect(data).toEqual({ name: "张三" });
    expect(data).not.toHaveProperty("ghost");
    expect(data).not.toHaveProperty("renamed_away");
  });

  it("新建填报：无历史数据，载荷为空对象起步", async () => {
    const wrapper = mountForm({ form: FORM, submission: null });
    await flushPromises();
    expect(payloadOf(wrapper)).toEqual({});
  });

  it("编辑正常提交：当前 schema 内的键保留原值", async () => {
    userOptionsMock.mockResolvedValue({ data: [] });
    const submission: SubmissionItem = {
      ...SUBMISSION,
      data: { name: "李四", score: 88 }
    };
    const wrapper = mountForm({ form: FORM, submission });
    await flushPromises();

    expect(payloadOf(wrapper)).toEqual({ name: "李四", score: 88 });
  });
});

describe("SubmissionForm 必填预检", () => {
  it("必填字段为空：返回该字段用于定位提示，类型校验仍交后端", async () => {
    userOptionsMock.mockResolvedValue({ data: [] });
    const submission: SubmissionItem = {
      ...SUBMISSION,
      data: { ghost: "x" }
    };
    const wrapper = mountForm({ form: FORM, submission });
    await flushPromises();

    expect(validateOf(wrapper)).toEqual({ key: "name", label: "姓名" });
  });

  it("必填已填、非必填为空：预检通过返回 null", async () => {
    userOptionsMock.mockResolvedValue({ data: [] });
    const submission: SubmissionItem = {
      ...SUBMISSION,
      data: { name: "张三" }
    };
    const wrapper = mountForm({ form: FORM, submission });
    await flushPromises();

    expect(validateOf(wrapper)).toBeNull();
  });

  it("联动隐藏的必填字段不参与预检；恢复显示后为空则被拦截", async () => {
    userOptionsMock.mockResolvedValue({ data: [] });
    // a 为空时隐藏必填字段 b；a 填写后 b 显示且必填
    const form: FillableFormItem = {
      ...FORM,
      schema: {
        fields: [
          { key: "a", label: "触发", type: "select", options: ["x", "y"] },
          { key: "b", label: "条件必填", type: "input", required: true }
        ],
        linkages: [{ target: "b", field: "a", op: "empty", effect: "hide" }]
      }
    };
    // a 为空：b 被隐藏，a 非必填 → 预检通过
    const hiddenCase = mountForm({ form, submission: null });
    await flushPromises();
    expect(validateOf(hiddenCase)).toBeNull();

    // a 已填：b 显示且必填为空 → 预检定位 b
    const shownCase = mountForm({
      form,
      submission: { ...SUBMISSION, data: { a: "x" } }
    });
    await flushPromises();
    expect(validateOf(shownCase)).toEqual({ key: "b", label: "条件必填" });
  });
});
