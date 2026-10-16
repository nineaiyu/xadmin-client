import { afterEach, describe, expect, it, vi } from "vitest";
import { measureOperationContentWidth } from "../src/utils/operationContentWidth";

/**
 * jsdom 不做布局（getBoundingClientRect 恒为 0），这里用「文本长度 × 8 + 内边距」
 * 模拟自然宽度，只验证测量流程：取表头与行内容的最大值、跳过空单元格、
 * 无数据行时不收敛、探测节点不残留。真实像素口径由 e2e/table-column-align.e2e.ts 守护。
 */
const stubLayout = () => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const padding =
        (parseFloat(this.style.paddingLeft) || 0) +
        (parseFloat(this.style.paddingRight) || 0);
      const text = (this.textContent ?? "").trim();
      return { width: text.length * 8 + padding } as DOMRect;
    }
  );
};

/** 构造表格结构：表头最后一列与每行最后一列即操作列 */
const buildRoot = (opContents: string[], headerText = "操作") => {
  const root = document.createElement("div");
  const header = document.createElement("div");
  header.className = "el-table__header-wrapper";
  header.innerHTML = `<table><thead><tr>
    <th><div class="cell">名称</div></th>
    <th><div class="cell">${headerText}</div></th>
  </tr></thead></table>`;
  const body = document.createElement("div");
  body.className = "el-table__body-wrapper";
  const table = document.createElement("table");
  const tbody = document.createElement("tbody");
  opContents.forEach(content => {
    const row = document.createElement("tr");
    row.className = "el-table__row";
    row.innerHTML = `<td><div class="cell">数据</div></td><td><div class="cell">${content}</div></td>`;
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  body.appendChild(table);
  root.append(header, body);
  document.body.appendChild(root);
  return root;
};

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("measureOperationContentWidth", () => {
  it("取各行内容的最大值（按钮随权限显隐时按实际渲染内容收敛）", () => {
    stubLayout();
    const root = buildRoot(["管理", "编辑删除管理", "编辑"], "操作");
    // 行内容最大 6 字 = 48（表头 2 字 = 16，不主导）
    expect(measureOperationContentWidth(root)).toBe(48);
  });

  it("表头比按钮宽时以表头为下限（列名同样不能被裁切）", () => {
    stubLayout();
    const root = buildRoot(["管理", "编辑"], "操作操作操作");
    expect(measureOperationContentWidth(root)).toBe(48);
  });

  it("没有数据行时返回 0（空表只量到表头，据此收窄会让下一屏数据溢出）", () => {
    stubLayout();
    const root = buildRoot([], "操作");
    expect(measureOperationContentWidth(root)).toBe(0);
  });

  it("单元格内容为空时返回 0（如操作列未渲染出按钮）", () => {
    stubLayout();
    const root = buildRoot([""], "");
    expect(measureOperationContentWidth(root)).toBe(0);
  });

  it("根节点缺失或未渲染表格时返回 0（调用方回落到页面配置宽度）", () => {
    stubLayout();
    expect(measureOperationContentWidth(undefined)).toBe(0);
    expect(measureOperationContentWidth(document.createElement("div"))).toBe(0);
  });

  it("探测容器同步移除，不残留在页面上", () => {
    stubLayout();
    const root = buildRoot(["管理"]);
    measureOperationContentWidth(root);
    expect(
      document.querySelectorAll("[data-re-plus-operation-probe]").length
    ).toBe(0);
  });
});
