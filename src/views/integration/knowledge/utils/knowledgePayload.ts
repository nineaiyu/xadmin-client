/**
 * 知识库上传载荷（与后端契约同构的判别联合：文本直传 / 二进制解析二选一）。
 *
 * 内容组件（校验并产出载荷）与弹窗打开方（`useDialogForm` 的提交底座）共用
 * 同一份声明——此前类型只写在 SFC 内，打开方无法引用（`<script setup>` 的类型
 * 导出对 vue-tsc 不可见），只能靠 `Record<string, unknown>` 弱化，形同两处各写。
 */
export type UploadPayload =
  | { name: string; content: string }
  | { name: string; file_type: "pdf" | "docx"; file_b64: string };
