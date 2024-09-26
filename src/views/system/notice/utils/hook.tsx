import { computed, h, reactive, type Ref, shallowRef } from "vue";
import { noticeApi } from "@/api/system/notice";
import { useRouter } from "vue-router";
import { deviceDetection } from "@pureadmin/utils";
import { addDialog } from "@/components/ReDialog";
import { hasAuth } from "@/router/utils";
import { useI18n } from "vue-i18n";
import { NoticeChoices } from "@/views/system/constants";
import type {
  CRUDColumn,
  OperationProps,
  RePlusPageProps
} from "@/components/RePlusPage";
import NoticeShowForm from "@/views/system/components/NoticeShow.vue";
import WangEditor from "@/components/RePlusPage/src/components/WangEditor.vue";

export function useNotice(tableRef: Ref) {
  const { t } = useI18n();

  const api = reactive(noticeApi);
  api.update = api.patch;

  const auth = reactive({
    list: hasAuth("list:systemNotice"),
    create: hasAuth("create:systemNotice"),
    delete: hasAuth("delete:systemNotice"),
    update: hasAuth("update:systemNotice"),
    publish: hasAuth("update:systemNoticePublish"),
    detail: hasAuth("detail:systemNotice"),
    batchDelete: hasAuth("batchDelete:systemNotice")
  });

  const operationButtonsProps = shallowRef<OperationProps>({
    width: 200,
    buttons: [
      {
        code: "update",
        update: true, // update:true 意味着我要更新这个按钮部分信息到默认的按钮信息，只更新props这个信息
        props: (row, button) => {
          const disabled = row?.notice_type?.value === NoticeChoices.SYSTEM;
          return {
            ...(button?._?.props ?? {}), // button?._ 这个表示之前老的按钮信息
            ...{ disabled, type: disabled ? "default" : "primary" }
          };
        }
      },
      {
        code: "detail",
        onClick({ row }) {
          addDialog({
            title: t("systemNotice.showSystemNotice"),
            props: {
              formInline: { ...row },
              hasPublish: true
            },
            width: "60%",
            draggable: true,
            fullscreen: deviceDetection(),
            fullscreenIcon: true,
            closeOnClickModal: false,
            hideFooter: true,
            contentRenderer: () => h(NoticeShowForm)
          });
        },
        update: true
      }
    ]
  });
  const listColumnsFormat = (columns: CRUDColumn[]) => {
    columns.forEach(column => {
      switch (column._column?.key) {
        case "title":
          column["cellRenderer"] = ({ row }) => (
            <el-text type={row.level?.value}>{row.title}</el-text>
          );
          break;
        case "read_user_count":
          column["cellRenderer"] = ({ row }) => (
            <el-link
              type={row.level?.value}
              onClick={() => onGoNoticeReadDetail(row as any)}
            >
              {row.notice_type?.value === NoticeChoices.NOTICE
                ? t("systemNotice.allRead")
                : row.user_count}
              /{row.read_user_count}
            </el-link>
          );
          column["minWidth"] = 140;
          break;
      }
    });
    return columns;
  };

  const addOrEditOptions = shallowRef<RePlusPageProps["addOrEditOptions"]>({
    props: {
      columns: {
        level: ({ column }) => {
          column?.options.forEach(option => {
            option["fieldSlot"] = () => {
              return (
                <el-text type={option.value?.value}> {option.label}</el-text>
              );
            };
          });
          return column;
        },
        files: ({ column }) => {
          column.hideInForm = true;
          return column;
        },
        notice_type: ({ column, isAdd }) => {
          if (!isAdd) {
            column["fieldProps"]["disabled"] = true;
          }
          column?.options.forEach(option => {
            if (option.value?.value == NoticeChoices.SYSTEM) {
              option.fieldItemProps.disabled = true;
            }
            if (option.value?.value == NoticeChoices.NOTICE) {
              if (!hasAuth("create:systemAnnouncement")) {
                option.fieldItemProps.disabled = true;
              }
            }
          });
          return column;
        },
        notice_user: ({ column, formValue }) => {
          column["hideInForm"] = computed(() => {
            return !(
              formValue.value?.notice_type?.value === NoticeChoices.USER &&
              hasAuth("list:systemSearchUser")
            );
          });
          return column;
        },
        notice_dept: ({ column, formValue }) => {
          column["hideInForm"] = computed(() => {
            return !(
              formValue.value?.notice_type?.value === NoticeChoices.DEPT &&
              hasAuth("list:systemSearchDept")
            );
          });
          return column;
        },
        notice_role: ({ column, formValue }) => {
          column["hideInForm"] = computed(() => {
            return !(
              formValue.value?.notice_type?.value === NoticeChoices.ROLE &&
              hasAuth("list:systemSearchRole")
            );
          });
          return column;
        },
        message: ({ column, formValue }) => {
          column["hasLabel"] = false;
          column["renderField"] = (value, onChange) => {
            return h(WangEditor, {
              modelValue: value,
              onChange: ({ messages, files }) => {
                onChange(messages);
                formValue.value.files = files;
              }
            });
          };
          return column;
        }
      },
      minWidth: "600px",
      dialogOptions: {
        top: "10vh",
        width: "60vw"
      }
    },
    apiReq: ({ isAdd, formData }) => {
      if (isAdd) {
        if (
          formData?.notice_type?.value === NoticeChoices.NOTICE &&
          hasAuth("create:systemAnnouncement")
        ) {
          return api.announcement(formData);
        }
      }
    }
  });

  const router = useRouter();

  function onGoNoticeReadDetail(row: any) {
    if (hasAuth("list:systemNoticeRead") && row.pk) {
      router.push({
        name: "SystemNoticeRead",
        query: { notice_id: row.pk }
      });
    }
  }

  const searchComplete = ({ routeParams, searchFields }) => {
    if (
      routeParams.notice_user &&
      searchFields.value.notice_user &&
      searchFields.value.notice_user !== ""
    ) {
      const row = {
        notice_user: JSON.parse(routeParams.notice_user),
        notice_type: { value: NoticeChoices.USER }
      };
      searchFields.value.notice_user = "";
      tableRef.value.handleAddOrEdit(true, row);
    }
  };

  return {
    api,
    auth,
    addOrEditOptions,
    listColumnsFormat,
    operationButtonsProps,
    searchComplete
  };
}
