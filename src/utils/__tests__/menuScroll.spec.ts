import { describe, expect, it, vi } from "vitest";
import {
  applyMenuScroll,
  computeMenuScrollTop,
  findActiveMenuElement,
  measureMenuScroll
} from "../menuScroll";

const base = {
  itemTop: 0,
  itemHeight: 50,
  scrollTop: 0,
  viewportHeight: 400,
  scrollHeight: 2000
};

describe("computeMenuScrollTop", () => {
  it("激活项完整可见时不滚动", () => {
    expect(computeMenuScrollTop({ ...base, itemTop: 100 })).toBeNull();
  });

  it("恰好贴合上下边界不滚动", () => {
    expect(computeMenuScrollTop({ ...base, itemTop: 0 })).toBeNull();
    expect(
      computeMenuScrollTop({
        ...base,
        itemTop: 350,
        scrollTop: 0,
        viewportHeight: 400
      })
    ).toBeNull();
  });

  it("向上越界：项顶对齐容器顶", () => {
    expect(
      computeMenuScrollTop({ ...base, itemTop: 120, scrollTop: 300 })
    ).toBe(120);
  });

  it("向下越界：项底对齐容器底", () => {
    // 项 1000..1050，可视区 0..400 → 目标 650
    expect(computeMenuScrollTop({ ...base, itemTop: 1000 })).toBe(650);
  });

  it("越界目标钳制到内容范围（顶部不越界、底部不超滚）", () => {
    expect(
      computeMenuScrollTop({ ...base, itemTop: -20, scrollTop: 100 })
    ).toBe(0);
    expect(
      computeMenuScrollTop({
        ...base,
        itemTop: 1990,
        itemHeight: 50,
        scrollHeight: 2000
      })
    ).toBe(1600);
  });

  it("容器不可滚动（内容不超可视区）时返回 null", () => {
    expect(
      computeMenuScrollTop({
        ...base,
        scrollHeight: 300,
        viewportHeight: 400,
        itemTop: 100
      })
    ).toBeNull();
  });

  it("视口高度为 0（隐藏态）时返回 null", () => {
    expect(
      computeMenuScrollTop({ ...base, viewportHeight: 0, itemTop: 500 })
    ).toBeNull();
  });
});

function makeRect(top: number, height = 42): DOMRect {
  return {
    x: 0,
    y: top,
    top,
    left: 0,
    right: 120,
    bottom: top + height,
    width: 120,
    height,
    toJSON: () => ({})
  } as DOMRect;
}

/** 最小 DOMRectList 替身：可见性判定只消费 length */
function rectList(count: number): DOMRectList {
  return {
    length: count,
    item: (index: number) => (index < count ? makeRect(0) : null)
  } as DOMRectList;
}

/** jsdom 不做布局，getClientRects 默认为空；按需模拟「已渲染 / display:none」 */
function markRendered(el: Element) {
  Object.defineProperty(el, "getClientRects", {
    configurable: true,
    value: () => rectList(1)
  });
}

function menuDom() {
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <ul>
      <li class="el-sub-menu is-active">
        <div class="el-sub-menu__title">权限管理</div>
        <ul class="el-menu--inline">
          <li class="el-menu-item is-active">数据权限</li>
          <li class="el-menu-item">字段管理</li>
        </ul>
      </li>
    </ul>`;
  return {
    wrap,
    title: wrap.querySelector<HTMLElement>(".el-sub-menu__title")!,
    leaf: wrap.querySelector<HTMLElement>(".el-menu-item.is-active")!
  };
}

describe("findActiveMenuElement", () => {
  it("返回可见的激活叶子项", () => {
    const { wrap, leaf } = menuDom();
    markRendered(leaf);
    expect(findActiveMenuElement(wrap)).toBe(leaf);
  });

  it("激活叶子被折叠目录隐藏时不回退到目录标题（无可滚动目标）", () => {
    const { wrap, title } = menuDom();
    // 叶子保持 jsdom 默认的零 rect（等价 display:none），目录标题仍可见
    markRendered(title);
    expect(findActiveMenuElement(wrap)).toBeNull();
  });

  it("多个激活叶子时跳过隐藏项，取可见项", () => {
    const { wrap, leaf } = menuDom();
    const second = document.createElement("li");
    second.className = "el-menu-item is-active";
    wrap.appendChild(second);
    markRendered(second);
    expect(findActiveMenuElement(wrap)).toBe(second);
    expect(findActiveMenuElement(wrap)).not.toBe(leaf);
  });

  it("当前页为目录自身时取最深的可见激活目录标题", () => {
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <ul>
        <li class="el-sub-menu is-active">
          <div class="el-sub-menu__title">系统管理</div>
          <ul>
            <li class="el-sub-menu is-active">
              <div class="el-sub-menu__title">任务管理</div>
            </li>
          </ul>
        </li>
      </ul>`;
    const titles = wrap.querySelectorAll<HTMLElement>(".el-sub-menu__title");
    titles.forEach(title => markRendered(title));
    expect(findActiveMenuElement(wrap)).toBe(titles[1]);
  });
});

function asScrollWrap(wrap: HTMLElement) {
  Object.defineProperty(wrap, "scrollTop", {
    configurable: true,
    writable: true,
    value: 300
  });
  Object.defineProperty(wrap, "clientHeight", {
    configurable: true,
    value: 400
  });
  Object.defineProperty(wrap, "scrollHeight", {
    configurable: true,
    value: 2000
  });
  wrap.getBoundingClientRect = () => makeRect(50, 400);
  return wrap;
}

describe("measureMenuScroll", () => {
  it("隐藏的激活项不产生滚动目标", () => {
    const { wrap, title } = menuDom();
    markRendered(title);
    asScrollWrap(wrap);
    expect(measureMenuScroll({ wrapRef: wrap, scrollTo: vi.fn() })).toBeNull();
  });

  it("可见激活项越界时给出目标位置", () => {
    const { wrap, leaf } = menuDom();
    markRendered(leaf);
    // 项顶 550：itemTop = 550 - 50 + 300 = 800，项底 842，视口底 700 → 目标 442
    leaf.getBoundingClientRect = () => makeRect(550);
    asScrollWrap(wrap);
    expect(
      measureMenuScroll({ wrapRef: wrap, scrollTo: vi.fn() })?.target
    ).toBe(442);
  });
});

describe("applyMenuScroll", () => {
  it("平滑滚动一次，已在目标位置时不再滚动", () => {
    const wrap = asScrollWrap(document.createElement("div"));
    const scrollTo = vi.fn();
    const plan = { scrollbar: { wrapRef: wrap, scrollTo }, wrap, target: 442 };
    applyMenuScroll(plan);
    expect(scrollTo).toHaveBeenCalledWith({ top: 442, behavior: "smooth" });

    wrap.scrollTop = 442;
    scrollTo.mockClear();
    applyMenuScroll(plan);
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
