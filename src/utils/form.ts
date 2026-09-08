/**
 * FormData 上传协议 v1 序列化（ADR-007，协议文档见 xadmin-docs
 * `advanced/form-data-upload.md`）。
 *
 * 把嵌套对象展开为点分键 FormData（`.` 分层、数字段 = 数组下标），
 * 与服务端 AxiosMultiPartParser 的还原规则一一对应：
 *
 * ```ts
 * dataToFormData({ name: "书", covers: [{ value: "2", pk: "2" }] })
 *   → name=书  covers.0.value=2  covers.0.pk=2
 * ```
 *
 * 文件上传路径显式调用本工具构造 FormData，不再依赖 axios
 * `formSerializer` 的隐式展开行为；换用任意 HTTP 库只需保持此键格式。
 */

/** 是否为浏览器 File 对象（File 是 Blob 子类） */
const isFile = (value: unknown): value is File =>
  typeof File !== "undefined" && value instanceof File;

/**
 * 将对象按协议 v1 展开为 FormData。
 * - 嵌套对象：`a.b`；数组：`a.0`、`a.1`；
 * - `null` / `undefined` 字段跳过（缺省走服务端默认值）；
 * - 其余标量 `String()` 化，布尔输出 `"true"` / `"false"`。
 */
export function dataToFormData(data: object): FormData {
  const formData = new FormData();

  const append = (prefix: string, value: unknown) => {
    if (value === null || value === undefined) return;
    if (isFile(value)) {
      formData.append(prefix, value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => append(`${prefix}.${index}`, item));
      return;
    }
    if (typeof value === "object") {
      for (const [key, child] of Object.entries(value)) {
        append(`${prefix}.${key}`, child);
      }
      return;
    }
    formData.append(prefix, String(value));
  };

  for (const [key, value] of Object.entries(data)) {
    append(key, value);
  }
  return formData;
}
