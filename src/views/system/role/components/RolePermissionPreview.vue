<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import { roleApi } from "@/api/identity/role";
import type { RolePreviewResult } from "@/api/types/permission-preview";
import ReEmpty from "@/components/ReEmpty";
import {
  PreviewDescriptions,
  PreviewFieldMatrix,
  PreviewMenuTree,
  PreviewStatusTag,
  PreviewUsersTable,
  RePermissionPreviewShell,
  toFieldMatrixEntries,
  usePermissionPreview
} from "@/components/RePermissionPreview";

defineOptions({ name: "RolePermissionPreview" });

/**
 * 角色权限只读预览（弹层内容组件形态）。
 *
 * 由页面经 `addDrawer` 打开（抽屉体系收敛，不在模板手挂 el-drawer）：
 * 挂载即按行主键加载数据，关闭即销毁（destroyOnClose）。
 */
const props = defineProps<{ row: { pk?: string | number } }>();

const { t } = useI18n();

const { loading, data: preview } = usePermissionPreview<RolePreviewResult>(
  async pk => (await roleApi.preview(pk)).data,
  () => props.row.pk
);
</script>

<template>
  <RePermissionPreviewShell
    v-slot="{ data }"
    :loading="loading"
    :data="preview"
  >
    <PreviewDescriptions>
      <el-descriptions-item :label="t('systemRole.name')">
        {{ data.role.name }}
      </el-descriptions-item>
      <el-descriptions-item :label="t('systemRole.code')">
        {{ data.role.code }}
      </el-descriptions-item>
      <el-descriptions-item :label="t('permissionPreview.status')">
        <PreviewStatusTag :active="data.role.is_active" />
      </el-descriptions-item>
    </PreviewDescriptions>

    <el-collapse class="mt-3" :model-value="['menu', 'field', 'users']">
      <el-collapse-item :title="t('permissionPreview.roleMenus')" name="menu">
        <PreviewMenuTree :data="data.menu_tree" show-code-tag />
      </el-collapse-item>

      <el-collapse-item :title="t('permissionPreview.roleFields')" name="field">
        <ReEmpty
          v-if="!data.field_permissions.length"
          :description="t('permissionPreview.fieldBlank')"
          :image-size="70"
        />
        <PreviewFieldMatrix
          v-else
          variant="collapse"
          :entries="toFieldMatrixEntries(data.field_permissions)"
        />
      </el-collapse-item>

      <el-collapse-item
        :title="`${t('permissionPreview.users')}（${data.users.total}）`"
        name="users"
      >
        <PreviewUsersTable :data="data.users" show-dept />
      </el-collapse-item>
    </el-collapse>
  </RePermissionPreviewShell>
</template>
