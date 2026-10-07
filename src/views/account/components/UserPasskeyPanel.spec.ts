import { flushPromises, mount } from "@vue/test-utils";
import { ElButton, ElMessageBox } from "element-plus";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  message: vi.fn(),
  confirm: vi.fn()
}));

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/api/system/security", () => ({
  passkeyApi: {
    list: vi.fn().mockResolvedValue({ code: 1000, data: { results: [] } }),
    challenge: vi.fn(),
    register: vi.fn().mockResolvedValue({ code: 1000, detail: "ok" }),
    destroy: vi.fn()
  }
}));
vi.mock("@/utils/message", () => ({ message: mocks.message }));
vi.mock("@/utils/webauthn", () => ({
  isPasskeySupported: () => true,
  b64urlToBuffer: () => new Uint8Array([1]),
  bufferToB64url: () => "b64"
}));
vi.mock("@/hooks/useConfirm", () => ({
  useConfirm: () => mocks.confirm
}));
// 表格渲染细节不在本 spec 关注面内：桩掉以隔离注册仪式断言
vi.mock("@/components/ReReadonlyTable", () => ({
  ReReadonlyTable: {
    name: "ReReadonlyTable",
    props: ["columns", "rows"],
    template: "<div />"
  }
}));

import { passkeyApi } from "@/api/system/security";
import UserPasskeyPanel from "./UserPasskeyPanel.vue";

const challengeData = (rpName?: string) => ({
  code: 1000,
  detail: "ok",
  data: {
    challenge: "chal",
    rp_id: "admin.example.com",
    ...(rpName === undefined ? {} : { rp_name: rpName }),
    user_id: "u1",
    username: "alice",
    display_name: "Alice"
  }
});

const mountPanel = async () => {
  const wrapper = mount(UserPasskeyPanel, {
    global: { components: { ElButton } }
  });
  await flushPromises();
  return wrapper;
};

const allowNamePrompt = () => {
  vi.spyOn(ElMessageBox, "prompt").mockResolvedValue({
    value: "my key"
  } as never);
};

const credential = {
  response: { clientDataJSON: "cdj", attestationObject: "att" }
};

// jsdom 未实现 WebAuthn：注入桩对象承接注册仪式调用
Object.defineProperty(window.navigator, "credentials", {
  value: { create: mocks.create, get: vi.fn() },
  configurable: true
});

describe("UserPasskeyPanel 注册仪式 rp 展示名", () => {
  it("challenge 下发 rp_name 时作为 publicKey.rp.name", async () => {
    vi.mocked(passkeyApi.challenge).mockResolvedValue(
      challengeData("Xadmin 控制台") as never
    );
    allowNamePrompt();
    mocks.create.mockResolvedValue(credential);
    const wrapper = await mountPanel();

    await wrapper.find("button").trigger("click");
    await flushPromises();

    const options = mocks.create.mock.calls[0][0].publicKey;
    expect(options.rp).toEqual({
      id: "admin.example.com",
      name: "Xadmin 控制台"
    });
    expect(passkeyApi.register).toHaveBeenCalled();
  });

  it("rp_name 缺失时回落 rp_id（兼容在途后端）", async () => {
    vi.mocked(passkeyApi.challenge).mockResolvedValue(
      challengeData(undefined) as never
    );
    allowNamePrompt();
    mocks.create.mockResolvedValue(credential);
    const wrapper = await mountPanel();

    await wrapper.find("button").trigger("click");
    await flushPromises();

    const options = mocks.create.mock.calls[0][0].publicKey;
    expect(options.rp).toEqual({
      id: "admin.example.com",
      name: "admin.example.com"
    });
  });
});
