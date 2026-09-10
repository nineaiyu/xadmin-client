<script lang="ts" setup>
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { deptApi } from "@/api/system/dept";
import type { DeptPreviewResult } from "@/api/types/permission-preview";

defineOptions({ name: "DeptPermissionPreview" });

const { t } = useI18n();

const visible = ref(false);
const loading = ref(false);
const data = ref<DeptPreviewResult | null>(null);

/** el-tree 只读展示配置 */
const treeProps = { label: "title", children: "children" };

async function load(pk: string | number) {
  loading.value = true;
  try {
    const res = await deptApi.preview(pk);
    data.value = res.data;
  } finally {
    loading.value = false;
  }
}

function open(row: Record<string, unknown>) {
  visible.value = true;
  data.value = null;
  load(String(row.pk));
}

defineExpose({ open });
</script>

<template>
  <el-drawer
    v-model="visible"
    :title="t('permissionPreview.deptTitle')"
    size="70%"
    destroy-on-close
  >
    <div v-loading="loading">
      <template v-if="data">
        <!-- 部门信息 -->
        <el-descriptions
          :title="t('permissionPreview.deptInfo')"
          :column="3"
          border
          size="small"
        >
          <el-descriptions-item :label="t('systemDept.name')">
            {{ data.dept.name }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('systemDept.code')">
            {{ data.dept.code }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('permissionPreview.status')">
            <el-tag
              :type="data.dept.is_active ? 'success' : 'info'"
              size="small"
            >
              {{
                data.dept.is_active
                  ? t("permissionPreview.enabled")
                  : t("permissionPreview.disabled")
              }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item :label="t('permissionPreview.deptParent')">
            {{ data.dept.parent?.name || "-" }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('permissionPreview.deptLeader')">
            <span v-if="data.dept.leader">
              {{ data.dept.leader.nickname || data.dept.leader.username }}
            </span>
            <span v-else>-</span>
          </el-descriptions-item>
          <el-descriptions-item :label="t('permissionPreview.deptChildren')">
            {{ data.dept.active_child_count }} / {{ data.dept.child_count }}
          </el-descriptions-item>
        </el-descriptions>

        <el-alert
          v-for="note in data.notes"
          :key="note"
          :title="note"
          class="mt-2"
          :closable="false"
          show-icon
          type="info"
        />

        <el-collapse
          class="mt-3"
          :model-value="['roles', 'menu', 'data', 'field', 'users']"
        >
          <!-- 挂载角色 -->
          <el-collapse-item
            :title="`${t('permissionPreview.rolesGranted')}（${data.roles.length}）`"
            name="roles"
          >
            <div v-if="data.roles.length" class="flex flex-wrap gap-1">
              <el-tag
                v-for="role in data.roles"
                :key="role.pk"
                :type="role.is_active ? 'primary' : 'info'"
                size="small"
              >
                {{ role.name }}（{{ role.code }}）
              </el-tag>
            </div>
            <el-empty
              v-else
              :description="t('permissionPreview.noRoles')"
              :image-size="70"
            />
          </el-collapse-item>

          <!-- 可见菜单（部门角色并集） -->
          <el-collapse-item
            :title="t('permissionPreview.menuTree')"
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
                  <el-tag size="small" type="info">{{ node.name }}</el-tag>
                </span>
              </template>
            </el-tree>
            <el-empty
              v-else
              :description="t('permissionPreview.emptyMenus')"
              :image-size="70"
            />
          </el-collapse-item>

          <!-- 部门数据权限 -->
          <el-collapse-item
            :title="`${t('permissionPreview.dataGrant')}（${data.data_permissions.rules.length}）`"
            name="data"
          >
            <el-alert
              v-if="!data.data_permissions.enabled"
              :title="t('permissionPreview.dataDisabled')"
              class="mb-2"
              :closable="false"
              show-icon
              type="info"
            />
            <template v-if="data.data_permissions.rules.length">
              <div
                v-for="group in data.data_permissions.rules"
                :key="group.pk"
                class="mb-3"
              >
                <div class="mb-1 flex items-center gap-1 text-sm font-medium">
                  <span>{{ group.name }}</span>
                  <el-tooltip
                    v-if="group.menu_scoped"
                    :content="t('permissionPreview.menuScopedHint')"
                  >
                    <el-tag size="small" type="warning">
                      {{ t("permissionPreview.boundMenus") }}
                    </el-tag>
                  </el-tooltip>
                </div>
                <div class="text-sm text-gray-600">{{ group.rule_text }}</div>
              </div>
            </template>
            <el-empty
              v-else
              :description="t('permissionPreview.noGrantAtLevel')"
              :image-size="70"
            />
          </el-collapse-item>

          <!-- 字段权限（部门角色配置） -->
          <el-collapse-item
            :title="`${t('permissionPreview.fieldPermission')}（${data.field_permissions.length}）`"
            name="field"
          >
            <el-alert
              v-if="!data.field_permission_enabled"
              :title="t('permissionPreview.fieldDisabled')"
              class="mb-2"
              :closable="false"
              show-icon
              type="info"
            />
            <el-alert
              :title="t('permissionPreview.fieldBlank')"
              class="mb-2"
              :closable="false"
              show-icon
              type="info"
            />
            <el-table
              v-if="data.field_permissions.length"
              :data="data.field_permissions"
              border
              size="small"
            >
              <el-table-column
                :label="t('permissionPreview.colMenu')"
                min-width="140"
                prop="menu.title"
              />
              <el-table-column
                :label="t('permissionPreview.colRole')"
                min-width="120"
                prop="role.name"
              />
              <el-table-column
                :label="t('permissionPreview.colModel')"
                min-width="160"
              >
                <template #default="{ row }">
                  <span v-for="model in row.models" :key="model.model">
                    {{ model.model_label }} ({{ model.model }})
                    <div class="mt-1 flex flex-wrap gap-1">
                      <el-tag
                        v-for="(label, index) in model.field_labels"
                        :key="model.fields[index]"
                        class="mr-1"
                        size="small"
                      >
                        {{ label }}
                      </el-tag>
                    </div>
                  </span>
                </template>
              </el-table-column>
            </el-table>
          </el-collapse-item>

          <!-- 成员采样 -->
          <el-collapse-item
            :title="`${t('permissionPreview.deptMembers')}（${data.users.total}）`"
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
              class="mb-2"
              :closable="false"
              show-icon
              type="warning"
            />
            <el-table
              v-if="data.users.list.length"
              :data="data.users.list"
              border
              size="small"
            >
              <el-table-column
                :label="t('systemUser.username')"
                prop="username"
              />
              <el-table-column
                :label="t('systemUser.nickname')"
                prop="nickname"
              />
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
            </el-table>
            <el-empty
              v-else
              :description="t('permissionPreview.emptyUsers')"
              :image-size="70"
            />
          </el-collapse-item>
        </el-collapse>
      </template>
    </div>
  </el-drawer>
</template>
