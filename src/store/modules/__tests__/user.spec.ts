import { describe, expect, beforeEach, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";

import { useUserStore } from "../user";
import { storageLocal } from "../../utils";
import { userKey } from "@/utils/auth";

const userInfo = {
  avatar: "a.png",
  username: "alice",
  nickname: "爱丽丝",
  email: "a@x.com",
  phone: "13800000000",
  roles: ["admin"]
};

describe("user store", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it("updateUserInfo 写穿持久化副本", () => {
    const store = useUserStore();
    store.updateUserInfo(userInfo as never);
    expect(store.username).toBe("alice");
    expect(store.roles).toEqual(["admin"]);
    expect(storageLocal().getItem(userKey)).toMatchObject({
      username: "alice"
    });
  });

  it("SET_* 系列动作逐一更新状态", () => {
    const store = useUserStore();
    store.SET_AVATAR("b.png");
    store.SET_USERNAME("bob");
    store.SET_NICKNAME("鲍勃");
    store.SET_EMAIL("b@x.com");
    store.SET_PHONE("13900000000");
    store.SET_ROLES(["dev"]);
    expect(store.avatar).toBe("b.png");
    expect(store.username).toBe("bob");
    expect(store.nickname).toBe("鲍勃");
    expect(store.email).toBe("b@x.com");
    expect(store.phone).toBe("13900000000");
    expect(store.roles).toEqual(["dev"]);
  });
});
