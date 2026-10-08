import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { goUserDetail } from "@/views/system/hooks";
import { reactive, shallowRef, type Ref } from "vue";
import { userConfigApi } from "@/api/system/config/user";
import {
  type PageTableColumn,
  type RePlusPageProps,
  formatPageColumns
} from "@/components/RePlusPage";
import type { RecordType } from "plus-pro-components";
import { useConfigPage } from "../../useConfigPage";

export function useUserConfig(tableRef: Ref) {
  const { t } = useI18n();

  const api = reactive(userConfigApi);

  // 权限表与「清除缓存」行内按钮由配置页共用壳装配（invalid:UserConfig）
  const { auth, operationButtonsProps } = useConfigPage({
    t,
    api,
    tableRef,
    invalidText: t("configUser.invalidCache"),
    invalidConfirmTitle: t("configUser.confirmInvalid")
  });

  const addOrEditOptions = shallowRef<RePlusPageProps["addOrEditOptions"]>({
    props: {
      row: {
        config_user: ({ rawRow }: { rawRow?: RecordType }) => {
          return rawRow?.owner ? [rawRow?.owner] : [];
        }
      },
      columns: {
        config_user: ({ column, isAdd }) => {
          if (!isAdd) {
            (column["fieldProps"] as { disabled?: boolean })["disabled"] = true;
          }
          return column;
        }
      }
    }
  });

  const listColumnsFormat = (columns: PageTableColumn[]) =>
    formatPageColumns(columns, {
      owner: column => {
        column["cellRenderer"] = ({ row }) => (
          <el-link onClick={() => onGoUserDetail(row)}>
            {row.owner?.username ? row.owner?.username : "/"}
          </el-link>
        );
      }
    });

  const router = useRouter();

  /** 行内 `owner` 嵌套字段（点击跳转 SystemUser 详情） */
  type OwnerRow = {
    owner?: { username?: string; pk?: number | string };
  };

  const onGoUserDetail = (row: OwnerRow) => {
    goUserDetail(router, row.owner?.pk);
  };

  return {
    api,
    auth,
    addOrEditOptions,
    listColumnsFormat,
    operationButtonsProps
  };
}
