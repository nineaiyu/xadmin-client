import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  allowed: new Set<string>(),
  groupMembers: vi.fn()
}));

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/router/utils", () => ({
  hasAuth: (code: string) => state.allowed.has(code)
}));
vi.mock("@/api/chat", () => ({
  chatApi: {
    groupMembers: state.groupMembers,
    updateGroupMembers: vi.fn(),
    renameGroup: vi.fn(),
    leaveGroup: vi.fn()
  }
}));
vi.mock("@/utils/message", () => ({ message: vi.fn() }));
vi.mock("@/hooks/useConfirm", () => ({ useConfirm: () => vi.fn() }));

import ChatGroupMembersPanel from "./ChatGroupMembersPanel.vue";

const room = (isOwner: boolean) => ({
  id: 9,
  room_type: "group",
  room_key: "g-9",
  name: "测试群",
  owner_pk: 1,
  is_owner: isOwner,
  member_count: 2,
  peer: null,
  last_message: "",
  last_message_time: "",
  unread_count: 0,
  members: []
});

const mountPanel = (isOwner: boolean) =>
  mount(ChatGroupMembersPanel, {
    props: { room: room(isOwner) as never },
    global: {
      stubs: {
        "el-input": {
          name: "ElInput",
          props: ["modelValue"],
          template: '<input data-testid="rename-input" />'
        },
        "el-select": {
          name: "ElSelect",
          props: ["modelValue"],
          template: '<div data-testid="add-select"><slot /></div>'
        },
        "el-option": { template: "<div />" },
        "el-button": {
          name: "ElButton",
          emits: ["click"],
          template: "<button @click=\"$emit('click')\"><slot /></button>"
        },
        "el-avatar": { template: "<div />" },
        "el-tag": { template: "<span><slot /></span>" },
        ReEmpty: { template: "<div />" }
      },
      directives: { loading: {} }
    }
  });

describe("群成员面板权限矩阵", () => {
  beforeEach(() => {
    state.allowed = new Set<string>();
    state.groupMembers.mockReset().mockResolvedValue({
      code: 1000,
      data: { members: [], room: room(true) }
    });
  });

  it("群主 + members/rename/leave：改名、加人、退群入口都渲染", async () => {
    state.allowed = new Set([
      "members:ChatRoom",
      "rename:ChatRoom",
      "leave:ChatRoom"
    ]);
    const wrapper = mountPanel(true);
    await flushPromises();

    expect(
      wrapper.find('[data-testid="chat-group-rename-input"]').exists()
    ).toBe(true);
    expect(wrapper.find('[data-testid="chat-group-add-select"]').exists()).toBe(
      true
    );
    expect(wrapper.text()).toContain("chat.leaveGroup");
  });

  it("群主无 rename：改名入口隐藏，但加人仍可用", async () => {
    state.allowed = new Set(["members:ChatRoom", "leave:ChatRoom"]);
    const wrapper = mountPanel(true);
    await flushPromises();

    expect(
      wrapper.find('[data-testid="chat-group-rename-input"]').exists()
    ).toBe(false);
    expect(wrapper.find('[data-testid="chat-group-add-select"]').exists()).toBe(
      true
    );
  });

  it("群主无 members：加人/移人入口隐藏，改名仍可用", async () => {
    state.allowed = new Set(["rename:ChatRoom", "leave:ChatRoom"]);
    const wrapper = mountPanel(true);
    await flushPromises();

    expect(wrapper.find('[data-testid="chat-group-add-select"]').exists()).toBe(
      false
    );
    expect(
      wrapper.find('[data-testid="chat-group-rename-input"]').exists()
    ).toBe(true);
  });

  it("非群主：改名/加人隐藏，有 leave 时可退群", async () => {
    state.allowed = new Set([
      "members:ChatRoom",
      "rename:ChatRoom",
      "leave:ChatRoom"
    ]);
    const wrapper = mountPanel(false);
    await flushPromises();

    expect(
      wrapper.find('[data-testid="chat-group-rename-input"]').exists()
    ).toBe(false);
    expect(wrapper.find('[data-testid="chat-group-add-select"]').exists()).toBe(
      false
    );
    expect(wrapper.text()).toContain("chat.leaveGroup");
  });

  it("无 leave 权限：退群按钮隐藏", async () => {
    state.allowed = new Set(["members:ChatRoom", "rename:ChatRoom"]);
    const wrapper = mountPanel(true);
    await flushPromises();

    expect(wrapper.text()).not.toContain("chat.leaveGroup");
  });
});
