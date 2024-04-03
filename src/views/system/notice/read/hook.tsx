import dayjs from "dayjs";
import { computed, h, onMounted, reactive, ref, type Ref } from "vue";
import {
  deleteNoticeReadApi,
  getNoticeReadDetailApi,
  getNoticeReadListApi,
  manyDeleteNoticeReadApi,
  updateNoticeReadStateApi
} from "@/api/system/notice";
import type { FormItemProps } from "../utils/types";
import showForm from "../show.vue";
import { cloneDeep, deviceDetection } from "@pureadmin/utils";
import { addDialog } from "@/components/ReDialog";
import { useRouter } from "vue-router";
import { hasAuth, hasGlobalAuth } from "@/router/utils";
import { useI18n } from "vue-i18n";
import { formatOptions } from "@/views/system/hooks";
import type { PlusColumn } from "plus-pro-components";
import { renderSwitch } from "@/views/system/render";

export function useNoticeRead(tableRef: Ref) {
  const { t } = useI18n();
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
    title: "",
    message: "",
    username: "",
    owner_id: "",
    notice_id: "",
    notice_type: "",
    level: "",
    unread: "",
    ordering: sortOptions[0].key,
    page: 1,
    size: 10
  });

  const defaultValue = cloneDeep(searchField.value);

  const api = reactive({
    list: getNoticeReadListApi,
    detail: getNoticeReadDetailApi,
    delete: deleteNoticeReadApi,
    readState: updateNoticeReadStateApi,
    batchDelete: manyDeleteNoticeReadApi
  });

  const auth = reactive({
    list: hasAuth("list:systemNoticeRead"),
    detail: hasAuth("detail:systemNoticeRead"),
    delete: hasAuth("delete:systemNoticeRead"),
    readState: hasAuth("update:systemNoticeReadState"),
    batchDelete: hasAuth("manyDelete:systemNoticeRead")
  });

  const formRef = ref();
  const router = useRouter();
  const choicesDict = ref({});

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
      prop: "notice_info",
      minWidth: 120,
      cellRenderer: ({ row }) => (
        <el-link
          type={row.notice_info.level == "" ? "default" : row.notice_info.level}
          onClick={() => onGoNoticeDetail(row as any)}
        >
          {row.notice_info.title}
        </el-link>
      )
    },
    {
      label: t("notice.type"),
      prop: "notice_info",
      minWidth: 100,
      cellRenderer: ({ row }) => (
        <el-text>{row.notice_info.notice_type_display}</el-text>
      )
    },
    {
      label: t("user.userId"),
      prop: "owner_info",
      minWidth: 100,
      cellRenderer: ({ row }) => <el-text>{row.owner_info?.pk}</el-text>
    },
    {
      label: t("user.userInfo"),
      prop: "owner_info",
      minWidth: 100,
      cellRenderer: ({ row }) => (
        <el-link onClick={() => onGoUserDetail(row as any)}>
          {row.owner_info?.username ? row.owner_info?.username : "/"}
        </el-link>
      )
    },
    {
      label: t("notice.readDate"),
      minWidth: 180,
      prop: "updated_time",
      cellRenderer: ({ row }) => (
        <el-text>
          {!row.unread
            ? dayjs(row.updated_time).format("YYYY-MM-DD HH:mm:ss")
            : "/"}
        </el-text>
      )
    },
    {
      label: t("notice.haveRead"),
      prop: "unread",
      minWidth: 90,
      cellRenderer: renderSwitch(
        auth.readState,
        tableRef,
        "unread",
        scope => {
          return scope.row.notice_info.title;
        },
        api.readState,
        scope => {
          return scope.row.unread === false
            ? t("labels.read")
            : t("labels.unread");
        }
      )
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
        label: t("user.userId"),
        prop: "owner_id",
        valueType: "input",
        fieldProps: {
          placeholder: t("user.verifyUserId")
        }
      },
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
        label: t("user.username"),
        prop: "username",
        valueType: "input",
        fieldProps: {
          placeholder: t("user.verifyUsername")
        }
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
        label: t("notice.haveRead"),
        prop: "unread",
        valueType: "select",
        options: [
          {
            label: t("labels.read"),
            value: false
          },
          {
            label: t("labels.unread"),
            value: true
          }
        ]
      },
      {
        label: t("labels.sort"),
        prop: "ordering",
        valueType: "select",
        options: formatOptions(sortOptions)
      }
    ];
  });
  function onGoUserDetail(row: any) {
    if (
      hasGlobalAuth("list:systemUser") &&
      row.owner_info &&
      row.owner_info?.pk
    ) {
      router.push({
        name: "SystemUser",
        query: { pk: row.owner_info.pk }
      });
    }
  }

  function onGoNoticeDetail(row: any) {
    if (
      hasGlobalAuth("list:systemNotice") &&
      row.notice_info &&
      row.notice_info.pk
    ) {
      router.push({
        name: "SystemNotice",
        query: { pk: row.notice_info.pk }
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
          message: row?.message ?? "",
          publish: row?.publish ?? true,
          level: row?.level ?? ""
        }
      },
      width: "70%",
      draggable: true,
      fullscreen: deviceDetection(),
      fullscreenIcon: true,
      closeOnClickModal: false,
      hideFooter: true,
      contentRenderer: () => h(showForm, { ref: formRef })
    });
  }

  onMounted(() => {
    api.detail("choices").then(res => {
      if (res.code === 1000) {
        choicesDict.value = res.choices_dict;
      }
    });
  });

  return {
    t,
    api,
    auth,
    columns,
    searchField,
    defaultValue,
    searchColumns,
    showDialog
  };
}
