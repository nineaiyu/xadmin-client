import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/ReDrawer", () => ({ addDrawer: vi.fn() }));

import { addDrawer } from "@/components/ReDrawer";
import { deptApi } from "@/api/identity/dept";
import { postApi } from "@/api/identity/post";
import { roleApi } from "@/api/identity/role";
import { userApi } from "@/api/identity/user";
import {
  PREVIEW_PRESETS,
  openPermissionPreview,
  type PermissionPreviewEntity
} from "../src/presets";

/** 四个实体 → 标题 / 抽屉档位 / 内容组件 / 取数端点 */
const ENTITIES: PermissionPreviewEntity[] = ["user", "dept", "role", "post"];

describe("PREVIEW_PRESETS", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("覆盖 user/dept/role/post 四实体且映射完整", () => {
    expect(Object.keys(PREVIEW_PRESETS).sort()).toEqual([...ENTITIES].sort());
    expect(PREVIEW_PRESETS.user).toMatchObject({
      titleKey: "permissionPreview.userTitle",
      size: "xl"
    });
    expect(PREVIEW_PRESETS.dept).toMatchObject({
      titleKey: "permissionPreview.deptTitle",
      size: "xl"
    });
    expect(PREVIEW_PRESETS.role).toMatchObject({
      titleKey: "permissionPreview.roleTitle",
      size: "lg"
    });
    expect(PREVIEW_PRESETS.post).toMatchObject({
      titleKey: "permissionPreview.postTitle",
      size: "lg"
    });
    ENTITIES.forEach(entity => {
      expect(PREVIEW_PRESETS[entity].component).toBeTruthy();
    });
  });

  it("fetch 分别委托对应实体的 preview 端点", async () => {
    const previews = {
      user: vi
        .spyOn(userApi, "preview")
        .mockResolvedValue({ data: { user: { username: "u" } } } as never),
      dept: vi
        .spyOn(deptApi, "preview")
        .mockResolvedValue({ data: { dept: { name: "d" } } } as never),
      role: vi
        .spyOn(roleApi, "preview")
        .mockResolvedValue({ data: { role: { name: "r" } } } as never),
      post: vi
        .spyOn(postApi, "preview")
        .mockResolvedValue({ data: { post: { name: "p" } } } as never)
    };

    for (const entity of ENTITIES) {
      await PREVIEW_PRESETS[entity].fetch("42");
      expect(previews[entity]).toHaveBeenCalledWith("42");
    }
  });
});

describe("openPermissionPreview", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("按预设打开抽屉（标题/宽度/内容组件）", () => {
    const t = (key: string) => key;
    openPermissionPreview({ entity: "role", row: { pk: "1" }, t });
    expect(addDrawer).toHaveBeenCalledTimes(1);
    const options = vi.mocked(addDrawer).mock.calls[0][0];
    expect(options.title).toBe("permissionPreview.roleTitle");
    expect(options.size).toBe("60%");
    expect(options.destroyOnClose).toBe(true);
    expect(options.hideFooter).toBe(true);
    expect(typeof options.contentRenderer).toBe("function");
  });

  it("未知实体不打开抽屉、不抛错", () => {
    expect(() =>
      openPermissionPreview({
        entity: "tenant" as PermissionPreviewEntity,
        row: { pk: "1" },
        t: (key: string) => key
      })
    ).not.toThrow();
    expect(addDrawer).not.toHaveBeenCalled();
  });
});
