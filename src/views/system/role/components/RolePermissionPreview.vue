<script lang="ts" setup>
import ReEmpty from "@/components/ReEmpty";
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { roleApi } from "@/api/system/role";
import type { RolePreviewResult } from "@/api/types/permission-preview";

defineOptions({ name: "RolePermissionPreview" });

/**
 * 角色权限只读预览（弹层内容组件形态）。
 *
 * 由页面经 `addDrawer` 打开（抽屉体系收敛，不在模板手挂 el-drawer）：
 * 挂载即按行主键加载数据，关闭即销毁（destroyOnClose）。
 */
const props = defineProps<{ row: { pk?: string | number } }>();

const { t } = useI18n();

const loading = ref(false);
const data = ref<RolePreviewResult | null>(null);

const treeProps = { label: "title", children: "children" };

async function load(pk: string) {
  loading.value = true;
  try {
    const res = await roleApi.preview(pk);
    data.value = res.data;
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  data.value = null;
  load(String(props.row.pk));
});
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
          <el-tree
            v-if="data.menu_tree.length"
            :data="data.menu_tree"
            :props="treeProps"
            node-key="pk"
            default-expand-all
          >
            <template #default="{ data: node }">
              <span class="flex items-center gap-1">
                <span>{{ node.title }}</span>
                <el-tag v-if="node.menu_type === 2" size="small" type="warning">
                  {{ t("permissionPreview.codeTag") }}
                </el-tag>
                <el-tag v-else size="small" type="info">{{ node.name }}</el-tag>
              </span>
            </template>
          </el-tree>
          <ReEmpty
            v-else
            :description="t('permissionPreview.emptyMenus')"
            :image-size="70"
          />
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
          <el-alert
            v-if="data.users.truncated"
            :title="
              t('permissionPreview.sampleTruncated', {
                limit: data.users.sample_limit,
                total: data.users.total
              })
            "
            type="info"
            :closable="false"
            show-icon
            class="mb-2"
          />
          <el-table :data="data.users.list" size="small" border>
            <el-table-column
              prop="username"
              :label="t('systemUser.username')"
              min-width="120"
            />
            <el-table-column
              prop="nickname"
              :label="t('systemUser.nickname')"
              min-width="120"
            />
            <el-table-column
              :label="t('permissionPreview.dept')"
              min-width="140"
            >
              <template #default="{ row }">
                {{ row.dept?.name ?? "-" }}
              </template>
            </el-table-column>
            <el-table-column :label="t('permissionPreview.status')" width="90">
              <template #default="{ row }">
                <el-tag :type="row.is_active ? 'success' : 'info'" size="small">
                  {{
                    row.is_active
                      ? t("permissionPreview.enabled")
                      : t("permissionPreview.disabled")
                  }}
                </el-tag>
              </template>
            </el-table-column>
            <template #empty>
              <ReEmpty
                :description="t('permissionPreview.emptyUsers')"
                :image-size="70"
              />
            </template>
          </el-table>
        </el-collapse-item>
      </el-collapse>
    </template>
  </div>
</template>
