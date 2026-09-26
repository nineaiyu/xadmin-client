<script lang="ts" setup>
import ReEmpty from "@/components/ReEmpty";
import { useI18n } from "vue-i18n";
import { roleApi } from "@/api/system/role";
import type { RolePreviewResult } from "@/api/types/permission-preview";
import {
  PreviewMenuTree,
  PreviewUsersTable,
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

const { loading, data } = usePermissionPreview<RolePreviewResult>(
  async pk => (await roleApi.preview(pk)).data,
  () => props.row.pk
);
</script>

<template>
  <div v-loading="loading">
    <template v-if="data">
      <el-descriptions :column="3" border size="small">
        <el-descriptions-item :label="t('systemRole.name')">
          {{ data.role.name }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('systemRole.code')">
          {{ data.role.code }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('permissionPreview.status')">
          <el-tag :type="data.role.is_active ? 'success' : 'info'" size="small">
            {{
              data.role.is_active
                ? t("permissionPreview.enabled")
                : t("permissionPreview.disabled")
            }}
          </el-tag>
        </el-descriptions-item>
      </el-descriptions>

      <el-collapse class="mt-3" :model-value="['menu', 'field', 'users']">
        <el-collapse-item :title="t('permissionPreview.roleMenus')" name="menu">
          <PreviewMenuTree :data="data.menu_tree" show-code-tag />
        </el-collapse-item>

        <el-collapse-item
          :title="t('permissionPreview.roleFields')"
          name="field"
        >
          <ReEmpty
            v-if="!data.field_permissions.length"
            :description="t('permissionPreview.fieldBlank')"
            :image-size="70"
          />
          <el-collapse v-else>
            <el-collapse-item
              v-for="item in data.field_permissions"
              :key="item.menu.pk"
              :title="item.menu.title"
            >
              <div v-for="model in item.models" :key="model.model" class="mb-2">
                <div class="mb-1 text-sm font-medium">
                  {{ model.model_label }} ({{ model.model }})
                </div>
                <el-tag
                  v-for="(label, index) in model.field_labels"
                  :key="model.fields[index]"
                  size="small"
                  class="mr-1 mb-0.5"
                >
                  {{ label }}
                </el-tag>
              </div>
            </el-collapse-item>
          </el-collapse>
        </el-collapse-item>

        <el-collapse-item
          :title="`${t('permissionPreview.users')}（${data.users.total}）`"
          name="users"
        >
          <PreviewUsersTable :data="data.users" show-dept />
        </el-collapse-item>
      </el-collapse>
    </template>
  </div>
</template>
