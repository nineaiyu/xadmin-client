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
