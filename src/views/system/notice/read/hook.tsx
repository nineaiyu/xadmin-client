import { h, reactive, ref, type Ref, shallowRef } from "vue";
import { noticeReadApi } from "@/api/system/notice";
import { deviceDetection } from "@pureadmin/utils";
import { addDialog } from "@/components/ReDialog";
import { useRouter } from "vue-router";
import { hasAuth, hasGlobalAuth } from "@/router/utils";
import { useI18n } from "vue-i18n";
import type { CRUDColumn, OperationProps } from "@/components/RePlusCRUD";
import { renderSwitch, usePublicHooks } from "@/components/RePlusCRUD";
import noticeShowForm from "@/views/publicComponents/noticeShow.vue";
export function useNoticeRead(tableRef: Ref) {
  const { t } = useI18n();

  const api = reactive(noticeReadApi);
  api.update = api.patch;

  const auth = reactive({
    list: hasAuth("list:systemNoticeRead"),
    detail: hasAuth("detail:systemNoticeRead"),
    delete: hasAuth("delete:systemNoticeRead"),
    state: hasAuth("update:systemNoticeReadState"),
    batchDelete: hasAuth("batchDelete:systemNoticeRead")
  });
  const switchLoadMap = ref({});
  const { switchStyle } = usePublicHooks();

  const operationButtonsProps = shallowRef<OperationProps>({
    width: 140,
    buttons: [
      {
        code: "detail",
        onClick({ row: { notice_info } }) {
          addDialog({
            title: t("noticeRead.showSystemNotice"),
            props: {
              formInline: { ...notice_info },
              hasPublish: false
            },
            width: "70%",
            draggable: true,
            fullscreen: deviceDetection(),
            fullscreenIcon: true,
            closeOnClickModal: false,
            hideFooter: true,
            contentRenderer: () => h(noticeShowForm)
          });
        },
        update: true
      }
    ]
  });
  const listColumnsFormat = (columns: CRUDColumn[]) => {
    columns.forEach(column => {
      switch (column._column?.key) {
        case "notice_info":
          column["cellRenderer"] = ({ row }) => (
            <el-link
              type={row.notice_info?.level?.value}
              onClick={() => onGoNoticeDetail(row as any)}
            >
              {row.notice_info.title}
            </el-link>
          );
          break;
        case "owner_info":
          column["cellRenderer"] = ({ row }) => (
            <el-link onClick={() => onGoUserDetail(row as any)}>
              {row.owner_info?.username ? row.owner_info?.username : "/"}
            </el-link>
          );
          break;
        case "unread":
          column["cellRenderer"] = renderSwitch({
            t,
            updateApi: api.state,
            switchLoadMap,
            switchStyle,
            field: column.prop,
            disabled: !auth.state,
            success() {
              tableRef.value.handleGetData();
            },
            actionMap: {
              true: t("labels.read"),
              false: t("labels.unread")
            },
            activeMap: {
              false: true,
              true: false
            }
          });
          break;
      }
    });
    return columns;
  };
  const router = useRouter();

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

  return {
    api,
    auth,
    listColumnsFormat,
    operationButtonsProps
  };
}
