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
import { message } from "@/utils/message";
import { ElTag } from "element-plus";

export function useDemoBook(tableRef: Ref) {
  // 权限判断，用于判断是否有该权限
  const api = reactive(bookApi);
  const auth = reactive({
    push: false,
    ...getDefaultAuths(getCurrentInstance(), ["push"])
  });
  const { t } = useI18n();

  /**
   * 添加一个推送书籍的自定义操作按钮，用于控制书籍推送
   */
  const operationButtonsProps = shallowRef<OperationProps>({
    width: 300,
    showNumber: 4,
    buttons: [
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
        text: "全部推送",
        code: "batchPush",
        props: {
          type: "success",
          icon: useRenderIcon(Success),
          plain: true
        },
        onClick: () => {
          // 这里写处理逻辑
          message("操作成功");
        },
        confirm: {
          title: "确定操作？"
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
          column["fieldProps"]["fetchSuggestions"] = (
            queryString: string,
            cb: any
          ) => {
            const queryList = [
              { value: "人民出版社" },
              { value: "中华书局" },
              { value: "科学出版社" }
            ];

            const results = queryString
              ? queryList.filter(
                  item =>
                    item.value
                      .toLowerCase()
                      .indexOf(queryString.toLowerCase()) === 0
                )
              : queryList;
            cb(results);
          };
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
          column["fieldProps"]["fetchSuggestions"] = (
            queryString: string,
            cb: any
          ) => {
            const queryList = [
              { value: "人民出版社" },
              { value: "中华书局" },
              { value: "科学出版社" }
            ];

            const results = queryString
              ? queryList.filter(
                  item =>
                    item.value
                      .toLowerCase()
                      .indexOf(queryString.toLowerCase()) === 0
                )
              : queryList;
            cb(results);
          };
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
