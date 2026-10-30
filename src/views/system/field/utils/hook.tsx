import Money from "~icons/ep/money";
import { modelLabelFieldApi } from "@/api/system/field";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { shallowRef } from "vue";
import {
  defineListPage,
  handleOperation,
  type OperationProps
} from "@/components/RePlusPage";

export function useModelField() {
  const page = defineListPage({
    api: modelLabelFieldApi,
    localeName: "modelFieldManagement",
    extraAuth: ["sync"],
    buttons: ({ t, api, auth, tableRef }) => ({
      tableBarButtonsProps: shallowRef<OperationProps>({
        buttons: [
          {
            text: t("modelFieldManagement.makeData"),
            code: "sync",
            props: {
              type: "primary",
              plain: true,
              icon: useRenderIcon(Money)
            },
            onClick: ({ loading }) => {
              loading.value = true;
              handleOperation({
                t,
                apiReq: api.sync(),
                success() {
                  tableRef.value.handleGetData();
                },
                requestEnd() {
                  loading.value = false;
                }
              });
            },
            show: auth.sync
          }
        ]
      })
    })
  });

  // 只读台账：字段维护走 sync / 维护命令，页面不提供新增、编辑与导入
  // （后端视图已不再暴露 create / update / import 动作，按钮必须同步隐藏）
  page.auth.create = false;
  page.auth.update = false;
  page.auth.partialUpdate = false;
  page.auth.importData = false;
  // 删除同样关闭：批量删除会把字段从所有角色的字段权限白名单里连带抹掉
  page.auth.destroy = false;
  page.auth.batchDestroy = false;

  return page;
}
