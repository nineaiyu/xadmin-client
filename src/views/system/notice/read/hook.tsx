import dayjs from "dayjs";
import { h, reactive, ref, type Ref } from "vue";
import { noticeReadApi } from "@/api/system/notice";
import type { FormItemProps } from "../utils/types";
import showForm from "../show.vue";
import { deviceDetection } from "@pureadmin/utils";
import { addDialog } from "@/components/ReDialog";
import { useRouter } from "vue-router";
import { hasAuth, hasGlobalAuth } from "@/router/utils";
import { useI18n } from "vue-i18n";
import { renderSwitch } from "@/views/system/render";

export function useNoticeRead(tableRef: Ref) {
  const { t } = useI18n();

  const api = reactive({
    list: noticeReadApi.list,
    detail: noticeReadApi.detail,
    delete: noticeReadApi.delete,
    state: noticeReadApi.state,
    fields: noticeReadApi.fields,
    batchDelete: noticeReadApi.batchDelete
  });

  const auth = reactive({
    list: hasAuth("list:systemNoticeRead"),
    detail: hasAuth("detail:systemNoticeRead"),
    delete: hasAuth("delete:systemNoticeRead"),
    fields: hasAuth("fields:systemNoticeRead"),
    state: hasAuth("update:systemNoticeReadState"),
    batchDelete: hasAuth("batchDelete:systemNoticeRead")
  });

  const router = useRouter();

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
      prop: "notice_info",
      minWidth: 120,
      cellRenderer: ({ row }) => (
        <el-link
          type={row.notice_info.level}
          onClick={() => onGoNoticeDetail(row as any)}
        >
          {row.notice_info.title}
        </el-link>
      )
    },
    {
      label: t("noticeRead.notice_type"),
      prop: "notice_info",
      minWidth: 100,
      cellRenderer: ({ row }) => (
        <el-text>{row.notice_info.notice_type_display}</el-text>
      )
    },
    {
      label: t("noticeRead.owner_id"),
      prop: "owner_info",
      minWidth: 100,
      cellRenderer: ({ row }) => <el-text>{row.owner_info?.pk}</el-text>
    },
    {
      label: t("noticeRead.username"),
      prop: "owner_info",
      minWidth: 100,
      cellRenderer: ({ row }) => (
        <el-link onClick={() => onGoUserDetail(row as any)}>
          {row.owner_info?.username ? row.owner_info?.username : "/"}
        </el-link>
      )
    },
    {
      label: t("noticeRead.readDate"),
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
      prop: "unread",
      minWidth: 90,
      cellRenderer: renderSwitch(
        auth.state,
        tableRef,
        "unread",
        scope => {
          return scope.row.notice_info.title;
        },
        true,
        api.state,
        scope => {
          return scope.row.unread === false
            ? t("labels.read")
            : t("labels.unread");
        }
      )
    },
    {
      fixed: "right",
      width: 200,
      slot: "operation"
    }
  ]);

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
      row?.notice_info &&
      row.notice_info?.pk
    ) {
      router.push({
        name: "SystemNotice",
        query: { pk: row.notice_info.pk }
      });
    }
  }

  function showDialog(row?: FormItemProps) {
    addDialog({
      title: t("noticeRead.showSystemNotice"),
      props: {
        formInline: {
          pk: row?.pk ?? "",
          title: row?.title ?? "",
          message: row?.message ?? "",
          publish: row?.publish ?? true,
          level: row?.level ?? "info"
        }
      },
      width: "70%",
      draggable: true,
      fullscreen: deviceDetection(),
      fullscreenIcon: true,
      closeOnClickModal: false,
      hideFooter: true,
      contentRenderer: () => h(showForm)
    });
  }

  return {
    t,
    api,
    auth,
    columns,
    showDialog
  };
}
