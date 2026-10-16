import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import {
  ElButton,
  ElEmpty,
  ElIcon,
  ElInput,
  ElTag,
  ElTooltip
} from "element-plus";

import type { ChatRoomItem } from "@/api/chat";

const mocks = vi.hoisted(() => ({ message: vi.fn(), addDialog: vi.fn() }));

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
// 附件入口按权限点显隐：真实实现依赖路由/权限 store，这里直接放行
vi.mock("@/router/utils", () => ({ hasAuth: () => true }));
vi.mock("@/utils/message", () => ({ message: mocks.message }));
vi.mock("@/utils/desktopNotify", () => ({
  desktopNotifyEnabled: () => false,
  disableDesktopNotify: vi.fn(),
  enableDesktopNotify: vi.fn(async () => true),
  isDesktopNotifySupported: () => true
}));
vi.mock("@/components/ReDialog", () => ({ addDialog: mocks.addDialog }));

// 重依赖子组件以轻量替身替换（各分支在其专属 spec 内覆盖）
vi.mock("./MessageBubble.vue", () => ({
  default: { name: "MessageBubble", template: "<div class='bubble-stub' />" }
}));
vi.mock("./ChatEmojiPanel.vue", () => ({
  default: { name: "ChatEmojiPanel", template: "<div />" }
}));
vi.mock("./ChatGroupMembersPanel.vue", () => ({
  default: { name: "ChatGroupMembersPanel", template: "<div />" }
}));

import ChatWindow from "./ChatWindow.vue";

const room = (overrides: Partial<ChatRoomItem>): ChatRoomItem =>
  ({
    id: 5,
    room_type: "public",
    room_key: "public",
    name: "公共聊天室",
    peer: null,
    last_message: "",
    last_message_time: "",
    unread_count: 0,
    ...overrides
  }) as ChatRoomItem;

const baseProps = () => ({
  room: room({}),
  groups: [] as never,
  mine: () => false,
  contacts: [] as never,
  aiEnabled: true,
  aiHint: "",
  loading: false,
  hasMore: false,
  loadingMore: false,
  streaming: null,
  connected: true,
  pendingCount: 0,
  isNarrow: false,
  uploading: false,
  mePk: 1
});

const mountWindow = (
  overrides: {
    room?: ChatRoomItem | null;
    aiHint?: string;
    pendingCount?: number;
  } = {}
) =>
  mount(ChatWindow, {
    props: { ...baseProps(), ...overrides },
    global: {
      components: { ElButton, ElEmpty, ElIcon, ElInput, ElTag, ElTooltip },
      stubs: { AiStreamingBubble: true }
    }
  });

describe("ChatWindow 右栏挂载冒烟", () => {
  it("关键 testid 就位：chat-input 挂在外层 div 并包住 textarea（e2e 用后代选择器取输入框）", () => {
    const wrapper = mountWindow();

    expect(wrapper.find('[data-testid="chat-messages"]').exists()).toBe(true);
    const inputWrap = wrapper.find('[data-testid="chat-input"]');
    // 挂点形态契约：data-testid 挂原生 div（Element Plus 的 textarea 形态
    // el-input 不保证属性透传到内部 textarea），textarea 是其后代元素
    expect(inputWrap.element.tagName).toBe("DIV");
    expect(inputWrap.find("textarea").exists()).toBe(true);
    expect(wrapper.find('[data-testid="chat-send"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="chat-room-title"]').text()).toBe(
      "chat.publicRoom"
    );
  });

  it("Enter 发送：emit 去除空白后的内容并清空草稿", async () => {
    const wrapper = mountWindow();
    const textarea = wrapper.find('[data-testid="chat-input"] textarea');
    await textarea.setValue("  hello ");
    await textarea.trigger("keydown.enter");

    expect(wrapper.emitted("send")).toEqual([["hello"]]);
    expect(
      (
        wrapper.find('[data-testid="chat-input"] textarea')
          .element as HTMLTextAreaElement
      ).value
    ).toBe("");
  });

  it("发送按钮：草稿非空可点击 emit send；空草稿时按钮禁用", async () => {
    const wrapper = mountWindow();
    expect(
      wrapper.find('[data-testid="chat-send"]').attributes("disabled")
    ).toBeDefined();

    await wrapper.find('[data-testid="chat-input"] textarea').setValue("hi");
    expect(
      wrapper.find('[data-testid="chat-send"]').attributes("disabled")
    ).toBeUndefined();
    await wrapper.find('[data-testid="chat-send"]').trigger("click");
    expect(wrapper.emitted("send")).toEqual([["hi"]]);
  });

  it("未选中会话：输入区禁用（textarea 不可编辑）", () => {
    const wrapper = mountWindow({ room: null });
    expect(
      wrapper.find('[data-testid="chat-input"] textarea').attributes("disabled")
    ).toBeDefined();
  });

  it("AI 会话：占位文案优先使用后端下发的 aiHint", () => {
    const wrapper = mountWindow({
      room: room({ room_type: "ai" }),
      aiHint: "/kb 知识库问答"
    });
    expect(wrapper.find("textarea").attributes("placeholder")).toBe(
      "/kb 知识库问答"
    );
  });

  it("列表滚动事件透传给父级；离底悬浮条出现并可点击回底", async () => {
    const wrapper = mountWindow({ pendingCount: 2 });
    await wrapper.find('[data-testid="chat-messages"]').trigger("scroll");
    expect(wrapper.emitted("scroll")).toHaveLength(1);

    expect(wrapper.text()).toContain("chat.newMessages");
    await wrapper.find(".absolute.bottom-40").trigger("click");
    expect(wrapper.emitted("scrollToBottom")).toHaveLength(1);
  });
});
