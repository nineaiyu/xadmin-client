import { beforeEach, describe, expect, it, vi } from "vitest";

const hasAuthMock = vi.hoisted(() => vi.fn());
vi.mock("@/router/utils", () => ({ hasAuth: hasAuthMock }));

import { hasBatchSelection } from "../batchSelection";

beforeEach(() => hasAuthMock.mockReset());

describe("hasBatchSelection", () => {
  it("有框架批删权限即可勾选", () => {
    expect(hasBatchSelection({ batchDestroy: true }, [])).toBe(true);
  });

  it("无批删但任一页面批量动作有权限也可勾选", () => {
    hasAuthMock.mockImplementation(
      (code: string) => code === "batchUpdate:SystemRole"
    );
    expect(
      hasBatchSelection({ batchDestroy: false }, [
        "batchUpdate:SystemRole",
        "batchDelete:SystemRole"
      ])
    ).toBe(true);
  });

  it("没有任何批量权限时不渲染勾选列", () => {
    hasAuthMock.mockReturnValue(false);
    expect(
      hasBatchSelection({ batchDestroy: false }, ["batchUpdate:SystemRole"])
    ).toBe(false);
  });
});
