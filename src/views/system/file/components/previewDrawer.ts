import { h } from "vue";
import { addDrawer } from "@/components/ReDrawer";

import PreviewDrawer from "./PreviewDrawer.vue";

/** 打开预览抽屉的行数据（类型由后端 `preview_kind` 判定，前端不重复判 mime） */
export type PreviewRow = {
  pk: string | number;
  filename?: string;
  mime_type?: string;
  preview_kind?: string | null;
};

/**
 * 打开文件预览抽屉（图片大图 / PDF 内嵌 / 文本只读）。
 *
 * 与列表行内「预览」按钮共用同一入口，避免"两个入口两种口径"。
 */
export function openPreviewDrawer(row: PreviewRow) {
  addDrawer({
    title: `${row.filename ?? ""} - ${row.pk}`.replace(/^-\s*/, ""),
    size: "50%",
    destroyOnClose: true,
    closeOnClickModal: true,
    hideFooter: true,
    props: { row },
    contentRenderer: () => h(PreviewDrawer)
  });
}
