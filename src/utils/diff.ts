/**
 * 对象/数组差异计算。
 *
 * `diff` 以「数组不看顺序」比较，`diffStrict` 以「数组看顺序」比较；
 * 多个数组元素差异一律整体取新值，其余嵌套对象只保留发生变化的键。
 */

export type DiffResult<T> = Partial<{
  [K in keyof T]: T[K] extends object ? DiffResult<T[K]> : T[K];
}>;

type ArrayComparator = (a: unknown[], b: unknown[]) => boolean;

/** 数组是否相等（忽略顺序与重复计数） */
export function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  const counter = new Map<T, number>();
  for (const value of a) {
    counter.set(value, (counter.get(value) || 0) + 1);
  }
  for (const value of b) {
    const count = counter.get(value);
    if (count === undefined || count === 0) {
      return false;
    }
    counter.set(value, count - 1);
  }
  return true;
}

/** 数组是否相等（顺序敏感） */
export function arraysStrictEqual<T>(a: T[], b: T[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function createDiff(arrayEquals: ArrayComparator) {
  function findDifferences(o1: unknown, o2: unknown): unknown {
    if (Array.isArray(o1) && Array.isArray(o2)) {
      return arrayEquals(o1, o2) ? undefined : o2;
    }

    const r1 = asRecord(o1);
    const r2 = asRecord(o2);
    if (r1 && r2) {
      const diffResult: Record<string, unknown> = {};
      const keys = new Set([...Object.keys(r1), ...Object.keys(r2)]);
      keys.forEach(key => {
        const valueDiff = findDifferences(r1[key], r2[key]);
        if (valueDiff !== undefined) {
          diffResult[key] = valueDiff;
        }
      });
      return Object.keys(diffResult).length > 0 ? diffResult : undefined;
    }

    return o1 === o2 ? undefined : o2;
  }

  return function diff<T extends object>(obj1: T, obj2: T): DiffResult<T> {
    return findDifferences(obj1, obj2) as DiffResult<T>;
  };
}

/** 差异计算（数组忽略顺序） */
export const diff = createDiff(arraysEqual);

/** 差异计算（数组顺序敏感） */
export const diffStrict = createDiff(arraysStrictEqual);
