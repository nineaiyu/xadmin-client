import { useRouter } from "vue-router";
import { goUserDetail } from "@/views/system/hooks";
import { shallowRef } from "vue";
import { userConfigApi } from "@/api/system/config/user";
import {
  defineListPage,
  type RePlusPageProps,
  formatPageColumns
} from "@/components/RePlusPage";
import type { RecordType } from "plus-pro-components";
import { useConfigPage } from "../../useConfigPage";

type OwnerRow = {
  owner?: { username?: string; pk?: number | string };
};

export function useUserConfig() {
  const router = useRouter();

  /** 行内 `owner` 嵌套字段（点击跳转 SystemUser 详情） */
  const onGoUserDetail = (row: OwnerRow) => {
    goUserDetail(router, row.owner?.pk);
  };

  return defineListPage({
    api: userConfigApi,
    localeName: "configUser",
    extraAuth: ["invalid"],
    columns: ({ columns }) =>
      formatPageColumns(columns, {
        owner: column => {
          column["cellRenderer"] = ({ row }) => (
            <el-link onClick={() => onGoUserDetail(row)}>
              {row.owner?.username ? row.owner?.username : "/"}
            </el-link>
          );
        }
      }),
    formOptions: ({ t }) =>
      shallowRef<RePlusPageProps["addOrEditOptions"]>({
        props: {
          row: {
            config_user: ({ rawRow }: { rawRow?: RecordType }) => {
              return rawRow?.owner ? [rawRow?.owner] : [];
            }
          },
          columns: {
            config_user: ({ column, isAdd }) => {
              if (!isAdd) {
                const fieldProps = column["fieldProps"] as {
                  disabled?: boolean;
                  placeholder?: string;
                };
                fieldProps.disabled = true;
                fieldProps.placeholder = t("configUser.lockedTip");
              }
              return column;
            }
          }
        }
      }),
    // 权限表与「清除缓存」行内按钮由配置页共用壳装配（invalid:UserConfig）
    buttons: ({ t, api, auth, tableRef }) =>
      useConfigPage({
        t,
        api,
        auth,
        tableRef,
        invalidText: t("configUser.invalidCache"),
        invalidConfirmTitle: t("configUser.confirmInvalid")
      })
  });
}
