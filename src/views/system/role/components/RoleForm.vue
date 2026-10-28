<script lang="ts" setup>
import { onMounted, ref } from "vue";
import type { Ref } from "vue";
import { isSuccess } from "@/api/types";
import { getKeyList } from "@pureadmin/utils";
import { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import MenuPermissionTree from "@/components/ReMenuPermissionTree";
import { menuFieldKey } from "@/components/ReMenuPermissionTree";
import type {
  PermissionSubmitPayload,
  PermissionTreeNode
} from "@/components/ReMenuPermissionTree";
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
/** 回显失败标记：为 true 时遮罩授权树并禁止交互（空树上勾选 = 提交不完整授权） */
const loadFailed = ref(false);
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

const { t } = useI18n();

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
 * 回显失败统一处置：标记失败 + 用列表行原值回填树（表单提交值同样取自行，
 * 树与提交值保持一致，避免「树空但提交原值」的观感误导），并遮罩禁止交互。
 */
function handleLoadFailed() {
  loadFailed.value = true;
  applyInitialChecked();
}

/**
 * 编辑态回显：列表行的 field 为空数组（ListRoleSerializer 口径），
 * 需按 pk 取详情原文（`{menuPk: [fieldPk]}`）后重建合成键。
 *
 * 失败必须显式提示并遮罩树：静默 catch 会让授权树呈空，用户误以为
 * 「该角色没有权限」并在空树上勾选后提交不完整授权。
 */
function getCheckedMenu(pk?: string) {
  if (pk && props.auth.retrieve) {
    loading.value = true;
    props.api
      .retrieve?.(pk)
      .then(res => {
        const data = res.data;
        if (isSuccess(res)) {
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
          loadFailed.value = false;
          applyInitialChecked();
        } else {
          // 业务码失败（如 403 无 retrieve 权限）：同样按回显失败处理
          handleLoadFailed();
          message(String(res.detail || t("results.failed")), { type: "error" });
        }
      })
      .catch(error => {
        handleLoadFailed();
        message(
          String(error?.detail || error?.message || t("results.failed")),
          {
            type: "error"
          }
        );
      })
      .finally(() => {
        loading.value = false;
      });
    return;
  }
  if (pk) {
    // 编辑态缺 retrieve：无法回显现有授权（列表行 menu 恒为空），空树上提交
    // 会清空角色全部授权——按回显失败遮罩树并禁止交互（列表页已禁编辑，此处兜底）
    handleLoadFailed();
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
    <!-- 回显失败遮罩：阻止在空树上勾选后提交不完整授权（关闭弹层重试） -->
    <div v-if="loadFailed" class="role-form__failed-mask">
      <span>{{ t("results.loadFailedRetry") }}</span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.role-form {
  position: relative;
  width: 100%;

  &__failed-mask {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--el-font-size-small);
    color: var(--el-color-danger);
    background: var(--el-mask-color-extra-light);
  }
}
</style>
