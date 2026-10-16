import { describe, expect, it } from "vitest";

import { createStack, Stack } from "./stack";

describe("Stack", () => {
  it("入栈 / 出栈 / 栈顶 / 长度", () => {
    const stack = new Stack<number>(false);
    expect(stack.size).toBe(0);
    stack.push(1, 2);
    expect(stack.size).toBe(2);
    expect(stack.peek()).toBe(2);
    expect(stack.pop()).toBe(2);
    expect(stack.toArray()).toEqual([1]);
  });

  it("去重模式：重复元素移到栈顶（不新增）", () => {
    const stack = createStack<string>();
    stack.push("a", "b", "a");
    expect(stack.toArray()).toEqual(["b", "a"]);
  });

  it("最大容量：越界丢弃最早入栈的元素", () => {
    const stack = new Stack<string>(false, 2);
    stack.push("a", "b", "c");
    expect(stack.toArray()).toEqual(["b", "c"]);
  });

  it("remove / retain / clear", () => {
    const stack = new Stack<string>(false);
    stack.push("a", "b", "c");
    stack.remove("b");
    expect(stack.toArray()).toEqual(["a", "c"]);
    stack.retain(["c", "d"]);
    expect(stack.toArray()).toEqual(["c"]);
    stack.clear();
    expect(stack.size).toBe(0);
    expect(stack.peek()).toBeUndefined();
  });

  it("toArray 返回浅拷贝，外部改动不污染栈内", () => {
    const stack = new Stack<number>(false);
    stack.push(1);
    const arr = stack.toArray();
    arr.push(2);
    expect(stack.size).toBe(1);
  });
});
