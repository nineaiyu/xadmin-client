<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { SUCCESS_CODE } from "@/api/types";
import { message } from "@/utils/message";
import { menuApi } from "@/api/system/menu";
import type { MenuPermissionPreview } from "@/api/system/menu";
import { displayTitle } from "../utils/useMenuFilter";
import type { MenuRow, MenuUrlItem } from "../utils/types";

/**
 * 权限码批量生成：选择后端视图 → dry_run 预览「将新建 C- / 将覆盖 U-」清单 → 确认执行。
 *
 * 预览与执行共用后端同一构造逻辑（`MenuViewSet._build_permission_items`），
 * 所见即所得；旧实现只能「盲勾即写」，无从判断会新建还是覆盖。
 */

const props = withDefaults(
  defineProps<{
    row: MenuRow;
    menuUrlList?: MenuUrlItem[];
  }>(),
  { menuUrlList: () => [] }
);

const { t } = useI18n();
const views = ref<string[]>([]);
const component = ref(props.row?.name ?? "");
const skipExisting = ref(true);
const preview = ref<MenuPermissionPreview | null>(null);
const loading = ref(false);

const viewOptions = computed(() => {
  const map = new Map<string, { value: string; label: string; hint: string }>();
  props.menuUrlList.forEach(item => {
    const view = item.view;
    if (!view || item.name === "#" || map.has(view)) return;
    map.set(view, {
      value: view,
      label: view.split(".").pop() ?? view,
      hint: String(item.label ?? item.url ?? "")
    });
  });
  return [...map.values()];
});

/** 单选视图时按视图名推断权限标识后缀（可再手工修改） */
const onViewsChange = (value: string[]) => {
  if (value.length === 1) {
    component.value = (value[0].split(".").pop() ?? "")
      .replace("ViewSet", "")
      .replace("APIView", "");
  } else {
    component.value = props.row?.name ?? "";
  }
};

let timer: ReturnType<typeof setTimeout> | null = null;
const fetchPreview = () => {
  if (timer) clearTimeout(timer);
  if (!views.value.length) {
    preview.value = null;
    return;
  }
  timer = setTimeout(async () => {
    loading.value = true;
    try {
      const res = await menuApi.permissions(props.row.pk, {
        views: views.value,
        component: component.value,
        skip_existing: skipExisting.value,
        dry_run: true
      });
      if (res.code === SUCCESS_CODE) {
        preview.value = res.data ?? null;
      } else {
        preview.value = null;
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
    } catch (error) {
      preview.value = null;
      message(String((error as { detail?: string })?.detail ?? error), {
        type: "error"
      });
    } finally {
      loading.value = false;
    }
  }, 300);
};

watch([views, component, skipExisting], fetchPreview);

/** 确认执行：落库（同一端点去掉 dry_run） */
const submit = async (): Promise<boolean> => {
  if (!views.value.length) {
    message(t("systemMenu.permissionViewsRequired"), { type: "warning" });
    return false;
  }
  const res = await menuApi
    .permissions(props.row.pk, {
      views: views.value,
      component: component.value,
      skip_existing: skipExisting.value
    })
    .catch(error => ({
      code: -1,
      detail: String((error as { detail?: string })?.detail ?? error)
    }));
  if (res.code !== SUCCESS_CODE) {
    message(`${t("results.failed")}，${res.detail}`, { type: "error" });
    return false;
  }
  message(t("results.success"), { type: "success" });
  return true;
};

defineExpose({ submit });
</script>

<template>
  <el-form label-width="110px" @submit.prevent>
    <el-form-item :label="t('systemMenu.menu')">
      <el-input :model-value="displayTitle(row)" disabled />
    </el-form-item>
    <el-form-item :label="t('systemMenu.menuView')" required>
      <el-select
        v-model="views"
        class="w-full"
        filterable
        multiple
        :placeholder="t('systemMenu.menuView')"
        @change="onViewsChange"
      >
        <el-option
          v-for="item in viewOptions"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        >
          <span style="float: left">{{ item.label }}</span>
          <span class="menu-permission__hint">{{ item.hint }}</span>
        </el-option>
      </el-select>
    </el-form-item>
    <el-form-item :label="t('systemMenu.codeSuffix')">
      <template #label>
        <el-tooltip :content="t('systemMenu.codeSuffixTip')" placement="top">
          <span>{{ t("systemMenu.codeSuffix") }}</span>
        </el-tooltip>
      </template>
      <el-input v-model="component" clearable />
    </el-form-item>
    <el-form-item :label="t('systemMenu.skipExistingData')">
      <el-switch v-model="skipExisting" />
    </el-form-item>

    <el-alert
      :closable="false"
      show-icon
      type="info"
      :title="t('systemMenu.permissionPreviewTip')"
    />

    <div v-loading="loading" class="menu-permission__preview">
      <el-table
        v-if="preview?.results?.length"
        :data="preview.results"
        height="240"
        size="small"
      >
        <el-table-column :label="t('systemMenu.preview.action')" width="88">
          <template #default="{ row: item }">
            <el-tag
              :type="item.action === 'create' ? 'success' : 'warning'"
              effect="light"
              size="small"
            >
              {{
                item.action === "create"
                  ? t("systemMenu.preview.create")
                  : t("systemMenu.preview.update")
              }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          :label="t('systemMenu.permissionCode')"
          min-width="200"
          prop="name"
        />
        <el-table-column
          :label="t('systemMenu.requestMethod')"
          prop="method"
          width="90"
        />
        <el-table-column
          :label="t('systemMenu.permissionPath')"
          min-width="220"
          prop="path"
          show-overflow-tooltip
        />
      </el-table>
      <el-empty
        v-else
        :description="
          views.length
            ? t('systemMenu.preview.empty')
            : t('systemMenu.preview.pickViews')
        "
      />
    </div>

    <div v-if="preview?.results?.length" class="menu-permission__summary">
      {{
        t("systemMenu.preview.summary", {
          create: preview.create_count,
          update: preview.update_count
        })
      }}
    </div>
  </el-form>
</template>

<style lang="scss" scoped>
.menu-permission {
  &__hint {
    float: right;
    font-size: 13px;
    color: var(--el-text-color-regular);
  }

  &__preview {
    min-height: 160px;
    margin-top: 8px;
  }

  &__summary {
    margin-top: 8px;
    font-size: 13px;
    color: var(--el-text-color-regular);
  }
}
</style>
