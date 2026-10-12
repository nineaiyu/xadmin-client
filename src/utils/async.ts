/**
 * Promise 结果元组化（await-to 模式，对齐 vben `@core/base/shared/src/utils/to.ts`）。
 *
 * 把 `try/catch` 收敛为元组解构，避免每个调用点重复写异常分支。
 */
export async function to<T, U = Error>(
  promise: Readonly<Promise<T>>,
  errorExt?: object
): Promise<[null, T] | [U, undefined]> {
  try {
    const data = await promise;
    return [null, data];
  } catch (error) {
    if (errorExt) {
      return [Object.assign({}, error, errorExt) as U, undefined];
    }
    return [error as U, undefined];
  }
}
