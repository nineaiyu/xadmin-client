import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import InstanceDetail from "../InstanceDetail.vue";
import { useUserStoreHook } from "@/store/modules/user";

/**
 * 流程实例讨论区评论删除入口显隐单测。
 *
 * 核心回归：删除入口与后端 delete_comment 的放行口径对齐——评论作者或平台
 * 超管（userinfo 下发 is_superuser）可见；字段缺失按非超管处理，行为与
 * 「仅作者可见」一致。
 */

const state = vi.hoisted(() => ({
  retrieveMock: vi.fn(),
  commentsMock: vi.fn(),
  confirmMock: vi.fn(async () => true),
  deleteCommentMock: vi.fn(),
  hasAuthMock: vi.fn((_code: string) => true)
}));

vi.mock("@/api/approval/approvalFlow", () => ({
  approvalInstanceApi: {
    retrieve: state.retrieveMock,
    comments: state.commentsMock,
    addComment: vi.fn(),
    deleteComment: state.deleteCommentMock
  }
}));
vi.mock("vue-i18n", async importOriginal => ({
  ...(await importOriginal<object>()),
  useI18n: () => ({ t: (key: string) => key })
}));
vi.mock("@/hooks/useConfirm", () => ({
  useConfirm: () => state.confirmMock
}));
vi.mock("@/components/ReEmpty", () => ({
  default: {
    name: "ReEmpty",
    props: ["description", "imageSize"],
    template: "<div />"
  }
}));
vi.mock("@/utils/message", () => ({ message: vi.fn() }));
vi.mock("@/router/utils", () => ({ hasAuth: state.hasAuthMock }));

/** 讨论区数据：c1 作者为 7 号用户，c2 为 8 号用户 */
const commentRows = [
  {
    pk: "c1",
    creator: 7,
    author_display: "alice",
    content: "first",
    mentions: [],
    created_time: "2026-01-01T08:00:00"
  },
  {
    pk: "c2",
    creator: 8,
    author_display: "bob",
    content: "second",
    mentions: [],
    created_time: "2026-01-01T09:00:00"
  }
];

const mountDetail = async () => {
  const wrapper = mount(InstanceDetail, {
    props: { pk: "i1" },
    global: {
      directives: { loading: {} },
      stubs: {
        "el-descriptions": { template: "<div><slot /></div>" },
        "el-descriptions-item": { template: "<div><slot /></div>" },
        "el-divider": { template: "<div><slot /></div>" },
        "el-timeline": { template: "<div><slot /></div>" },
        "el-timeline-item": { template: "<div><slot /></div>" },
        "el-tag": { template: "<span><slot /></span>" },
        // $attrs 透传：保留源组件上的 data-testid，按属性区分删除入口
        "el-button": { template: '<button v-bind="$attrs"><slot /></button>' },
        // 双向透传：@ 联想用例需要真实驱动 v-model（输入 @片段 → 候选渲染）
        "el-input": {
          props: ["modelValue"],
          template: `<textarea
            data-testid="comment-input"
            :value="modelValue"
            @input="$emit('update:modelValue', $event.target.value)"
          />`
        }
      }
    }
  });
  await flushPromises();
  return wrapper;
};

const deleteButtons = (wrapper: Awaited<ReturnType<typeof mountDetail>>) =>
  wrapper.findAll('[data-testid="comment-delete"]');

beforeEach(() => {
  vi.clearAllMocks();
  state.hasAuthMock.mockImplementation(() => true);
  state.retrieveMock.mockResolvedValue({
    code: 1000,
    detail: "ok",
    data: {
      pk: "i1",
      title: "出差申请",
      flow_name: "出差",
      creator: { pk: 7, label: "alice" },
      tasks: [
        { pk: "t1", node_name: "审批", assignee: { pk: 8, label: "bob" } }
      ],
      cc_users: [{ pk: 9, label: "carol" }]
    }
  });
  state.commentsMock.mockResolvedValue({
    code: 1000,
    detail: "ok",
    data: commentRows
  });
});

describe("InstanceDetail 评论删除入口显隐", () => {
  it("评论作者可见自己的删除入口，他人评论不渲染", async () => {
    useUserStoreHook().$patch({ pk: 7, is_superuser: false });
    const wrapper = await mountDetail();
    // 作者（7 号）：自己的评论（c1）有删除入口；8 号的评论没有
    expect(deleteButtons(wrapper).length).toBe(1);
  });

  it("非作者但为超管时可见删除入口（与后端放行口径对齐）", async () => {
    useUserStoreHook().$patch({ pk: 9, is_superuser: true });
    const wrapper = await mountDetail();
    // 超管（9 号，两条评论均非本人）：两条评论的删除入口都在
    expect(deleteButtons(wrapper).length).toBe(2);
  });

  it("非作者普通用户（含 is_superuser 缺失）不渲染删除入口", async () => {
    useUserStoreHook().$patch({ pk: 9, is_superuser: undefined });
    const wrapper = await mountDetail();
    expect(deleteButtons(wrapper).length).toBe(0);
  });

  it("无 deleteComment 权限点时不渲染删除入口（即使是作者/超管）", async () => {
    state.hasAuthMock.mockImplementation(
      (code: string) => code !== "deleteComment:SystemApprovalInstance"
    );
    useUserStoreHook().$patch({ pk: 9, is_superuser: true });
    const wrapper = await mountDetail();
    expect(deleteButtons(wrapper).length).toBe(0);
  });

  it("无 addComment 权限点时给出只读说明而不渲染提交入口", async () => {
    state.hasAuthMock.mockImplementation(
      (code: string) => code !== "addComment:SystemApprovalInstance"
    );
    useUserStoreHook().$patch({ pk: 9, is_superuser: true });
    const wrapper = await mountDetail();
    expect(wrapper.find('[data-testid="comment-readonly-hint"]').exists()).toBe(
      true
    );
  });
});

describe("InstanceDetail 讨论 @ 提及联想与高亮", () => {
  /** 候选口径：detail 参与人（creator alice / 处理人 bob / 抄送 carol），排除当前用户 */
  const optionIds = (wrapper: Awaited<ReturnType<typeof mountDetail>>) =>
    wrapper
      .findAll('[data-testid^="mention-option-"]')
      .map(node => node.attributes("data-testid"));

  it("输入 @ 出现参与人候选，片段过滤生效，点击插入 @username", async () => {
    useUserStoreHook().$patch({ pk: 42, is_superuser: false });
    const wrapper = await mountDetail();
    const input = wrapper.find('[data-testid="comment-input"]');
    await input.setValue("@");
    expect(optionIds(wrapper)).toEqual([
      "mention-option-alice",
      "mention-option-bob",
      "mention-option-carol"
    ]);
    await input.setValue("@ca");
    expect(optionIds(wrapper)).toEqual(["mention-option-carol"]);
    await wrapper.find('[data-testid="mention-option-carol"]').trigger("click");
    expect(
      (
        wrapper.find('[data-testid="comment-input"]')
          .element as HTMLTextAreaElement
      ).value
    ).toBe("@carol ");
    // 插入补空格终结提及：候选关闭、不出现无匹配提示
    expect(optionIds(wrapper)).toEqual([]);
    expect(wrapper.find('[data-testid="mention-empty"]').exists()).toBe(false);
  });

  it("候选排除当前用户（与后端 @自己不产生提醒的解析口径一致）", async () => {
    useUserStoreHook().$patch({ pk: 7, is_superuser: false });
    const wrapper = await mountDetail();
    await wrapper.find('[data-testid="comment-input"]').setValue("@");
    expect(optionIds(wrapper)).toEqual([
      "mention-option-bob",
      "mention-option-carol"
    ]);
  });

  it("末尾触发但无匹配时提示无匹配成员", async () => {
    useUserStoreHook().$patch({ pk: 42, is_superuser: false });
    const wrapper = await mountDetail();
    await wrapper.find('[data-testid="comment-input"]').setValue("@nobody");
    expect(optionIds(wrapper)).toEqual([]);
    expect(wrapper.find('[data-testid="mention-empty"]').exists()).toBe(true);
  });

  it("评论正文按 @用户名 分段高亮（文本直出，不走 v-html）", async () => {
    useUserStoreHook().$patch({ pk: 42, is_superuser: false });
    state.commentsMock.mockResolvedValueOnce({
      code: 1000,
      detail: "ok",
      data: [
        {
          pk: "c9",
          creator: 7,
          author_display: "alice",
          content: "@bob 请复核这份单据，谢谢",
          mentions: ["8"],
          created_time: "2026-01-02T08:00:00"
        }
      ]
    });
    const wrapper = await mountDetail();
    const body = wrapper.find('[data-testid="comment-content-c9"]');
    expect(body.exists()).toBe(true);
    const mentionNode = body.find(".text-\\(--el-color-primary\\)");
    expect(mentionNode.text()).toBe("@bob");
    expect(body.text()).toBe("@bob 请复核这份单据，谢谢");
  });
});
