import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ members: vi.fn() }));

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/api/identity/post", () => ({
  postApi: {
    members: api.members,
    userOptions: vi.fn().mockResolvedValue({ code: 1000, data: [] })
  }
}));
vi.mock("@/views/system/components/MemberTagEditor.vue", () => ({
  default: {
    name: "MemberTagEditor",
    props: ["hint", "members"],
    template: "<div class='editor-stub'>{{ hint }}</div>"
  }
}));

import PostMembersDialog from "./PostMembersDialog.vue";

const row = {
  pk: "post-1",
  name: "研发",
  code: "rd",
  dept: null,
  dept_name: "",
  rank: 0,
  is_active: true,
  user_count: 600,
  description: null,
  updated_time: ""
};

describe("岗位成员截断提示", () => {
  it("成员超过 500 人时提示总数与截断，不静默少人", async () => {
    api.members.mockResolvedValue({
      code: 1000,
      data: {
        members: [{ pk: 1, username: "u1", nickname: "用户1" }],
        total: 600,
        truncated: true
      }
    });
    const wrapper = mount(PostMembersDialog, {
      props: { row: row as never },
      global: { directives: { loading: {} } }
    });
    await flushPromises();

    expect(wrapper.find(".editor-stub").text()).toContain(
      "post.memberTruncated"
    );
  });
});
