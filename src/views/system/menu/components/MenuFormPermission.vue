<script lang="ts" setup>
import { computed, inject } from "vue";
import { useI18n } from "vue-i18n";
import type { CascaderOption } from "element-plus";
import FormQuestion from "@/components/FormQuestion/index.vue";
import { MENU_FORM_KEY } from "../utils/formContext";
import type { ModelTreeItem } from "../utils/types";

/** 权限点分组：权限标识、权限路由、请求方式、关联模型（数据/字段权限绑定） */
const ctx = inject(MENU_FORM_KEY)!;
const { t } = useI18n();
const form = ctx.model;

/** 关联模型已选摘要：级联多选后回显数量，避免「选了几项要翻抽屉才知道」 */
const selectedCount = computed(() => form.model.length);

const modelProps = {
  multiple: true,
  emitPath: false,
  checkStrictly: false
} as const;

/** 级联选项：后端下发的模型树（含应用分组节点），结构由调用方保证 */
const cascaderOptions = computed(
  () => ctx.modelList as unknown as CascaderOption[]
);
</script>

<template>
  <el-form-item :label="t('systemMenu.permissionCode')" prop="name">
    <template #label>
      <form-question
        :description="t('systemMenu.examplePermissionCode')"
        :label="t('systemMenu.permissionCode')"
      />
    </template>
    <el-input
      v-model="form.name"
      :placeholder="t('systemMenu.verifyPermissionCode')"
      clearable
    />
  </el-form-item>

  <el-form-item :label="t('systemMenu.permissionPath')" prop="path">
    <el-select
      v-model="form.path"
      class="w-full"
      clearable
      filterable
      :placeholder="t('systemMenu.verifyPermissionPath')"
    >
      <el-option
        v-for="item in ctx.menuUrlList"
        :key="`${item.name}-${item.url}`"
        :label="`${item.name}----${item.url}`"
        :value="item.url ?? ''"
      />
    </el-select>
  </el-form-item>

  <el-form-item :label="t('systemMenu.requestMethod')" prop="method">
    <el-select v-model="form.method" class="w-full" clearable>
      <el-option
        v-for="item in ctx.methodChoices"
        :key="String(item.value)"
        :disabled="item.disabled"
        :label="item.label"
        :value="item.value ?? ''"
      />
    </el-select>
  </el-form-item>

  <el-form-item :label="t('systemMenu.associationModel')">
    <template #label>
      <form-question
        :description="t('systemMenu.exampleAssociationModel')"
        :label="t('systemMenu.associationModel')"
      />
    </template>
    <div class="w-full">
      <el-cascader
        v-model="form.model"
        :options="cascaderOptions"
        :props="modelProps"
        class="w-full"
        clearable
        filterable
      >
        <template #default="{ node, data }">
          <span>{{ (data as ModelTreeItem).label }}</span>
          <span v-show="(data as ModelTreeItem).parent">
            ({{ (data as ModelTreeItem).name }})
          </span>
          <span v-show="!node.isLeaf"
            >({{ (data as ModelTreeItem).children?.length }})</span
          >
        </template>
      </el-cascader>
      <div v-if="selectedCount" class="menu-form__hint">
        {{ t("systemMenu.modelSelected", { count: selectedCount }) }}
      </div>
    </div>
  </el-form-item>
</template>

<style lang="scss" scoped>
.menu-form__hint {
  margin-top: 4px;
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-regular);
}
</style>
