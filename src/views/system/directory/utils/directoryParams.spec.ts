import { describe, expect, it } from "vitest";
import { buildDirectoryParams } from "./directoryParams";

describe("buildDirectoryParams", () => {
  it("部门视角只传 dept，岗位视角只传 posts", () => {
    expect(
      buildDirectoryParams({
        mode: "dept",
        dept: "d1",
        post: "p1",
        keyword: " 张三 ",
        tags: []
      })
    ).toMatchObject({ dept: "d1", posts: "", keyword: "张三", tag: "" });

    expect(
      buildDirectoryParams({
        mode: "post",
        dept: "d1",
        post: "p1",
        keyword: "",
        tags: []
      })
    ).toMatchObject({ dept: "", posts: "p1", keyword: "" });
  });

  it("多标签按逗号拼接（后端 AND 语义），分页参数透传", () => {
    expect(
      buildDirectoryParams({
        mode: "dept",
        dept: "",
        post: "",
        keyword: "",
        tags: ["重点", "外包"],
        page: 2,
        size: 20
      })
    ).toMatchObject({
      tag: "重点,外包",
      page: 2,
      size: 20,
      ordering: "username"
    });
  });
});
