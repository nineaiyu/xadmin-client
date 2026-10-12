/**
 * 栈数据结构（对齐 vben `@core/base/shared/src/utils/stack.ts`）。
 *
 * 支持可选去重与最大容量——用于「访问历史」「最近使用」一类需要
 * 去重且限定长度的有序集合（越界时丢弃最早入栈的元素）。
 */
export class Stack<T> {
  /** 栈内元素数量 */
  get size(): number {
    return this.items.length;
  }

  private items: T[] = [];
  private readonly dedup: boolean;
  private readonly maxSize?: number;

  constructor(dedup = true, maxSize?: number) {
    this.maxSize = maxSize;
    this.dedup = dedup;
  }

  /** 清空栈内元素 */
  clear(): void {
    this.items.length = 0;
  }

  /** 查看栈顶元素 */
  peek(): T | undefined {
    return this.items[this.items.length - 1];
  }

  /** 出栈 */
  pop(): T | undefined {
    return this.items.pop();
  }

  /** 入栈（去重模式下，已存在的元素先移除再追加到栈顶） */
  push(...items: T[]): void {
    items.forEach(item => {
      if (this.dedup) {
        const index = this.items.indexOf(item);
        if (index !== -1) {
          this.items.splice(index, 1);
        }
      }
      this.items.push(item);
      if (this.maxSize && this.items.length > this.maxSize) {
        this.items.splice(0, this.items.length - this.maxSize);
      }
    });
  }

  /** 移除栈内指定元素 */
  remove(...itemList: T[]): void {
    this.items = this.items.filter(i => !itemList.includes(i));
  }

  /** 仅保留栈内指定元素 */
  retain(itemList: T[]): void {
    this.items = this.items.filter(i => itemList.includes(i));
  }

  /** 转换为数组（浅拷贝） */
  toArray(): T[] {
    return [...this.items];
  }
}

/** 创建栈实例 */
export const createStack = <T>(dedup = true, maxSize?: number) =>
  new Stack<T>(dedup, maxSize);
