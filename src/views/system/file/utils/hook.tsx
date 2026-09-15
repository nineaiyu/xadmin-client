import { SUCCESS_CODE } from "@/api/types";
import { useI18n } from "vue-i18n";
import { systemUploadFileApi } from "@/api/system/file";
import { getDefaultAuths, hasAuth } from "@/router/utils";
import {
  computed,
  getCurrentInstance,
  h,
  onMounted,
  reactive,
  ref,
  type Ref,
  shallowRef
} from "vue";
import {
  isReadonlyCell,
  isUrl,
  openDialogDrawer,
  type OperationProps,
  type PageColumn,
  type PageTableColumn,
  renderBooleanTag,
  type RePlusPageProps
} from "@/components/RePlusPage";
import uploadForm from "../components/FileUpload.vue";
import { openPreviewDrawer } from "../components/previewDrawer";
import { usePublicHooks } from "@/views/system/hooks";
import { ElButton, ElIcon, ElLink, ElText } from "element-plus";
import { Link } from "@element-plus/icons-vue";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import type { RecordType } from "plus-pro-components";
import Upload from "~icons/ep/upload";
import { formatBytes } from "@pureadmin/utils";
import { getDictItems } from "@/utils/dict";

/** 分类分布项（stats.category_stats）：value 为 null 表示未分类 */
export type FileCategoryStat = {
  value: string | null;
  /** 分类展示名来自 upload_category 字典；未分类为 null（前端 i18n 兜底） */
  label: string | null;
  color: string | null;
  count: number;
  size: number;
};

/** 单日上传趋势（stats.recent_trend，后端已补齐缺失日期） */
export type FileTrendPoint = {
  date: string;
  count: number;
  size: number;
};

/** 占用空间最大的文件（stats.top_files） */
export type FileTopItem = {
  pk: string;
  filename: string;
  filesize: number;
};

/** 个人文件统计载荷（system/views/admin/file.py::stats） */
export type FileStats = {
  count: number;
  total_size: number;
  quota_mb: number;
  usage_rate: number;
  /** 剩余空间：无配额（0=不限）时为 null，前端显示「不限」 */
  remaining_size: number | null;
  avg_size: number;
  category_stats: FileCategoryStat[];
  recent_trend: FileTrendPoint[];
  top_files: FileTopItem[];
};

/** 分类字典 code：与 UploadFileSerializer.category 的 DictChoiceField 同源 */
const UPLOAD_CATEGORY_DICT = "upload_category";

export function useSystemUploadFile(tableRef: Ref) {
  const { t } = useI18n();

  const api = reactive(systemUploadFileApi);

  const { tagStyle } = usePublicHooks();

  const auth = reactive({
    ...getDefaultAuths(getCurrentInstance()),
    upload: hasAuth("upload:SystemUploadFile"),
    config: hasAuth("config:SystemUploadFile"),
    preview: hasAuth("preview:SystemUploadFile")
  });

  // 个人配额统计：顶部使用率卡片数据源（服务端 10s 短缓存）
  const stats = ref<FileStats | null>(null);
  const loadStats = (fresh = false) => {
    // 无列表权限时页面不渲染，也不发起统计请求（避免无谓的 403 提示）
    if (!auth.list) return;
    // fresh=true 走 ?no_cache=1 旁路服务端短缓存（上传后立即刷新场景）
    systemUploadFileApi
      .stats(fresh ? { no_cache: "1" } : undefined)
      .then(res => {
        if (res.code === SUCCESS_CODE) stats.value = res.data as FileStats;
      });
  };
  onMounted(loadStats);

  // 分类下拉选项：category 在后端是 CharFilter（search-fields 元数据无 choices），
  // 选项来源与 DictChoiceField 保持同源（upload_category 字典），保证与表单下拉一致
  const categoryOptions = ref<Array<{ label: string; value: unknown }>>([]);
  getDictItems(UPLOAD_CATEGORY_DICT).then(items => {
    categoryOptions.value = items.map(item => ({
      label: String(item.label ?? item.value ?? ""),
      value: item.value
    }));
  });

  const searchColumnsFormat = (columns: PageColumn[]) => {
    columns.forEach(column => {
      if (column._column?.key === "category") {
        column.valueType = "select";
        column.fieldProps = {
          teleported: false,
          filterable: true,
          clearable: true
        };
        column.options = computed(() => categoryOptions.value);
      }
    });
    return columns;
  };

  const operationButtonsProps = shallowRef<OperationProps>({});

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
      }
    ]
  });

  const addOrEditOptions = shallowRef<RePlusPageProps["addOrEditOptions"]>({
    props: {
      formProps: {
        rules: ({
          rawFormProps: { rules },
          isAdd,
          rawRow
        }: {
          rawFormProps: { rules: RecordType };
          isAdd?: boolean;
          rawRow?: RecordType;
        }) => {
          if (isAdd || !rawRow?.is_upload) {
            const fileUrlRule = rules["file_url"][0];
            rules["file_url"] = [
              {
                required: true,
                validator: (
                  _rule: unknown,
                  value: string,
                  callback: (error?: Error) => void
                ) => {
                  if (!isUrl(value)) {
                    callback(new Error(fileUrlRule?.message));
                  } else {
                    callback();
                  }
                },
                trigger: "blur"
              }
            ];
          }
          return rules;
        }
      }
    }
  });

  const listColumnsFormat = (columns: PageTableColumn[]) => {
    columns.forEach(column => {
      switch (column._column?.key) {
        case "access_url":
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
          break;
        case "is_upload":
        case "is_tmp":
          column["cellRenderer"] = renderBooleanTag({
            t,
            tagStyle,
            field: column.prop as string,
            actionMap: { true: t("labels.yes"), false: t("labels.no") }
          });
          break;
        case "preview_kind":
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
          break;
        case "filesize":
          column["cellRenderer"] = ({ row }) =>
            h(ElText, { type: "primary" }, () => {
              return formatBytes(row[column._column?.key as string]);
            });
      }
    });
    return columns;
  };
  return {
    api,
    auth,
    stats,
    loadStats,
    searchColumnsFormat,
    listColumnsFormat,
    addOrEditOptions,
    tableBarButtonsProps,
    operationButtonsProps
  };
}
