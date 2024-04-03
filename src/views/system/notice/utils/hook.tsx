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
import {
  createAnnouncementApi,
  createNoticeApi,
  deleteNoticeApi,
  getNoticeDetailApi,
  getNoticeListApi,
  manyDeleteNoticeApi,
  updateNoticeApi,
  updateNoticePublishApi
} from "@/api/system/notice";
import { useRouter } from "vue-router";
import type { FormItemProps } from "./types";
import Form from "../editor.vue";
import showForm from "../show.vue";
import { cloneDeep, deviceDetection } from "@pureadmin/utils";
import { addDialog } from "@/components/ReDialog";
import { hasAuth, hasGlobalAuth } from "@/router/utils";
import { useI18n } from "vue-i18n";
import { NoticeChoices } from "@/views/system/constants";
import { formatOptions } from "@/views/system/hooks";
import type { PlusColumn } from "plus-pro-components";
import {
  disableState,
  renderSwitch,
  selectOptions
} from "@/views/system/render";
import SearchUsers from "@/views/system/base/searchUsers.vue";
import SearchDepts from "@/views/system/base/searchDepts.vue";
import SearchRoles from "@/views/system/base/searchRoles.vue";

const customOptions = (data: Array<any>) => {
  const result = [];
  data?.forEach(item => {
    result.push({
      label: item?.label,
      value: item?.key,
      fieldItemProps: {
        disabled: item?.disabled
      },
      fieldSlot: () => {
        return <el-text type={item?.key}> {item?.label}</el-text>;
      }
    });
  });
  return result;
};

export function useNotice(tableRef: Ref) {
  const { t } = useI18n();
  const defaultNoticeType = ref(NoticeChoices.NOTICE);

  const sortOptions = [
    {
      label: `${t("sorts.createdDate")} ${t("labels.descending")}`,
      key: "-created_time"
    },
    {
      label: `${t("sorts.createdDate")} ${t("labels.ascending")}`,
      key: "created_time"
    }
  ];
  const searchField = ref({
    pk: "",
    title: "",
    message: "",
    level: "",
    notice_type: "",
    notice_user: "",
    publish: "",
    ordering: sortOptions[0].key,
    page: 1,
    size: 10
  });

  const defaultValue = cloneDeep(searchField.value);

  const api = reactive({
    list: getNoticeListApi,
    create: (row, isAdd, curData) => {
      if (
        curData.notice_type == NoticeChoices.NOTICE &&
        hasAuth("create:systemAnnouncement")
      ) {
        return createAnnouncementApi;
      }
      return createNoticeApi;
    },
    delete: deleteNoticeApi,
    update: updateNoticeApi,
    publish: updateNoticePublishApi,
    detail: getNoticeDetailApi,
    batchDelete: manyDeleteNoticeApi
  });

  const auth = reactive({
    list: hasAuth("list:systemNotice"),
    create: hasAuth("create:systemNotice"),
    delete: hasAuth("delete:systemNotice"),
    update: hasAuth("update:systemNotice"),
    publish: hasAuth("update:systemNoticePublish"),
    detail: hasAuth("detail:systemNotice"),
    batchDelete: hasAuth("manyDelete:systemNotice")
  });

  const editForm = shallowRef({
    title: t("notice.notice"),
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
  const formRef = ref();

  const columns = ref<TableColumnList>([
    {
      label: t("labels.checkColumn"),
      type: "selection",
      fixed: "left",
      reserveSelection: true
    },
    {
      label: t("labels.id"),
      prop: "pk",
      minWidth: 100
    },
    {
      label: t("notice.title"),
      prop: "title",
      minWidth: 120,
      cellRenderer: ({ row }) => (
        <el-text type={row?.level}>{row.title}</el-text>
      )
    },
    {
      label: t("notice.type"),
      prop: "notice_type_display",
      minWidth: 120
    },
    {
      label: t("notice.receiveRead"),
      prop: "user_count",
      minWidth: 120,
      cellRenderer: ({ row }) => (
        <el-link
          type={row.level == "" ? "default" : row.level}
          onClick={() => onGoNoticeReadDetail(row as any)}
        >
          {row.notice_type === NoticeChoices.NOTICE
            ? t("notice.allRead")
            : row.user_count}
          /{row.read_user_count}
        </el-link>
      )
    },
    {
      label: t("notice.publish"),
      prop: "publish",
      minWidth: 90,
      cellRenderer: renderSwitch(
        auth.publish,
        tableRef,
        "publish",
        scope => {
          return scope.row.title;
        },
        api.publish,
        scope => {
          return scope.row.publish === false
            ? t("labels.unPublish")
            : t("labels.publish");
        }
      )
    },
    {
      label: t("sorts.createdDate"),
      minWidth: 180,
      prop: "created_time",
      formatter: ({ created_time }) =>
        dayjs(created_time).format("YYYY-MM-DD HH:mm:ss")
    },
    {
      label: t("labels.operations"),
      fixed: "right",
      width: 200,
      slot: "operation"
    }
  ]);

  const searchColumns: PlusColumn[] = computed(() => {
    return [
      {
        label: t("labels.id"),
        prop: "notice_id",
        valueType: "input"
      },
      {
        label: t("notice.title"),
        prop: "title",
        valueType: "input",
        fieldProps: {
          placeholder: t("notice.verifyTitle")
        }
      },
      {
        label: t("notice.content"),
        prop: "message",
        valueType: "input",
        fieldProps: {
          placeholder: t("notice.verifyContent")
        }
      },
      {
        label: t("notice.publish"),
        prop: "publish",
        valueType: "select",
        options: selectOptions
      },
      {
        label: t("notice.level"),
        prop: "level",
        valueType: "select",
        options: computed(() => {
          return customOptions(choicesDict.value["level"]);
        })
      },
      {
        label: t("notice.type"),
        prop: "notice_type",
        valueType: "select",
        options: computed(() => {
          return formatOptions(choicesDict.value["notice_type"]);
        })
      },
      {
        label: t("labels.sort"),
        prop: "ordering",
        valueType: "select",
        options: formatOptions(sortOptions)
      }
    ];
  });

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
      title: t("notice.showSystemNotice"),
      props: {
        formInline: {
          pk: row?.pk ?? "",
          title: row?.title ?? "",
          publish: row?.publish ?? false,
          message: row?.message ?? "",
          level: row?.level ?? ""
        },
        isAdd: false
      },
      width: "70%",
      draggable: true,
      fullscreen: deviceDetection(),
      fullscreenIcon: true,
      closeOnClickModal: false,
      contentRenderer: () => h(showForm, { ref: formRef })
    });
  }

  onMounted(() => {
    api.detail("choices").then(res => {
      if (res.code === 1000) {
        choicesDict.value = res.choices_dict;
        choicesDict.value["notice_type"].forEach(item => {
          if (item.key == NoticeChoices.NOTICE) {
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
    searchField,
    defaultValue,
    searchColumns,
    showDialog,
    searchEnd
  };
}

export function useNoticeForm(props, newFormInline) {
  const { t } = useI18n();
  const columns: PlusColumn[] = [
    {
      label: t("notice.title"),
      prop: "title",
      valueType: "input",
      fieldProps: {
        disabled: disableState(props, "title")
      },
      colProps: {
        xs: 24,
        sm: 24,
        md: 24,
        lg: 16,
        xl: 16
      }
    },
    {
      label: t("notice.publish"),
      prop: "publish",
      valueType: "select",
      fieldProps: {
        disabled: disableState(props, "publish")
      },
      colProps: {
        xs: 24,
        sm: 24,
        md: 24,
        lg: 8,
        xl: 8
      },
      options: selectOptions
    },
    {
      label: t("notice.type"),
      prop: "notice_type",
      valueType: "select",
      fieldProps: {
        disabled: disableState(props, "notice_type")
      },
      colProps: {
        xs: 24,
        sm: 24,
        md: 24,
        lg: 12,
        xl: 12
      },
      options: formatOptions(props.noticeChoices)
    },
    {
      label: t("notice.level"),
      prop: "level",
      valueType: "select",
      fieldProps: {
        disabled: disableState(props, "level")
      },
      colProps: {
        xs: 24,
        sm: 24,
        md: 24,
        lg: 12,
        xl: 12
      },
      options: customOptions(props.levelChoices)
    },

    {
      label: t("user.userId"),
      prop: "notice_user",
      hideInForm: computed(() => {
        return !(
          newFormInline.value.notice_type === NoticeChoices.USER &&
          hasGlobalAuth("list:systemSearchUsers")
        );
      }),
      fieldProps: {
        disabled: disableState(props, "notice_user")
      },
      renderField: value => {
        if (value === "") {
          return;
        }
        return <SearchUsers modelValue={value} />;
      }
    },
    {
      label: t("dept.dept"),
      prop: "notice_dept",
      hideInForm: computed(() => {
        return !(
          newFormInline.value.notice_type === NoticeChoices.DEPT &&
          hasGlobalAuth("list:systemSearchDepts")
        );
      }),
      fieldProps: {
        disabled: disableState(props, "notice_dept")
      },
      renderField: value => {
        if (value === "") {
          return;
        }
        return <SearchDepts modelValue={value} />;
      }
    },
    {
      label: t("role.role"),
      prop: "notice_role",
      hideInForm: computed(() => {
        return !(
          newFormInline.value.notice_type === NoticeChoices.ROLE &&
          hasGlobalAuth("list:systemSearchRoles")
        );
      }),
      fieldProps: {
        disabled: disableState(props, "notice_role")
      },
      renderField: value => {
        if (value === "") {
          return;
        }
        return <SearchRoles modelValue={value} />;
      }
    },
    {
      label: t("notice.content"),
      prop: "message"
    }
  ];

  return {
    t,
    columns
  };
}
