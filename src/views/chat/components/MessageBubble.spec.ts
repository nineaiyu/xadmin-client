import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import {
  ElAvatar,
  ElButton,
  ElCollapseTransition,
  ElIcon,
  ElImage,
  ElTag
} from "element-plus";

import type { ChatAttachment, ChatMessageItem } from "@/api/chat";
import AiMessageBlock from "@/components/AiMessageBlock";

const mocks = vi.hoisted(() => ({
  hasAuth: vi.fn(() => true),
  actionExecute: vi.fn()
}));

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/router/utils", () => ({ hasAuth: mocks.hasAuth }));
vi.mock("@/api/ai/ai", () => ({
  aiAssistantApi: { actionExecute: mocks.actionExecute }
}));
vi.mock("@/utils/http", () => ({ http: { autoDownload: vi.fn() } }));
vi.mock("@/utils/message", () => ({ message: vi.fn() }));

import MessageBubble from "./MessageBubble.vue";

/** 消息样本（ChatRoomMessage 与 ChatMessageItem 同形状） */
const message = (overrides: Partial<ChatMessageItem>): ChatMessageItem =>
  ({
    id: 7,
    room_id: 1,
    room_type: "public",
    sender_pk: 2,
    sender_name: "alice",
    sender_avatar: "",
    message_type: "text",
    content: "hello",
    created_time: "2026-10-02T01:02:00Z",
    client_msg_id: "",
    extra: {},
    ...overrides
  }) as ChatMessageItem;

const attachment = (overrides: Partial<ChatAttachment>): ChatAttachment =>
  ({
    pk: "9",
    filename: "pic.png",
    filesize: 1,
    mime_type: "image/png",
    category: "image",
    kind: "image",
    url: "/api/chat/message/7/file",
    missing: false,
    ...overrides
  }) as ChatAttachment;

const mountBubble = (
  item: ChatMessageItem,
  props: { mine?: boolean; mePk?: number } = {}
) =>
  mount(MessageBubble, {
    props: { item, mine: props.mine ?? false, mePk: props.mePk },
    global: {
      components: {
        ElAvatar,
        ElButton,
        ElCollapseTransition,
        ElIcon,
        ElImage,
        ElTag
      },
      stubs: {
        AiResultTable: true,
        "el-popover": { template: '<div><slot name="reference" /></div>' }
      }
    }
  });

describe("MessageBubble 消息气泡分支", () => {
  it("system 消息渲染居中窄条，不出现气泡行与头像块", () => {
    const wrapper = mountBubble(
      message({ message_type: "system", content: "alice 加入了聊天室" })
    );
    expect(wrapper.text()).toContain("alice 加入了聊天室");
    expect(wrapper.find(".group").exists()).toBe(false);
    expect(wrapper.findComponent(AiMessageBlock).exists()).toBe(false);
  });

  it("他人消息默认靠左，自己的消息行反转靠右", () => {
    const other = mountBubble(message({}));
    expect(other.find(".group").classes()).not.toContain("flex-row-reverse");

    const mine = mountBubble(message({ sender_pk: 1 }), { mine: true });
    expect(mine.find(".group").classes()).toContain("flex-row-reverse");
  });

  it("AI 消息走 AiMessageBlock：思考过程读 extra.reasoning，引用读 extra.sources", () => {
    const wrapper = mountBubble(
      message({
        message_type: "ai",
        content: "答案正文",
        extra: {
          reasoning: "思考链",
          sources: [{ title: "部署文档", path: "/ops.md", chunk_index: 0 }]
        }
      })
    );
    const block = wrapper.findComponent(AiMessageBlock);
    expect(block.exists()).toBe(true);
    expect(block.props("reasoning")).toBe("思考链");
    expect(block.props("content")).toBe("答案正文");
    expect(block.props("sources")).toHaveLength(1);
    expect(wrapper.text()).toContain("答案正文");
  });

  it("recalled 消息渲染撤回占位：自己与他人各用一套文案，正文不再展示", () => {
    const mine = mountBubble(message({ is_recalled: true }), { mine: true });
    expect(mine.text()).toContain("chat.youRecalled");
    expect(mine.text()).not.toContain("hello");

    const other = mountBubble(message({ is_recalled: true }));
    expect(other.text()).toContain("chat.recalled");
    expect(other.text()).not.toContain("hello");
  });

  it("图片消息：有效附件渲染缩略图入口；附件缺失渲染占位文案", () => {
    const ok = mountBubble(
      message({
        message_type: "image",
        content: "pic.png",
        extra: { file: attachment({}) }
      })
    );
    expect(ok.find('[data-testid="chat-image"]').exists()).toBe(true);

    const missing = mountBubble(
      message({
        message_type: "image",
        content: "pic.png",
        extra: { file: attachment({ missing: true }) }
      })
    );
    expect(missing.find('[data-testid="chat-image"]').exists()).toBe(false);
    expect(missing.text()).toContain("chat.attachmentMissing");
  });

  it("文件消息：卡片展示文件名，并提供受鉴权下载按钮", () => {
    const wrapper = mountBubble(
      message({
        message_type: "file",
        content: "报告.pdf",
        extra: {
          file: attachment({
            pk: "10",
            filename: "报告.pdf",
            filesize: 2048,
            mime_type: "application/pdf",
            category: "file",
            kind: "file"
          })
        }
      })
    );
    expect(wrapper.find('[data-testid="chat-file"]').exists()).toBe(true);
    expect(wrapper.text()).toContain("报告.pdf");
    expect(wrapper.find('[data-testid="chat-file-download"]').exists()).toBe(
      true
    );
  });

  it("表情回应徽标：按全量表渲染 emoji 与人数，自己的回应高亮，点击上报告应", async () => {
    const item = message({ extra: { reactions: { "👍": [1, 2] } } });
    const wrapper = mountBubble(item, { mePk: 1 });

    const chip = wrapper.find('[data-testid="chat-reaction-chip"]');
    expect(chip.exists()).toBe(true);
    expect(chip.attributes("data-emoji")).toBe("👍");
    expect(chip.text()).toContain("2");
    // 自己（pk=1）在回应名单里：渲染高亮态
    expect(chip.classes().join(" ")).toContain("primary-light-8");

    await chip.trigger("click");
    expect(wrapper.emitted("react")).toEqual([[item, "👍"]]);
  });

  it("ai / system 类型不提供表情回应入口（机器生成消息不可回应）", () => {
    const wrapper = mountBubble(
      message({ message_type: "ai", extra: { reactions: { "👍": [1] } } })
    );
    expect(wrapper.find('[data-testid="chat-reactions"]').exists()).toBe(false);
  });

  it("发送失败的消息展示失败标记与重发入口，点击 emit resend", async () => {
    const item = message({ failed: true });
    const wrapper = mountBubble(item);
    expect(wrapper.text()).toContain("chat.sendFailed");

    const resend = wrapper
      .findAll("button")
      .find(button => button.text() === "chat.resend");
    expect(resend).toBeTruthy();
    await resend!.trigger("click");
    expect(wrapper.emitted("resend")).toEqual([[item]]);
  });

  it("可撤回消息渲染撤回入口，点击 emit recall", async () => {
    const item = message({ can_recall: true });
    const wrapper = mountBubble(item);

    const recall = wrapper
      .findAll("button")
      .find(button => button.text() === "chat.recall");
    expect(recall).toBeTruthy();
    await recall!.trigger("click");
    expect(wrapper.emitted("recall")).toEqual([[item]]);
  });

  it("撤回入口只认 can_recall：本地窗口过期复位或已撤回的消息不渲染入口", () => {
    const expired = mountBubble(message({ can_recall: false }));
    expect(
      expired.findAll("button").find(button => button.text() === "chat.recall")
    ).toBeUndefined();

    const recalled = mountBubble(
      message({ can_recall: true, is_recalled: true })
    );
    expect(
      recalled.findAll("button").find(button => button.text() === "chat.recall")
    ).toBeUndefined();
  });

  it("动作草稿卡：有权限时渲染确认入口，无权限时只读展示并提示", () => {
    const draft = {
      action: "user.disable",
      label: "禁用用户",
      params: { pk: 3 },
      summary: "禁用 bob",
      requires_approval: true
    };

    mocks.hasAuth.mockReturnValue(false);
    const denied = mountBubble(
      message({ message_type: "ai", extra: { action_drafts: [draft] } })
    );
    expect(denied.find('[data-testid="chat-action-card"]').exists()).toBe(true);
    expect(
      denied.find('[data-testid="chat-action-disabled-hint"]').exists()
    ).toBe(true);
    expect(denied.find('[data-testid="chat-action-confirm"]').exists()).toBe(
      false
    );

    mocks.hasAuth.mockReturnValue(true);
    const allowed = mountBubble(
      message({ message_type: "ai", extra: { action_drafts: [draft] } })
    );
    expect(allowed.find('[data-testid="chat-action-confirm"]').exists()).toBe(
      true
    );
  });
});
