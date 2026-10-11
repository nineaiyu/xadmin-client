import { afterEach, describe, expect, it } from "vitest";

import { syncPaginationA11y, syncTableA11y } from "../tableA11y";

/**
 * 表格可访问名同步（EP 渲染后的 DOM 收口）：
 * - 表格：两张原生 `<table>` 写 aria-label，说明节点建立 aria-describedby；
 * - 分页器：内部「每页条数」下拉补 aria-label（EP 无 props 入口）。
 * 两函数均幂等、只覆盖同名属性。
 */

function mount(html: string): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.appendChild(root);
  return root;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("syncTableA11y", () => {
  it("空根节点直接返回 0", () => {
    expect(syncTableA11y(null, "数据表格")).toBe(0);
    expect(syncTableA11y(undefined, "数据表格")).toBe(0);
  });

  it("表头 / 表体两张原生表都写 aria-label", () => {
    const root = mount(`
      <table class="el-table__header"></table>
      <table class="el-table__body"></table>
      <table class="el-table__footer"></table>
    `);
    expect(syncTableA11y(root, "用户管理")).toBe(2);
    expect(
      root.querySelector(".el-table__header")?.getAttribute("aria-label")
    ).toBe("用户管理");
    expect(
      root.querySelector(".el-table__body")?.getAttribute("aria-label")
    ).toBe("用户管理");
    expect(
      root.querySelector(".el-table__footer")?.getAttribute("aria-label")
    ).toBe(null);
  });

  it("存在说明节点时建立 aria-describedby 并补 id；无说明节点时移除关联", () => {
    const root = mount(`
      <div data-table-a11y-desc>元数据缺失</div>
      <table class="el-table__body"></table>
    `);
    syncTableA11y(root, "用户管理");
    const desc = root.querySelector("[data-table-a11y-desc]")!;
    const table = root.querySelector(".el-table__body")!;
    expect(desc.id).not.toBe("");
    expect(table.getAttribute("aria-describedby")).toBe(desc.id);

    root.querySelector("[data-table-a11y-desc]")!.remove();
    syncTableA11y(root, "用户管理");
    expect(table.hasAttribute("aria-describedby")).toBe(false);
  });

  it("重复调用幂等（同名属性只覆盖、不新增）", () => {
    const root = mount(`<table class="el-table__body"></table>`);
    syncTableA11y(root, "表格一");
    syncTableA11y(root, "表格一");
    syncTableA11y(root, "表格二");
    expect(root.querySelectorAll("table").length).toBe(1);
    expect(
      root.querySelector(".el-table__body")?.getAttribute("aria-label")
    ).toBe("表格二");
  });
});

describe("syncPaginationA11y", () => {
  it("空根节点或空标签直接返回 0", () => {
    expect(syncPaginationA11y(null, "每页条数")).toBe(0);
    const root = mount(`<div class="el-pagination"></div>`);
    expect(syncPaginationA11y(root, "")).toBe(0);
  });

  it("只给分页器内的下拉补 aria-label，其它下拉不受影响", () => {
    const root = mount(`
      <div class="el-pagination">
        <input class="el-select__input" />
      </div>
      <div class="el-select">
        <input class="el-select__input" />
      </div>
    `);
    expect(syncPaginationA11y(root, "每页条数")).toBe(1);
    const [inside, outside] = root.querySelectorAll(".el-select__input");
    expect(inside.getAttribute("aria-label")).toBe("每页条数");
    expect(outside.getAttribute("aria-label")).toBe(null);
  });

  it("重复调用幂等，标签变化时覆盖", () => {
    const root = mount(`
      <div class="el-pagination">
        <input class="el-select__input" />
      </div>
    `);
    syncPaginationA11y(root, "每页条数");
    syncPaginationA11y(root, "每页条数");
    expect(root.querySelectorAll("input").length).toBe(1);
    expect(root.querySelector("input")?.getAttribute("aria-label")).toBe(
      "每页条数"
    );

    syncPaginationA11y(root, "Items per page");
    expect(root.querySelector("input")?.getAttribute("aria-label")).toBe(
      "Items per page"
    );
  });
});
