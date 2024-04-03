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
  updateNoticeApi
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
import { renderSwitch } from "@/views/system/render";

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
  const searchForm = ref({
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

  const defaultValue = cloneDeep(searchForm.value);

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
    detail: getNoticeDetailApi,
    batchDelete: manyDeleteNoticeApi
  });

  const auth = reactive({
    list: hasAuth("list:systemNotice"),
    create: hasAuth("create:systemNotice"),
    delete: hasAuth("delete:systemNotice"),
    update: hasAuth("update:systemNotice"),
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
        return choicesDict.value["notice_type"];
      }
    },
    options: {
      top: "10vh"
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
      cellRenderer: renderSwitch(auth, tableRef, "publish", scope => {
        return scope.row.title;
      })
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
        options: [
          {
            label: t("labels.unPublish"),
            value: false
          },
          {
            label: t("labels.publish"),
            value: true
          }
        ]
      },
      {
        label: t("notice.level"),
        prop: "level",
        valueType: "select",
        options: computed(() => {
          return formatOptions(choicesDict.value["level"]);
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
    searchForm,
    defaultValue,
    searchColumns,
    showDialog,
    searchEnd
  };
}
