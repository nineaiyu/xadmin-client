import dayjs from "dayjs";
import {
  computed,
  h,
  onMounted,
  reactive,
  ref,
  type Ref,
  shallowRef
} from "vue";
import { noticeApi } from "@/api/system/notice";
import { useRouter } from "vue-router";
import type { FormItemProps } from "./types";
import Form from "../editor.vue";
import showForm from "../show.vue";
import { cloneDeep, deviceDetection } from "@pureadmin/utils";
import { addDialog } from "@/components/ReDialog";
import { hasAuth, hasGlobalAuth } from "@/router/utils";
import { useI18n } from "vue-i18n";
import { NoticeChoices } from "@/views/system/constants";
import { formatFormColumns, formatOptions } from "@/views/system/hooks";
import type { PlusColumn } from "plus-pro-components";
import { renderSwitch, selectOptions } from "@/views/system/render";
import SearchUsers from "@/views/system/base/searchUsers.vue";
import SearchDepts from "@/views/system/base/searchDepts.vue";
import SearchRoles from "@/views/system/base/searchRoles.vue";

const customOptions = (data: Array<any>) => {
  const result = [];
  data?.forEach(item => {
    result.push({
      label: item?.label,
      value: item?.value,
      fieldItemProps: {
        disabled: item?.disabled
      },
      fieldSlot: () => {
        return <el-text type={item?.value}> {item?.label}</el-text>;
      }
    });
  });
  return result;
};

export function useNotice(tableRef: Ref) {
  const { t } = useI18n();
  const defaultNoticeType = ref(NoticeChoices.NOTICE);

  const api = reactive({
    list: noticeApi.list,
    create: (row, isAdd, curData) => {
      if (
        curData.notice_type == NoticeChoices.NOTICE &&
        hasAuth("create:systemAnnouncement")
      ) {
        return noticeApi.announcement;
      }
      return noticeApi.create;
    },
    delete: noticeApi.delete,
    update: noticeApi.patch,
    publish: noticeApi.publish,
    detail: noticeApi.detail,
    fields: noticeApi.fields,
    batchDelete: noticeApi.batchDelete
  });

  const auth = reactive({
    list: hasAuth("list:systemNotice"),
    create: hasAuth("create:systemNotice"),
    delete: hasAuth("delete:systemNotice"),
    update: hasAuth("update:systemNotice"),
    publish: hasAuth("update:systemNoticePublish"),
    detail: hasAuth("detail:systemNotice"),
    fields: hasAuth("fields:systemNotice"),
    batchDelete: hasAuth("batchDelete:systemNotice")
  });

  const editForm = shallowRef({
    title: t("systemNotice.notice"),
    form: Form,
    row: {
      publish: row => {
        return row?.publish ?? false;
      },
      notice_user: row => {
        return row?.notice_user ?? [];
      },
      notice_dept: row => {
        return row?.notice_dept ?? [];
      },
      notice_role: row => {
        return row?.notice_role ?? [];
      },
      notice_type: row => {
        return row?.notice_type ?? defaultNoticeType.value;
      },
      level: row => {
        return row?.level ?? "info";
      }
    },
    props: {
      levelChoices: () => {
        return choicesDict.value["level"];
      },
      noticeChoices: () => {
        const data = cloneDeep(choicesDict.value["notice_type"]);
        data[0].disabled = true;
        return data;
      }
    },
    options: {
      top: "10vh",
      width: "60vw"
    }
  });

  const router = useRouter();
  const choicesDict = ref({});

  const columns = ref<TableColumnList>([
    {
      type: "selection",
      fixed: "left",
      reserveSelection: true
    },
    {
      prop: "pk",
      minWidth: 100
    },
    {
      prop: "title",
      minWidth: 120,
      cellRenderer: ({ row }) => (
        <el-text type={row?.level}>{row.title}</el-text>
      )
    },
    {
      prop: "notice_type.label",
      minWidth: 120
    },
    {
      prop: "read_user_count",
      minWidth: 140,
      cellRenderer: ({ row }) => (
        <el-link
          type={row.level}
          onClick={() => onGoNoticeReadDetail(row as any)}
        >
          {row.notice_type === NoticeChoices.NOTICE
            ? t("systemNotice.allRead")
            : row.user_count}
          /{row.read_user_count}
        </el-link>
      )
    },
    {
      prop: "publish",
      minWidth: 90,
      cellRenderer: renderSwitch(
        auth.publish,
        tableRef,
        "publish",
        scope => {
          return scope.row.title;
        },
        false,
        api.publish,
        scope => {
          return scope.row.publish === false
            ? t("labels.unPublish")
            : t("labels.publish");
        }
      )
    },
    {
      minWidth: 180,
      prop: "created_time",
      formatter: ({ created_time }) =>
        dayjs(created_time).format("YYYY-MM-DD HH:mm:ss")
    },
    {
      fixed: "right",
      width: 200,
      slot: "operation"
    }
  ]);

  function onGoNoticeReadDetail(row: any) {
    if (hasGlobalAuth("list:systemNoticeRead") && row.pk) {
      router.push({
        name: "SystemNoticeRead",
        query: { notice_id: row.pk }
      });
    }
  }

  function showDialog(row?: FormItemProps) {
    addDialog({
      title: t("systemNotice.showSystemNotice"),
      props: {
        formInline: {
          pk: row?.pk ?? "",
          title: row?.title ?? "",
          publish: row?.publish ?? false,
          message: row?.message ?? "",
          level: row?.level ?? "info"
        },
        isAdd: false
      },
      width: "70%",
      draggable: true,
      fullscreen: deviceDetection(),
      fullscreenIcon: true,
      closeOnClickModal: false,
      contentRenderer: () => h(showForm)
    });
  }

  onMounted(() => {
    api.detail("choices").then(res => {
      if (res.code === 1000) {
        choicesDict.value = res.choices_dict;
        choicesDict.value["notice_type"].forEach(item => {
          if (item.value == NoticeChoices.NOTICE) {
            if (!hasAuth("create:systemAnnouncement")) {
              if (!item.disabled) {
                item.disabled = true;
                defaultNoticeType.value = NoticeChoices.USER;
              }
            }
          }
        });
      }
    });
  });

  const searchEnd = (getParameter, form) => {
    if (
      getParameter.notice_user &&
      form.value.notice_user &&
      form.value.notice_user !== ""
    ) {
      const parameter = {
        notice_user: JSON.parse(getParameter.notice_user as string),
        notice_type: NoticeChoices.USER
      };
      form.value.notice_user = "";
      tableRef.value.openDialog(true, parameter);
    }
  };

  return {
    t,
    api,
    auth,
    columns,
    editForm,
    showDialog,
    searchEnd
  };
}

export function useNoticeForm(props, newFormInline) {
  const { t, te } = useI18n();
  const columns: PlusColumn[] = [
    {
      prop: "title",
      valueType: "input",
      colProps: { xs: 24, sm: 24, md: 24, lg: 16, xl: 16 }
    },
    {
      prop: "publish",
      valueType: "select",
      colProps: { xs: 24, sm: 24, md: 24, lg: 8, xl: 8 },
      options: selectOptions
    },
    {
      prop: "notice_type",
      valueType: "select",
      fieldProps: {
        disabled: !props.isAdd
      },
      colProps: { xs: 24, sm: 24, md: 24, lg: 12, xl: 12 },
      options: formatOptions(props.noticeChoices)
    },
    {
      prop: "level",
      valueType: "select",
      colProps: { xs: 24, sm: 24, md: 24, lg: 12, xl: 12 },
      options: customOptions(props.levelChoices)
    },

    {
      prop: "notice_user",
      hideInForm: computed(() => {
        return !(
          newFormInline.value.notice_type === NoticeChoices.USER &&
          hasGlobalAuth("list:systemSearchUsers")
        );
      }),
      renderField: (value, onChange) => {
        onChange(value);
        return <SearchUsers modelValue={value} />;
      }
    },
    {
      prop: "notice_dept",
      hideInForm: computed(() => {
        return !(
          newFormInline.value.notice_type === NoticeChoices.DEPT &&
          hasGlobalAuth("list:systemSearchDepts")
        );
      }),
      renderField: (value, onChange) => {
        onChange(value);
        return <SearchDepts modelValue={value} />;
      }
    },
    {
      prop: "notice_role",
      hideInForm: computed(() => {
        return !(
          newFormInline.value.notice_type === NoticeChoices.ROLE &&
          hasGlobalAuth("list:systemSearchRoles")
        );
      }),
      renderField: (value, onChange) => {
        onChange(value);
        return <SearchRoles modelValue={value} />;
      }
    },
    {
      hasLabel: false,
      prop: "message"
    }
  ];
  formatFormColumns(props, columns, t, te, "systemNotice");
  return {
    t,
    columns
  };
}
