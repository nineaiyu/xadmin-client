import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

/** socket 实例持有：真实实现的连接建立是异步的，测试里构造后手动 open / 投递帧 */
const wsHolder = vi.hoisted(() => ({
  instance: null as null | {
    open: () => void;
    deliver: (frame: unknown) => void;
  }
}));

const mocks = vi.hoisted(() => ({
  openNoticeDetailDialog: vi.fn(),
  push: vi.fn(),
  notify: vi.fn(),
  batchRead: vi.fn(() => Promise.resolve({ code: 1000, data: null }))
}));

vi.mock("@/utils/websocket", () => ({
  PureWebSocket: class {
    private options?: { openCallback?: () => void };
    private handler: ((data: unknown) => void) | null = null;
    constructor(
      _identity: string,
      _group: string,
      options?: { openCallback?: () => void }
    ) {
      this.options = options;
      wsHolder.instance = this;
    }
    onMessage(callback: (data: unknown) => void) {
      this.handler = callback;
    }
    open() {
      this.options?.openCallback?.();
    }
    deliver(frame: unknown) {
      this.handler?.(frame);
    }
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    close() {}
  }
}));

vi.mock("@/router/router", () => ({ router: { push: mocks.push } }));
vi.mock("element-plus/es/components/notification/index.mjs", () => ({
  ElNotification: (...args: unknown[]) => mocks.notify(...args)
}));
vi.mock("@/api/user/notice", () => ({
  userNoticeReadApi: { batchRead: mocks.batchRead }
}));
vi.mock("@/views/system/notice/utils/noticeDetailDialog", () => ({
  openNoticeDetailDialog: mocks.openNoticeDetailDialog
}));

import { useNoticeStore } from "../notice";

/** 组装一条出站 push_message 帧（isOutboundMessage 仅校验 action） */
function pushFrame(data: Record<string, unknown>) {
  return {
    action: "push_message",
    code: 1000,
    detail: "",
    timestamp: "2026-10-14T00:00:00Z",
    v: 1,
    data
  };
}

function deliver(data: Record<string, unknown>) {
  const store = useNoticeStore();
  store.messageHandler("xadmin", vi.fn());
  wsHolder.instance!.open();
  wsHolder.instance!.deliver(pushFrame(data));
  return store;
}

/** 取最近一次应用内通知的点击回调（ElNotification 的 options.onClick） */
function lastNotificationClick(): () => void {
  const options = mocks.notify.mock.calls.at(-1)?.[0] as
    { onClick?: () => void } | undefined;
  if (!options?.onClick) throw new Error("应用内通知缺少 onClick");
  return options.onClick;
}

const notifyMessageData = () => ({
  message_type: "notify_message",
  pk: 7,
  title: "审批提醒",
  message: "<p>你有一条待审批</p>",
  level: { value: "primary" },
  notice_type: { value: 1, label: "通知" }
});

describe("notice store 推送分派", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("站内信推送：点击就地弹出详情（不跳转）并标记已读、角标递减", async () => {
    const store = deliver(notifyMessageData());
    // 推送到达即计未读
    expect(store.noticeCount).toBe(1);

    lastNotificationClick()();

    expect(mocks.openNoticeDetailDialog).toHaveBeenCalledTimes(1);
    expect(mocks.openNoticeDetailDialog.mock.calls[0][0]).toMatchObject({
      pk: 7,
      title: "审批提醒"
    });
    // 关键口径：不再跳转「我的通知」页
    expect(mocks.push).not.toHaveBeenCalled();

    // 打开即读：标记该条已读并把角标减回去
    // （api 在动作内动态引入，断言需等异步链路完成）
    await vi.waitFor(() =>
      expect(mocks.batchRead).toHaveBeenCalledWith({ pks: [7] })
    );
    await vi.waitFor(() => expect(store.noticeCount).toBe(0));
  });

  it("聊天 @提及推送：点击仍跳转聊天室（行为不变）", () => {
    deliver({
      message_type: "chat_message",
      room_id: 3,
      title: "@提醒",
      message: "hello",
      level: { value: "info" },
      notice_type: { value: 0, label: "聊天室" }
    });

    lastNotificationClick()();

    expect(mocks.push).toHaveBeenCalledWith({
      name: "Chat",
      query: { room: "3" }
    });
    expect(mocks.openNoticeDetailDialog).not.toHaveBeenCalled();
  });

  it("公告类 HTML 推送：经 DOMPurify 净化后才允许 dangerouslyUseHTMLString", () => {
    // notice_type.value === 0 走 HTML 分支；服务端已 bleach，这里是展示层兜底
    deliver({
      message_type: "notify_message",
      pk: 8,
      title: "公告",
      message:
        '<p>正常内容</p><img src="x" onerror="alert(1)"><script>alert(2)</script>',
      level: { value: "primary" },
      notice_type: { value: 0, label: "公告" }
    });

    const options = mocks.notify.mock.calls.at(-1)?.[0] as {
      message?: string;
      dangerouslyUseHTMLString?: boolean;
    };
    expect(options.dangerouslyUseHTMLString).toBe(true);
    expect(options.message).toContain("正常内容");
    // 事件属性与脚本标签必须被剥掉（存储型 XSS 纵深缺口守护）
    expect(options.message).not.toContain("onerror");
    expect(options.message).not.toContain("<script");
  });
});
