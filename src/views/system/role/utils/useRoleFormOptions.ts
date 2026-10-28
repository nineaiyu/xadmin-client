import { h, ref, shallowRef } from "vue";
import { getKeyList } from "@pureadmin/utils";
import type { roleApi } from "@/api/identity/role";
import menuFieldForm from "../components/RoleForm.vue";
import type { RePlusPageProps } from "@/components/RePlusPage";
import type { PermissionTreeNode } from "@/components/ReMenuPermissionTree/utils/permissionTree";
import type { RecordType } from "plus-pro-components";
import { roleFieldFormValue } from "./roleFormValues";
import type { Ref } from "vue";

import { dialogSize } from "@/components/ReDialog/size";
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
  /**
   * 本次弹层是否触碰过授权树：未触碰时 menu/fields 一律不提交（后端「未提交键
   * 不覆盖」），避免回显延迟/失败时空值覆盖既有授权；触碰后 fields 的 `{}`
   * 才表示「显式清空字段白名单」。
   */
  const permissionsTouched = ref(false);
  /** 授权树最新的字段权限字典（树是唯一事实源；不依赖隐藏表单列是否被同步） */
  const permissionsFields = ref<Record<string, Array<string | number>> | null>(
    null
  );

  const addOrEditOptions = shallowRef<RePlusPageProps["addOrEditOptions"]>({
    props: {
      // 弹层打开时重置（row 解析器每次打开只求值一次）
      beforeSubmit: ({ formData, formOptions }) => {
        if (!formOptions.isAdd && !permissionsTouched.value) {
          // 未触碰授权树：不提交 menu/fields（后端按「未提交键不覆盖」保留）
          const { menu: _menu, fields: _fields, ...rest } = formData;
          return rest;
        }
        if (!permissionsTouched.value) return formData;
        // 隐藏的 fields 列不会随树勾选进入表单模型：提交时以树的最新字典为准
        return { ...formData, fields: permissionsFields.value ?? {} };
      },
      row: {
        field: ({ rawRow }: { rawRow?: RecordType }) => {
          permissionsTouched.value = false;
          permissionsFields.value = null;
          return roleFieldFormValue(rawRow?.field);
        },
        menu: ({ rawRow }: { rawRow?: RecordType }) => {
          return getKeyList(rawRow?.menu ?? [], "pk") ?? [];
        },
        fields: ({ rawRow }: { rawRow?: RecordType }) => {
          // 后端 fields 必填：新增态即使未勾选字段也要带上空字典；
          // 编辑态未触碰授权树时由 beforeSubmit 剔除该键（保留原授权）
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
                // 授权树只在用户操作后回调（回显不触发）：标记后 menu/fields 才随表单提交
                permissionsTouched.value = true;
                permissionsFields.value = (fields ?? {}) as Record<
                  string,
                  Array<string | number>
                >;
                if (formValue?.value) formValue.value.fields = fields;
                onChange(menu);
              }
            });
          };
          return column;
        }
      },
      dialogDrawerOptions: {
        // 授权树节点含类型标签 / 权限码 / 状态标识，宽度不足会被裁剪
        width: dialogSize("xxl")
      }
    }
  });

  return {
    addOrEditOptions
  };
}
