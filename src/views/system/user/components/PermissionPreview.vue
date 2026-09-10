<script lang="ts" setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { userApi } from "@/api/system/user";
import type { UserPreviewResult } from "@/api/types/permission-preview";
import { hasAuth } from "@/router/utils";
import PreviewDataPermission from "./preview/PreviewDataPermission.vue";
import PreviewTrial from "./preview/PreviewTrial.vue";

defineOptions({ name: "PermissionPreview" });

const { t } = useI18n();

/** 试算有独立权限码：缺失时只提示，不发必然 403 的请求 */
const canTrial = computed(() => hasAuth("previewTrial:SystemUser"));

const visible = ref(false);
const loading = ref(false);
const data = ref<UserPreviewResult | null>(null);
const keyword = ref("");

/** el-tree 只读展示配置 */
const treeProps = { label: "title", children: "children" };

const METHOD_TAG_TYPES: Record<
  string,
  "primary" | "success" | "warning" | "danger" | "info"
> = {
  GET: "primary",
  POST: "success",
  PUT: "warning",
  DELETE: "danger",
  PATCH: "info"
};

/** API 码按关键字过滤（code/path/title） */
const filteredApiPermissions = computed(() => {
  const items = data.value?.api_permissions ?? [];
  const kw = keyword.value.trim().toLowerCase();
  if (!kw) return items;
  return items.filter(
    item =>
      item.code.toLowerCase().includes(kw) ||
      item.path.toLowerCase().includes(kw) ||
      item.title.toLowerCase().includes(kw)
  );
});

async function load(pk: string) {
  loading.value = true;
  try {
    const res = await userApi.preview(pk);
    data.value = res.data;
  } finally {
    loading.value = false;
  }
}

function open(row: { pk: string | number }) {
  visible.value = true;
  data.value = null;
  keyword.value = "";
  load(String(row.pk));
}

defineExpose({ open });
</script>

<template>
  <el-drawer
    v-model="visible"
    :title="t('permissionPreview.userTitle')"
    size="70%"
    destroy-on-close
  >
    <div v-loading="loading">
      <template v-if="data">
        <!-- 基本信息 -->
        <el-descriptions
          :title="t('permissionPreview.basicInfo')"
          :column="3"
          border
          size="small"
        >
          <el-descriptions-item :label="t('systemUser.username')">
            {{ data.user.username }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('systemUser.nickname')">
            {{ data.user.nickname || "-" }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('permissionPreview.superuser')">
            <el-tag v-if="data.user.is_superuser" type="danger" size="small">
              {{ t("permissionPreview.yes") }}
            </el-tag>
            <el-tag v-else type="info" size="small">
              {{ t("permissionPreview.no") }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item :label="t('permissionPreview.dept')" :span="3">
            <template v-if="data.user.dept">
              <el-tag size="small">{{ data.user.dept.name }}</el-tag>
            </template>
            <span v-else>-</span>
          </el-descriptions-item>
          <el-descriptions-item :label="t('permissionPreview.roles')" :span="3">
            <el-tag
              v-for="role in data.user.roles"
              :key="role.pk"
              size="small"
              class="mr-1"
              :type="role.is_active ? 'primary' : 'info'"
            >
              {{ role.name }}
            </el-tag>
            <span v-if="!data.user.roles.length">-</span>
          </el-descriptions-item>
        </el-descriptions>

        <el-collapse
          class="mt-3"
          :model-value="['menu', 'api', 'data', 'field', 'trial']"
        >
          <!-- 可见菜单树 -->
          <el-collapse-item
            :title="`${t('permissionPreview.menuTree')}（${data.summary.menu_count}）`"
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

          <!-- API 权限码 -->
          <el-collapse-item
            :title="`${t('permissionPreview.apiCodes')}（${data.summary.api_code_count}）`"
            name="api"
          >
            <el-input
              v-model="keyword"
              :placeholder="t('permissionPreview.filterPlaceholder')"
              clearable
              class="mb-2 w-70!"
            />
            <el-table
              :data="filteredApiPermissions"
              size="small"
              border
              max-height="320"
            >
              <el-table-column
                prop="code"
                :label="t('permissionPreview.colCode')"
                min-width="180"
                show-overflow-tooltip
              />
              <el-table-column
                prop="method"
                :label="t('permissionPreview.colMethod')"
                width="90"
              >
                <template #default="{ row }">
                  <el-tag
                    :type="METHOD_TAG_TYPES[row.method] ?? 'info'"
                    size="small"
                  >
                    {{ row.method || "-" }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column
                prop="title"
                :label="t('permissionPreview.colTitle')"
                min-width="150"
                show-overflow-tooltip
              />
              <el-table-column
                prop="path"
                :label="t('permissionPreview.colPath')"
                min-width="220"
                show-overflow-tooltip
              />
              <template #empty>
                <el-empty
                  :description="t('permissionPreview.emptyApis')"
                  :image-size="70"
                />
              </template>
            </el-table>
          </el-collapse-item>

          <!-- 数据权限 -->
          <el-collapse-item
            :title="t('permissionPreview.dataPermission')"
            name="data"
          >
            <PreviewDataPermission :data="data.data_permissions" />
          </el-collapse-item>

          <!-- 字段权限 -->
          <el-collapse-item
            :title="`${t('permissionPreview.fieldPermission')}（${data.summary.field_permission_count}）`"
            name="field"
          >
            <el-alert
              v-if="!data.field_permission_enabled"
              :title="t('permissionPreview.fieldDisabled')"
              type="info"
              :closable="false"
              show-icon
              class="mb-2"
            />
            <el-alert
              :title="t('permissionPreview.fieldBlank')"
              type="info"
              :closable="false"
              show-icon
              class="mb-2"
            />
            <el-table
              v-if="data.field_permissions.length"
              :data="data.field_permissions"
              size="small"
              border
            >
              <el-table-column
                prop="menu.title"
                :label="t('permissionPreview.colMenu')"
                min-width="140"
              />
              <el-table-column
                prop="role.name"
                :label="t('permissionPreview.colRole')"
                min-width="120"
              />
              <el-table-column
                prop="model_label"
                :label="t('permissionPreview.colModel')"
                min-width="120"
              >
                <template #default="{ row }">
                  {{ row.model_label }} ({{ row.model }})
                </template>
              </el-table-column>
              <el-table-column
                :label="t('permissionPreview.colFields')"
                min-width="220"
              >
                <template #default="{ row }">
                  <el-tag
                    v-for="(label, index) in row.field_labels"
                    :key="row.fields[index]"
                    size="small"
                    class="mr-1 mb-0.5"
                  >
                    {{ label }}
                  </el-tag>
                </template>
              </el-table-column>
            </el-table>
          </el-collapse-item>

          <!-- 试算 -->
          <el-collapse-item :title="t('permissionPreview.trial')" name="trial">
            <PreviewTrial
              :pk="data.user.pk"
              :candidates="data.trial_candidates"
              :menu-tree="data.menu_tree"
              :can-trial="canTrial"
            />
          </el-collapse-item>
        </el-collapse>
      </template>
    </div>
  </el-drawer>
</template>
