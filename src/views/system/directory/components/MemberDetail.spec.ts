import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { formatDateTime } from "@/utils/format";
import type { DirectoryMember } from "@/api/identity/directory";

vi.mock("vue-i18n", async importOriginal => {
  const actual = await importOriginal<typeof import("vue-i18n")>();
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) };
});

import MemberDetail from "./MemberDetail.vue";

const stubs = {
  "el-avatar": { template: "<div><slot /></div>" },
  "el-divider": { template: "<div />" },
  "el-descriptions": { template: "<div><slot /></div>" },
  "el-descriptions-item": {
    props: ["label"],
    template: "<div><slot /></div>"
  },
  "el-tag": { template: "<span><slot /></span>" },
  "el-button": { template: "<button><slot /></button>" }
};

describe("通讯录成员详情", () => {
  it("登录时间与注册时间按统一格式展示，不输出原始时间戳", () => {
    const iso = "2026-03-05T06:07:08.123Z";
    const row: DirectoryMember = {
      pk: 1,
      avatar: null,
      username: "alice",
      nickname: "Alice",
      gender: null,
      dept: null,
      posts: [],
      email: "",
      phone: "",
      is_active: true,
      last_login: iso,
      date_joined: iso
    };
    const wrapper = mount(MemberDetail, {
      props: { row },
      global: { stubs }
    });
    const expected = formatDateTime(iso);

    expect(wrapper.text()).toContain(expected);
    expect(wrapper.text()).not.toContain(iso);
  });
});
