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
  deleteCommentMock: vi.fn()
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
      stubs: {
        "el-descriptions": { template: "<div><slot /></div>" },
        "el-descriptions-item": { template: "<div><slot /></div>" },
        "el-divider": { template: "<div><slot /></div>" },
        "el-timeline": { template: "<div><slot /></div>" },
        "el-timeline-item": { template: "<div><slot /></div>" },
        "el-tag": { template: "<span><slot /></span>" },
        // $attrs 透传：保留源组件上的 data-testid，按属性区分删除入口
        "el-button": { template: '<button v-bind="$attrs"><slot /></button>' },
        "el-input": { template: "<div />" }
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
  state.retrieveMock.mockResolvedValue({
    code: 1000,
    detail: "ok",
    data: { pk: "i1", title: "出差申请", flow_name: "出差" }
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
});
