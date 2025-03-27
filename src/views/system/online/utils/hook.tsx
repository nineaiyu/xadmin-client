import { useI18n } from "vue-i18n";
import { userOnlineApi } from "@/api/system/online";
import { useRouter } from "vue-router";
import { getDefaultAuths, hasAuth } from "@/router/utils";
import { getCurrentInstance, reactive, shallowRef } from "vue";
import type { PageTableColumn, OperationProps } from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import Logout from "~icons/ri/logout-circle-r-line";

export function useUserOnline() {
  const { t } = useI18n();
  const api = reactive(userOnlineApi);

  const auth = reactive({
    ...getDefaultAuths(getCurrentInstance())
  });

  const router = useRouter();
  const operationButtonsProps = shallowRef<OperationProps>({
    width: 180,
    buttons: [
      {
        text: t("systemUser.logout"),
        code: "delete",
        props: (row, button) => {
          return {
            ...button?._?.props,
            icon: useRenderIcon(Logout)
          };
        },
        update: true,
        show: auth.destroy
      }
    ]
  });
  const listColumnsFormat = (columns: PageTableColumn[]) => {
    columns.forEach(column => {
      switch (column._column?.key) {
        case "creator":
          column["cellRenderer"] = ({ row }) => (
            <el-link onClick={() => onGoDetail(row as any)}>
              {row.creator?.username ? row.creator?.username : "/"}
            </el-link>
          );
          break;
      }
    });
    return columns;
  };

  function onGoDetail(row: any) {
    if (hasAuth("list:SystemUser") && row?.creator && row?.creator?.pk) {
      router.push({
        name: "SystemUser",
        query: { pk: row.creator.pk }
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
