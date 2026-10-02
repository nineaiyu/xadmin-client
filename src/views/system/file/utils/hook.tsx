import { useI18n } from "vue-i18n";
import { systemUploadFileApi } from "@/api/system/file";
import { hasAuth, usePageAuth } from "@/router/utils";
import {
  isReadonlyCell,
  openDialogDrawer,
  type OperationProps,
  type PageTableColumn,
  renderBooleanTag,
  type RePlusPageProps,
  formatPageColumns
} from "@/components/RePlusPage";
import { h, reactive, shallowRef, type Ref } from "vue";
import uploadForm from "../components/FileUpload.vue";
import AccessLogPanel from "../components/AccessLogPanel.vue";
import { openPreviewDrawer } from "../components/previewDrawer";
import { addDrawer } from "@/components/ReDrawer";
import { usePublicHooks } from "@/views/system/hooks";
import { ElButton, ElIcon, ElLink, ElText } from "element-plus";
import { Link } from "@element-plus/icons-vue";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { renderTagsCell } from "@/utils/tagTone";
import { TAGGABLE_RESOURCE } from "@/api/system/tag";
import type { RecordType } from "plus-pro-components";
import Upload from "~icons/ep/upload";
import Tag from "~icons/ri/price-tag-3-line";
import { formatBytes } from "@pureadmin/utils";
import { withFileUrlRequiredRule } from "./fileFormRules";
import { useFileTagActions } from "./useFileTagActions";
import { useFileQuotaStats } from "./useFileQuotaStats";

export function useSystemUploadFile(tableRef: Ref) {
  const { t } = useI18n();

  const api = reactive(systemUploadFileApi);

  const { tagStyle } = usePublicHooks();

  const auth = usePageAuth();
  auth.upload = hasAuth("upload:SystemUploadFile");
  auth.config = hasAuth("config:SystemUploadFile");
  auth.preview = hasAuth("preview:SystemUploadFile");

  // 通用标签：行内打标（单对象全量替换）与工具栏批量打标共用同一弹窗；
  // 入口按全局 assign:Tag 权限点显示，对象级 update 权限由后端逐对象复核
  const {
    canAssignTags,
    openTagDialog,
    selectedNum,
    handleBatchTags,
    selectionChange
  } = useFileTagActions({ tableRef });

  // 配额统计与分类下拉（搜索区）
  const { stats, loadStats, searchColumnsFormat } = useFileQuotaStats({
    hasListAuth: Boolean(auth.list)
  });

  /** 访问记录抽屉（上传 / 下载 / 预览 / 删除留痕） */
  const openAccessLogs = (row: RecordType) => {
    addDrawer({
      title: t("fileAccess.accessLogsTitle", { name: row?.filename ?? "" }),
      size: "50%",
      destroyOnClose: true,
      hideFooter: true,
      props: { row },
      contentRenderer: () => h(AccessLogPanel)
    });
  };

  const operationButtonsProps = shallowRef<OperationProps>({
    width: 280,
    buttons: [
      {
        text: t("fileAccess.download"),
        code: "download",
        props: { type: "success", link: true },
        onClick: async ({ row }) => {
          // 下载走受鉴权端点（服务端记访问审计），不再使用 /media/ 直链
          await api.download(row?.pk, row?.filename);
        },
        show: true
      },
      {
        text: t("fileAccess.accessLogs"),
        code: "accessLogs",
        props: { type: "info", link: true },
        onClick: ({ row }) => openAccessLogs(row as RecordType),
        show: true
      },
      {
        // 行内打标：单对象全量替换语义（弹窗内可选标签/就地新建）
        text: t("tag.assignTitle"),
        code: "assignTags",
        props: { type: "warning", link: true },
        onClick: ({ row }) =>
          openTagDialog({
            resource: TAGGABLE_RESOURCE.file,
            row: row as RecordType
          }),
        show: canAssignTags
      }
    ]
  });

  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [
      {
        code: "upload",
        text: t("systemUploadFile.upload"),
        props: {
          type: "success",
          icon: useRenderIcon(Upload)
        },
        onClick: () => {
          openDialogDrawer({
            t,
            title: t("systemUploadFile.upload"),
            rawRow: {},
            rawColumns: [],
            dialogDrawerOptions: { width: "600px", hideFooter: true },
            minWidth: "600px",
            form: uploadForm,
            props: {
              // 弹层 props 的函数值会被 openDialogDrawer 立即求值（resolveSpec），
              // 因此这里返回一个带 handleGetData 的对象；上传成功后同时刷新
              // 列表与顶部配额卡片（upload.vue 消费 handleGetData）
              tableRef: () => ({
                handleGetData: () => {
                  tableRef.value?.handleGetData?.();
                  loadStats(true);
                }
              })
            }
          });
        },
        show: auth.upload && auth.config && 3
      },
      {
        // 批量打标：勾选后一次性追加/移除/替换（与用户管理页同一弹窗）
        text: t("tag.batchAssignTitle"),
        code: "batchTags",
        props: {
          type: "primary",
          icon: useRenderIcon(Tag),
          plain: true
        },
        onClick: () => handleBatchTags(),
        show: () => Boolean(canAssignTags && selectedNum.value)
      }
    ]
  });

  const addOrEditOptions = shallowRef<RePlusPageProps["addOrEditOptions"]>({
    props: {
      formProps: {
        // 上传登记/存量外链行要求 file_url 为合法 URL（规则见 fileFormRules，可单测直测）
        rules: ({
          rawFormProps: { rules },
          isAdd,
          rawRow
        }: {
          rawFormProps: { rules: RecordType };
          isAdd?: boolean;
          rawRow?: RecordType;
        }) => withFileUrlRequiredRule(rules, { isAdd, rawRow })
      }
    }
  });

  const formatisCameluploadisCameltmpColumn = (column: PageTableColumn) => {
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
          // 回收站只读：不提供下载入口，降级为纯文本地址
          if (isReadonlyCell(scope)) {
            return h("span", scope.row[column._column?.key as string] ?? "");
          }
          return h(
            ElLink,
            {
              type: "success",
              href: scope.row[column._column?.key as string],
              target: "_blank"
            },
            {
              icon: () => h(ElIcon, null, () => h(Link)),
              default: () => t("systemUploadFile.fileLink")
            }
          );
        };
      },
      is_upload: formatisCameluploadisCameltmpColumn,
      is_tmp: formatisCameluploadisCameltmpColumn,
      preview_kind: column => {
        // 行内预览入口走 cellRenderer：操作列 slot 传入的 row 是空对象
        // （框架现状），行级显隐只能在列渲染里取到真实行数据
        column["cellRenderer"] = scope => {
          const { row } = scope;
          // 回收站只读：不提供预览入口
          if (isReadonlyCell(scope)) return h("span", "-");
          if (!row?.preview_kind || !auth.preview) return h("span", "-");
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
  return {
    api,
    auth,
    stats,
    loadStats,
    searchColumnsFormat,
    listColumnsFormat,
    addOrEditOptions,
    tableBarButtonsProps,
    operationButtonsProps,
    selectionChange
  };
}
