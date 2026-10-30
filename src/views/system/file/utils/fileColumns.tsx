import { h, ref } from "vue";
import { ElButton, ElIcon, ElLink, ElText } from "element-plus";
import { Link } from "@element-plus/icons-vue";
import { formatBytes } from "@pureadmin/utils";
import {
  formatPageColumns,
  isReadonlyCell,
  renderBooleanTag,
  type PageTableColumn
} from "@/components/RePlusPage";
import { renderTagsCell } from "@/utils/tagTone";
import { openPreviewDrawer } from "../components/previewDrawer";
import type { useI18n } from "vue-i18n";
import type { usePublicHooks } from "@/views/system/hooks";
import type { RecordType } from "plus-pro-components";

type TFunction = ReturnType<typeof useI18n>["t"];
type TagStyle = ReturnType<typeof usePublicHooks>["tagStyle"];

/**
 * 文件列表列渲染（自 hook.tsx 抽出）：访问链接、上传/临时标记、行内预览入口、
 * 文件大小与标签列。
 *
 * `access_url` 对上传文件不再渲染 `/media/` 直链（该路径只校验登录态，
 * 不校验文件行级数据权限、也不记 FileAccessLog），改为复用受鉴权下载动作；
 * 只有外链登记行（`is_upload=false`）保留直接打开——地址本身就在外部。
 */
export function buildFileColumns({
  t,
  tagStyle,
  canPreview,
  canDownload,
  onDownload
}: {
  t: TFunction;
  tagStyle: TagStyle;
  canPreview?: boolean;
  canDownload?: boolean;
  onDownload?: (row: RecordType) => void | Promise<void>;
}) {
  /** 下载中的行键：避免重复点击，并给按钮 loading 反馈 */
  const downloadingKey = ref("");
  const formatYesNoColumn = (column: PageTableColumn) => {
    column["cellRenderer"] = renderBooleanTag({
      t,
      tagStyle,
      field: column.prop as string,
      actionMap: { true: t("labels.yes"), false: t("labels.no") }
    });
  };

  const listColumnsFormat = (columns: PageTableColumn[]) =>
    formatPageColumns(columns, {
      access_url: column => {
        column["cellRenderer"] = scope => {
          const { row } = scope;
          const url = row?.[column._column?.key as string];
          // 回收站只读：不提供下载入口，降级为纯文本地址
          if (isReadonlyCell(scope)) {
            return h("span", url ?? "");
          }
          // 外链登记行：地址本身即外部 URL，保持直接打开
          if (!row?.is_upload) {
            if (!url) return h("span", "-");
            return h(
              ElLink,
              {
                type: "success",
                href: url,
                target: "_blank",
                rel: "noopener noreferrer"
              },
              {
                icon: () => h(ElIcon, null, () => h(Link)),
                default: () => t("systemUploadFile.fileLink")
              }
            );
          }
          // 上传文件：/media/ 直链只校验登录态，不记访问审计；
          // 统一复用受鉴权下载动作（数据权限 + FileAccessLog）
          if (!canDownload) return h("span", "-");
          return h(
            ElButton,
            {
              link: true,
              type: "success",
              loading: downloadingKey.value === String(row?.pk ?? ""),
              onClick: async () => {
                const key = String(row?.pk ?? "");
                if (downloadingKey.value === key) return;
                downloadingKey.value = key;
                try {
                  await onDownload?.(row as RecordType);
                } finally {
                  downloadingKey.value = "";
                }
              }
            },
            () => t("fileAccess.download")
          );
        };
      },
      is_upload: formatYesNoColumn,
      is_tmp: formatYesNoColumn,
      preview_kind: column => {
        // 行内预览入口走 cellRenderer：操作列 slot 传入的 row 是空对象
        // （框架现状），行级显隐只能在列渲染里取到真实行数据
        column["cellRenderer"] = scope => {
          const { row } = scope;
          // 回收站只读：不提供预览入口
          if (isReadonlyCell(scope)) return h("span", "-");
          if (!row?.preview_kind || !canPreview) return h("span", "-");
          return h(
            ElButton,
            {
              link: true,
              type: "primary",
              onClick: () =>
                openPreviewDrawer({
                  pk: row.pk,
                  filename: row.filename,
                  mime_type: row.mime_type,
                  preview_kind: row.preview_kind
                })
            },
            () => t("systemUploadFile.preview")
          );
        };
      },
      filesize: column => {
        column["cellRenderer"] = ({ row }) =>
          h(ElText, { type: "primary" }, () => {
            return formatBytes(row[column._column?.key as string]);
          });
      },
      tags: column => {
        // 通用标签：数组字段需页面自渲染（框架对数组只做 String 化）
        column["cellRenderer"] = renderTagsCell;
      }
    });

  return { listColumnsFormat };
}
