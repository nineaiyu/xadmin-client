import { h, shallowRef } from "vue";
import { getKeyList } from "@pureadmin/utils";
import type { roleApi } from "@/api/identity/role";
import menuFieldForm from "../components/RoleForm.vue";
import type { RePlusPageProps } from "@/components/RePlusPage";
import type { PermissionTreeNode } from "./permissionTree";
import type { RecordType } from "plus-pro-components";
import { roleFieldFormValue } from "./roleFormValues";
import type { Ref } from "vue";

type RoleApiLike = Partial<typeof roleApi>;
type RoleAuth = Record<string, boolean | undefined>;

/**
 * 角色新增/编辑弹层装配（授权树）。
 * 自 useRole 拆出（行为不变）：field/menu/fields 行值归一化（键约定见 ./treeKeys.ts）
 * 与授权树渲染器（传 menuTreeData ref 以支持树晚于弹窗渲染的勾选回显）。
 */
export function useRoleFormOptions({
  api,
  auth,
  menuTreeData
}: {
  api: RoleApiLike;
  auth: RoleAuth;
  menuTreeData: Ref<PermissionTreeNode[]>;
}) {
  const addOrEditOptions = shallowRef<RePlusPageProps["addOrEditOptions"]>({
    props: {
      row: {
        field: ({ rawRow }: { rawRow?: RecordType }) => {
          return roleFieldFormValue(rawRow?.field);
        },
        menu: ({ rawRow }: { rawRow?: RecordType }) => {
          return getKeyList(rawRow?.menu ?? [], "pk") ?? [];
        },
        fields: ({ rawRow }: { rawRow?: RecordType }) => {
          // 后端 fields 必填：未在授权树勾选任何字段授权时也要带上空字典
          // （空字典 = 该角色无字段权限；编辑态后端对空字典不做替换，保留原权限）
          return rawRow?.fields ?? {};
        }
      },
      columns: {
        fields: ({ column }) => {
          column["hideInForm"] = true;
          return column;
        },
        menu: ({ column, formValue }) => {
          column["fieldProps"] = {};
          column["renderField"] = (
            value: unknown,
            onChange: (val: unknown) => void
          ) => {
            return h(menuFieldForm, {
              api,
              auth,
              pk: formValue?.value?.pk,
              modelValue: value as Array<string | number>,
              field: formValue?.value?.field,
              // 传 ref 而非快照：菜单树晚于弹窗渲染完成时仍能回显勾选
              menuTreeData,
              onChange: ({
                fields,
                menu
              }: {
                fields: object | undefined;
                menu: Array<string | number>;
              }) => {
                if (formValue?.value) formValue.value.fields = fields;
                onChange(menu);
              }
            });
          };
          return column;
        }
      },
      minWidth: "860px",
      dialogDrawerOptions: {
        // 授权树节点含类型标签 / 权限码 / 状态标识，宽度不足会被裁剪
        width: "72vw"
      }
    }
  });

  return {
    addOrEditOptions
  };
}
