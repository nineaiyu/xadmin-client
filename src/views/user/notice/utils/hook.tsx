import { useI18n } from "vue-i18n";
import { SUCCESS_CODE } from "@/api/types";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { userNoticeReadApi } from "@/api/user/notice";
import { useNoticeStoreHook } from "@/store/modules/notice";
import { h, reactive, ref, type Ref, shallowRef } from "vue";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { deviceDetection, getKeyList } from "@pureadmin/utils";
import NoticeShowForm from "@/views/system/components/NoticeShow.vue";
import {
  handleOperation,
  type OperationProps,
  type PageTableColumn,
  formatPageColumns
} from "@/components/RePlusPage";
import type { RecordType } from "plus-pro-components";

import Success from "~icons/ep/success-filled";

/**
 * 就地改写地址栏去掉 pk 参数（绕过 vue-router）：主内容组件以 fullPath 为 key，
 * 走 router.replace 会整页重挂载、把刚打开的详情弹窗卸载。
 */
function stripPkFromAddressBar() {
  const hash = location.hash;
  const queryIndex = hash.indexOf("?");
  if (queryIndex === -1) return;
  const params = new URLSearchParams(hash.slice(queryIndex + 1));
  if (!params.has("pk")) return;
  params.delete("pk");
  const search = params.toString();
  history.replaceState(
    history.state,
    "",
    `${location.pathname}${location.search}${hash.slice(0, queryIndex)}${
      search ? `?${search}` : ""
    }`
  );
}

export function useUserNotice(tableRef: Ref) {
  const { t } = useI18n();

  const api = reactive(userNoticeReadApi);

  const auth = reactive({
    list: hasAuth("list:UserNotice"),
    batchRead: hasAuth("batchRead:UserNotice"),
    allRead: hasAuth("allRead:UserNotice")
  });

  const selectedNum = ref(0);
  const unreadCount = ref(0);
  const manySelectData = ref<RecordType[]>([]);

  /** 统一走 handleOperation：成功/失败提示与业务码分支收口，失败不再静默 */
  function handleReadAll() {
    handleOperation({
      t,
      apiReq: api.allRead(),
      success: () => tableRef.value.handleGetData()
    });
  }

  function handleManyRead() {
    if (selectedNum.value === 0) {
      message(t("results.noSelectedData"), { type: "error" });
      return;
    }
    handleOperation({
      t,
      apiReq: api.batchRead({ pks: getKeyList(manySelectData.value, "pk") }),
      success: () => tableRef.value.handleGetData()
    });
  }

  const showDialog = (
    row: RecordType,
    routeParams: RecordType | null = null,
    searchFields: Ref<RecordType> | null = null
  ) => {
    if (row.unread) {
      // 行内就地已读：失败不阻断弹窗（关闭时列表会刷新）；业务码失败点名提示，
      // HTTP 层异常交由拦截器
      api
        .batchRead({ pks: [row.pk] })
        .then(res => {
          if (res.code !== SUCCESS_CODE) {
            message(String(res.detail || t("userNotice.readFailed")), {
              type: "warning"
            });
          }
        })
        .catch(() => undefined);
    }
    if (routeParams?.pk) {
      // 深链 pk 只消费一次：打开即从地址栏移除，刷新/重开页签不再重复弹出。
      // 铃铛未读点击已改为就地弹窗（不产生 ?pk=），此路径仅兼容历史书签与旧页签。
      stripPkFromAddressBar();
    }
    addDialog({
      title: t("userNotice.showSystemNotice"),
      props: {
        formInline: { ...row },
        hasPublish: false
      },
      // 通知为长文本查看：走弹窗尺寸档位最大档（尺寸治理收敛，不再用百分比散值）
      width: dialogSize("xl"),
      draggable: true,
      fullscreen: deviceDetection(),
      fullscreenIcon: true,
      closeOnClickModal: false,
      hideFooter: true,
      contentRenderer: () => h(NoticeShowForm),
      closeCallBack: () => {
        if (routeParams?.pk && searchFields) {
          // 深链进入时列表被 pk 过滤为单条：关闭后清除过滤并重取完整列表
          searchFields.value.pk = "";
          tableRef.value.handleGetData();
          return;
        }
        if (row.unread) {
          tableRef.value.handleGetData();
        }
      }
    });
  };

  const searchComplete = ({
    routeParams,
    searchFields,
    dataList,
    res
  }: {
    routeParams: RecordType;
    searchFields: Ref<RecordType>;
    dataList: Ref<RecordType[]>;
    res: RecordType;
  }) => {
    unreadCount.value = res.unread_count;
    useNoticeStoreHook().SET_NOTICECOUNT(res.unread_count);
    if (
      routeParams.pk &&
      routeParams.pk === searchFields.value.pk &&
      routeParams.pk !== "" &&
      dataList.value.length > 0
    ) {
      showDialog(dataList.value[0], routeParams, searchFields);
    }
  };

  const selectionChange = (data: RecordType[]) => {
    manySelectData.value = data;
    selectedNum.value = manySelectData.value.length ?? 0;
  };
  const listColumnsFormat = (columns: PageTableColumn[]) =>
    formatPageColumns(columns, {
      title: column => {
        // 字典驱动（notice_level）：字典色优先（el-text style），无色回退
        // 枚举值即 el-text 类型的契约
        column["cellRenderer"] = ({ row }) => (
          <el-text
            type={row.level?.value}
            style={row.level?.color ? { color: row.level.color } : undefined}
          >
            {row.title}
          </el-text>
        );
      },
      unread: column => {
        column["cellRenderer"] = ({ row }) => (
          <el-text type={row.unread ? "success" : "info"}>
            {row.unread ? t("labels.unread") : t("labels.read")}
          </el-text>
        );
      }
    });

  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [
      {
        text: t("userNotice.batchRead"),
        code: "batchRead",
        props: {
          type: "success",
          icon: useRenderIcon(Success),
          plain: true
        },
        onClick: () => {
          handleManyRead();
        },
        confirm: {
          title: () => {
            // 批量已读用独立文案：复用删除确认会误导（"确定批量删除 N 条数据吗？"）
            return t("userNotice.batchReadConfirm", {
              count: selectedNum.value
            });
          }
        },
        show: () => {
          return Boolean(auth.batchRead && selectedNum.value);
        }
      },
      {
        text: t("userNotice.allRead"),
        code: "allRead",
        props: {
          type: "primary"
        },
        onClick: () => {
          handleReadAll();
        },
        show: () => {
          return Boolean(auth.allRead && unreadCount.value > 0);
        }
      }
    ]
  });

  const operationButtonsProps = shallowRef<OperationProps>({
    width: 100,
    buttons: [
      {
        code: "detail",
        text: t("buttons.detail"),
        onClick({ row }) {
          showDialog(row);
        },
        update: true
      }
    ]
  });
  return {
    api,
    auth,
    listColumnsFormat,
    operationButtonsProps,
    tableBarButtonsProps,
    selectionChange,
    searchComplete
  };
}
