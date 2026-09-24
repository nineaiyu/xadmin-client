<script lang="ts" setup>
import { onMounted, ref } from "vue";
import type { Ref } from "vue";
import { SUCCESS_CODE } from "@/api/types";
import { getKeyList } from "@pureadmin/utils";
import MenuPermissionTree from "./MenuPermissionTree.vue";
import { menuFieldKey } from "../utils/treeKeys";
import type {
  PermissionSubmitPayload,
  PermissionTreeNode
} from "../utils/permissionTree";
import type { BaseApi } from "@/api/base";
import type { Auths } from "@/router/utils";

interface FormProps {
  pk?: string;
  /** 字段权限合成键（`{menuPk}+{fieldPk}`，列表行归一化结果） */
  field?: Array<string | number>;
  /** 字段权限字典（详情口径 `{menuPk: [fieldPk]}`） */
  fields?: object;
  api?: Partial<BaseApi>;
  auth?: Auths;
  /** 菜单树（含字段权限合成节点）；传 ref 可跟随菜单树的异步加载 */
  menuTreeData?: PermissionTreeNode[] | Ref<PermissionTreeNode[]>;
}

/** 授权树暴露的命令式接口 */
type PermissionTreeExpose = {
  setCheckedKeys: (_keys: Array<string | number>) => void;
};

const props = withDefaults(defineProps<FormProps>(), {
  pk: undefined,
  field: () => [],
  fields: () => ({}),
  api: () => ({}),
  auth: () => ({}),
  menuTreeData: () => []
});

const menu = defineModel<Array<string | number>>({ default: () => [] });

const loading = ref(false);
const permissionTreeRef = ref<PermissionTreeExpose>();

const formData = ref<{
  menu: Array<string | number>;
  fields: {
    [key: string]: Array<string | number>;
  };
  field: Array<string | number>;
}>({
  menu: menu.value,
  fields: (props.fields ?? {}) as {
    [key: string]: Array<string | number>;
  },
  field: props.field
});

const emit = defineEmits<{
  change: [
    values: { fields: FormProps["fields"]; menu: Array<string | number> }
  ];
}>();

/** 把「菜单 pk + 字段合成键」回显到授权树（树数据未就绪时由组件缓冲） */
function applyInitialChecked() {
  permissionTreeRef.value?.setCheckedKeys([
    ...formData.value.menu,
    ...formData.value.field
  ]);
}

/** 授权树勾选变化：同步菜单授权与字段权限 */
function onTreeChange(payload: PermissionSubmitPayload) {
  formData.value.menu = payload.menu;
  formData.value.fields = payload.fields;
  menu.value = payload.menu;
  emit("change", { menu: payload.menu, fields: payload.fields });
}

/**
 * 编辑态回显：列表行的 field 为空数组（ListRoleSerializer 口径），
 * 需按 pk 取详情原文（`{menuPk: [fieldPk]}`）后重建合成键。
 */
function getCheckedMenu(pk?: string) {
  if (pk && props.auth.retrieve) {
    loading.value = true;
    props.api
      .retrieve?.(pk)
      .then(({ code, data }) => {
        if (code === SUCCESS_CODE) {
          formData.value.menu = getKeyList(data?.menu ?? [], "pk");
          const field: Array<string | number> = [];
          Object.keys(data?.field ?? {}).forEach(menuPk => {
            (data?.field?.[menuPk] ?? []).forEach(
              (fieldPk: string | number) => {
                field.push(menuFieldKey(menuPk, String(fieldPk)));
              }
            );
          });
          formData.value.field = field;
          applyInitialChecked();
        }
      })
      .catch(() => undefined)
      .finally(() => {
        loading.value = false;
      });
    return;
  }
  applyInitialChecked();
}

onMounted(() => getCheckedMenu(props.pk));
</script>

<template>
  <div class="role-form">
    <MenuPermissionTree
      ref="permissionTreeRef"
      :data="menuTreeData"
      :loading="loading"
      @change="onTreeChange"
    />
  </div>
</template>

<style lang="scss" scoped>
.role-form {
  width: 100%;
}
</style>
