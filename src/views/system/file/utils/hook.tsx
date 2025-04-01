import { useI18n } from "vue-i18n";
import { systemUploadFileApi } from "@/api/system/file";
import { getDefaultAuths, hasAuth } from "@/router/utils";
import { getCurrentInstance, h, reactive, type Ref, shallowRef } from "vue";
import {
  type PageTableColumn,
  isUrl,
  openFormDialog,
  type OperationProps,
  renderBooleanTag,
  type RePlusPageProps
} from "@/components/RePlusPage";
import uploadForm from "../components/upload.vue";
import { usePublicHooks } from "@/views/system/hooks";
import { ElIcon, ElLink, ElText } from "element-plus";
import { Link } from "@element-plus/icons-vue";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import Upload from "~icons/ep/upload";
import { formatBytes } from "@pureadmin/utils";

export function useSystemUploadFile(tableRef: Ref) {
  const { t } = useI18n();

  const api = reactive(systemUploadFileApi);

  const { tagStyle } = usePublicHooks();

  const auth = reactive({
    ...getDefaultAuths(getCurrentInstance()),
    upload: hasAuth("create:SystemUploadFile"),
    config: hasAuth("retrieve:SystemUploadFile")
  });

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
          openFormDialog({
            t,
            title: t("systemUploadFile.upload"),
            rawRow: {},
            rawColumns: [],
            dialogOptions: { width: "600px", hideFooter: true },
            minWidth: "600px",
            form: uploadForm,
            props: {
              tableRef: () => {
                return tableRef;
              }
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
        rules: ({ rawFormProps: { rules }, isAdd, rawRow }) => {
          if (isAdd || !rawRow?.is_upload) {
            const fileUrlRule = rules["file_url"][0];
            rules["file_url"] = [
              {
                required: true,
                validator: (rule, value, callback) => {
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
          column["cellRenderer"] = ({ row }) =>
            h(
              ElLink,
              {
                type: "success",
                href: row[column._column?.key],
                target: "_blank"
              },
              {
                icon: () => h(ElIcon, null, () => h(Link)),
                default: () => t("systemUploadFile.fileLink")
              }
            );
          break;
        case "is_upload":
          column["cellRenderer"] = renderBooleanTag({
            t,
            tagStyle,
            field: column.prop
          });
          break;
        case "filesize":
          column["cellRenderer"] = ({ row }) =>
            h(ElText, { type: "primary" }, () => {
              return formatBytes(row[column._column?.key]);
            });
      }
    });
    return columns;
  };
  return {
    api,
    auth,
    listColumnsFormat,
    addOrEditOptions,
    tableBarButtonsProps,
    operationButtonsProps
  };
}
