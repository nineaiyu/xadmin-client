import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, ref } from "vue";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  events: vi.fn(),
  message: vi.fn()
}));

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/router/utils", () => ({
  hasAuth: () => true,
  usePageAuth: () => ({})
}));
vi.mock("@/api/system/webhook", () => ({
  webhookSubscriptionApi: {
    events: mocks.events,
    create: vi.fn(),
    partialUpdate: vi.fn(),
    test: vi.fn()
  }
}));
vi.mock("@/utils/message", () => ({ message: mocks.message }));
vi.mock("@/components/ReDialog", () => ({ addDialog: vi.fn() }));
vi.mock("@/components/ReDialog/size", () => ({ dialogSize: (v: string) => v }));
vi.mock("@/components/RePlusPage", () => ({
  handleOperation: vi.fn(),
  formatPageColumns: (cols: unknown) => cols
}));
vi.mock("../../components/SubscriptionForm.vue", () => ({
  default: { name: "SubscriptionForm", render: () => null }
}));

import { useWebhookSubscription } from "../hook";

/** 在宿主组件内装配 hook：目录拉取挂在 onMounted，直调不触发 */
function mountHook() {
  let store: ReturnType<typeof useWebhookSubscription> | null = null;
  const Host = defineComponent(() => {
    const tableRef = ref();
    store = useWebhookSubscription(tableRef);
    return () => null;
  });
  mount(Host);
  return store!;
}

describe("webhook 订阅事件目录加载", () => {
  it("目录拉取失败时一次性提示（事件标签回落原始 key 行为保留）", async () => {
    mocks.events.mockRejectedValue(new Error("network down"));
    mountHook();
    await flushPromises();

    expect(mocks.message).toHaveBeenCalledWith("webhook.eventsLoadFailed", {
      type: "warning"
    });
  });

  it("目录加载成功不提示", async () => {
    mocks.events.mockResolvedValue({
      code: 1000,
      data: [{ key: "user.created", label: "用户创建" }]
    });
    mountHook();
    await flushPromises();

    expect(mocks.message).not.toHaveBeenCalled();
  });
});
