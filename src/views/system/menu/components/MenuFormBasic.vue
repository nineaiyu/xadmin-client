<script lang="ts" setup>
import { computed, inject } from "vue";
import { useI18n } from "vue-i18n";
import { IconSelect } from "@/components/ReIcon";
import FormQuestion from "@/components/FormQuestion/index.vue";
import { MenuChoices } from "@/views/system/constants";
import { MENU_FORM_KEY } from "../utils/formContext";

/** 基本信息组：名称、图标、路由地址、组件路径（菜单）、组件名称、排序 */
const ctx = inject(MENU_FORM_KEY)!;
const { t } = useI18n();
const form = ctx.model;

const isMenu = computed(() => form.menuType === MenuChoices.MENU);
const isPermission = computed(() => form.menuType === MenuChoices.PERMISSION);

/** 组件路径联动：路由地址自动补 "/"，组件名取视图组件 name */
const onComponentChange = (value: string) => {
  if (!value) return;
  form.path = `/${value}`;
  form.name = ctx.viewList[value] ?? form.name;
};
</script>

<template>
  <el-form-item
    :label="
      isPermission ? t('systemMenu.permissionName') : t('systemMenu.title')
    "
    prop="title"
  >
    <el-input
      v-model="form.title"
      :placeholder="
        isPermission
          ? t('systemMenu.verifyPermissionName')
          : t('systemMenu.verifyTitle')
      "
      clearable
    />
  </el-form-item>

  <el-form-item v-if="!isPermission" :label="t('systemMenu.icon')" prop="icon">
    <icon-select v-model="form.icon" />
  </el-form-item>

  <el-form-item
    v-if="isMenu"
    :label="t('systemMenu.componentPath')"
    prop="component"
  >
    <template #label>
      <form-question
        :description="t('systemMenu.exampleComponentPath')"
        :label="t('systemMenu.componentPath')"
      />
    </template>
    <el-select
      v-model="form.component"
      class="w-full"
      clearable
      filterable
      :placeholder="t('systemMenu.verifyComponentPath')"
      @change="onComponentChange"
    >
      <el-option
        v-for="item in Object.keys(ctx.viewList)"
        :key="item"
        :value="item"
      >
        <span style="float: left">{{ item }}</span>
        <span class="menu-form__option-hint">{{ ctx.viewList[item] }}</span>
      </el-option>
    </el-select>
  </el-form-item>

  <el-form-item
    v-if="!isPermission"
    :label="t('systemMenu.componentName')"
    prop="name"
  >
    <template #label>
      <form-question
        :description="t('systemMenu.exampleComponentName')"
        :label="t('systemMenu.componentName')"
      />
    </template>
    <el-input
      v-model="form.name"
      :disabled="isMenu"
      :placeholder="t('systemMenu.componentName')"
      clearable
    />
  </el-form-item>

  <el-form-item v-if="!isPermission" :label="t('systemMenu.path')" prop="path">
    <template #label>
      <form-question
        :description="t('systemMenu.exampleRoutePath')"
        :label="t('systemMenu.path')"
      />
    </template>
    <el-input
      v-model="form.path"
      :placeholder="t('systemMenu.verifyPath')"
      clearable
    />
  </el-form-item>

  <el-form-item v-if="!isPermission" :label="t('systemMenu.rank')">
    <el-input-number
      v-model="form.rank"
      :min="0"
      :max="100000"
      controls-position="right"
    />
  </el-form-item>
</template>

<style lang="scss" scoped>
.menu-form__option-hint {
  float: right;
  font-size: 13px;
  color: var(--el-text-color-regular);
}
</style>
