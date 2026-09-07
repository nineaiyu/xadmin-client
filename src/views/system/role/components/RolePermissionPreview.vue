<script lang="ts" setup>
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { roleApi } from "@/api/system/role";
import type { RolePreviewResult } from "@/api/types/permission-preview";

defineOptions({ name: "RolePermissionPreview" });

const { t } = useI18n();

const visible = ref(false);
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

function open(row: { pk: string | number }) {
  visible.value = true;
  data.value = null;
  load(String(row.pk));
}

defineExpose({ open });
</script>

<template>
  <el-drawer
    v-model="visible"
    :title="t('permissionPreview.roleTitle')"
    size="60%"
    destroy-on-close
  >
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
            <el-tag
              :type="data.role.is_active ? 'success' : 'info'"
              size="small"
            >
              {{
                data.role.is_active
                  ? t("permissionPreview.enabled")
                  : t("permissionPreview.disabled")
              }}
            </el-tag>
          </el-descriptions-item>
        </el-descriptions>

        <el-collapse class="mt-3" :model-value="['menu', 'field', 'users']">
          <el-collapse-item
            :title="t('permissionPreview.roleMenus')"
            name="menu"
          >
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
                  <el-tag
                    v-if="node.menu_type === 2"
                    size="small"
                    type="warning"
                  >
                    {{ t("permissionPreview.codeTag") }}
                  </el-tag>
                  <el-tag v-else size="small" type="info">{{
                    node.name
                  }}</el-tag>
                </span>
              </template>
            </el-tree>
            <el-empty
              v-else
              :description="t('permissionPreview.emptyMenus')"
              :image-size="70"
            />
          </el-collapse-item>

          <el-collapse-item
            :title="t('permissionPreview.roleFields')"
            name="field"
          >
            <el-empty
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
                <div
                  v-for="model in item.models"
                  :key="model.model"
                  class="mb-2"
                >
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
              <el-table-column
                :label="t('permissionPreview.status')"
                width="90"
              >
                <template #default="{ row }">
                  <el-tag
                    :type="row.is_active ? 'success' : 'info'"
                    size="small"
                  >
                    {{
                      row.is_active
                        ? t("permissionPreview.enabled")
                        : t("permissionPreview.disabled")
                    }}
                  </el-tag>
                </template>
              </el-table-column>
              <template #empty>
                <el-empty
                  :description="t('permissionPreview.emptyUsers')"
                  :image-size="70"
                />
              </template>
            </el-table>
          </el-collapse-item>
        </el-collapse>
      </template>
    </div>
  </el-drawer>
</template>
