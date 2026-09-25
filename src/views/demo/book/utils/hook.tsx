import { bookApi } from "./api";
import { getCurrentInstance, h, reactive, type Ref, shallowRef } from "vue";
import { getDefaultAuths } from "@/router/utils";
import type {
  OperationProps,
  PageColumn,
  PageTableColumn,
  RePlusPageProps
} from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import CircleClose from "~icons/ep/circle-close";
import { handleOperation } from "@/components/RePlusPage";
import { useI18n } from "vue-i18n";
import Success from "~icons/ep/success-filled";
import Upload from "~icons/ep/upload";
import { message } from "@/utils/message";
import { ElTag } from "element-plus";

export function useDemoBook(tableRef: Ref) {
  // 权限判断，用于判断是否有该权限（recycleList 控制回收站入口、changeHistory 控制行级变更历史）
  const api = reactive(bookApi);
  const auth = reactive({
    push: false,
    submit: false,
    recycleList: false,
    changeHistory: false,
    ...getDefaultAuths(getCurrentInstance(), [
      "push",
      "submit",
      "recycleList",
      "changeHistory"
    ])
  });
  const { t } = useI18n();

  /**
   * 出版社建议词：示例数据走词条（英文界面下不至于全是中文），
   * 编辑表单与搜索区共用同一份前缀匹配实现，避免两处漂移。
   */
  const fetchPublisherSuggestions = (
    queryString: string,
    cb: (results: Array<{ value: string }>) => void
  ) => {
    const queryList = [
      { value: t("demoBook.publisherExample1") },
      { value: t("demoBook.publisherExample2") },
      { value: t("demoBook.publisherExample3") }
    ];
    cb(
      queryString
        ? queryList.filter(
            item =>
              item.value.toLowerCase().indexOf(queryString.toLowerCase()) === 0
          )
        : queryList
    );
  };

  /**
   * 添加一个推送书籍的自定义操作按钮，用于控制书籍推送
   */
  const operationButtonsProps = shallowRef<OperationProps>({
    width: 300,
    showNumber: 4,
    buttons: [
      {
        text: t("demoBook.submitBook"),
        code: "submit",
        confirm: {
          title: row => {
            return t("demoBook.confirmSubmitBook", { name: row.name });
          }
        },
        props: {
          type: "primary",
          icon: useRenderIcon(Upload),
          link: true
        },
        onClick: ({ row, loading }) => {
          loading.value = true;
          handleOperation({
            t,
            apiReq: api.submit(row?.pk ?? row?.id),
            success() {
              tableRef.value.handleGetData();
            },
            requestEnd() {
              loading.value = false;
            }
          });
        },
        show: auth.submit && 5
      },
      {
        text: t("demoBook.pushBook"),
        code: "push",
        confirm: {
          title: row => {
            return t("demoBook.confirmPushBook", { name: row.name });
          }
        },
        props: {
          type: "success",
          icon: useRenderIcon(CircleClose),
          link: true
        },
        onClick: ({ row, loading }) => {
          loading.value = true;
          handleOperation({
            t,
            apiReq: api.push(row?.pk ?? row?.id),
            success() {
              tableRef.value.handleGetData();
            },
            requestEnd() {
              loading.value = false;
            }
          });
        },
        show: auth.push && 6
      }
    ]
  });

  /**
   * 新增表格标题栏按钮
   */
  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [
      {
        text: t("demoBook.pushAll"),
        code: "batchPush",
        props: {
          type: "success",
          icon: useRenderIcon(Success),
          plain: true
        },
        onClick: () => {
          // 这里写处理逻辑
          message(t("results.operateSuccess"));
        },
        confirm: {
          title: t("results.operateConfirmTitle")
        },
        show: auth.push
      }
    ]
  });

  /**
   * 自定义新增或编辑
   */
  const addOrEditOptions = shallowRef<RePlusPageProps["addOrEditOptions"]>({
    props: {
      columns: {
        /**
         * 重写 publisher 组件，可参考 https://plus-pro-components.com/components/config.html
         * @param column
         */
        publisher: ({ column }) => {
          column.valueType = "autocomplete";
          (
            column["fieldProps"] as { fetchSuggestions?: unknown }
          ).fetchSuggestions = fetchPublisherSuggestions;
          return column;
        }
      },
      tabsProps: {
        type: ""
      }
    }
  });

  /**
   * 自定义搜索
   * @param columns
   */
  const searchColumnsFormat = (columns: PageColumn[]) => {
    columns.forEach(column => {
      switch (column._column?.key) {
        case "publisher":
          /**
           * 重写 publisher 组件，可参考 https://plus-pro-components.com/components/config.html
           */
          column.valueType = "autocomplete";
          (
            column["fieldProps"] as { fetchSuggestions?: unknown }
          ).fetchSuggestions = fetchPublisherSuggestions;
          break;
      }
    });
    return columns;
  };
  /**
   * 表格列操作
   * @param columns
   */
  const listColumnsFormat = (columns: PageTableColumn[]) => {
    columns.forEach(column => {
      switch (column._column?.key) {
        case "category":
          column["cellRenderer"] = ({ row }) => {
            return h(ElTag, { type: "success" }, () => row.category.label);
          };
          break;
        case "status": {
          // 上架状态（后端 choices 下发为 {value,label}）：按状态渲染彩色标签
          const statusTagTypes: Record<
            string,
            "success" | "warning" | "info" | "danger"
          > = {
            DRAFT: "info",
            PENDING: "warning",
            ON_SHELF: "success",
            REJECTED: "danger"
          };
          column["cellRenderer"] = ({ row }) => {
            const status = row.status;
            return h(
              ElTag,
              { type: statusTagTypes[status?.value] ?? "info" },
              () => status?.label ?? status
            );
          };
          break;
        }
        case "price":
          // 售价格式化渲染（自定义单元格的又一示例）
          column["cellRenderer"] = ({ row }) =>
            h("span", `￥${Number(row.price ?? 0).toFixed(2)}`);
          break;
      }
    });
    return columns;
  };

  return {
    api,
    auth,
    addOrEditOptions,
    listColumnsFormat,
    searchColumnsFormat,
    tableBarButtonsProps,
    operationButtonsProps
  };
}
