<script lang="ts" setup>
import { inject } from "vue";
import { useI18n } from "vue-i18n";
import FormQuestion from "@/components/FormQuestion/index.vue";
import { MENU_FORM_KEY } from "../utils/formContext";

/** 侧栏与标签：菜单可见、显示父级、页面缓存、固定/隐藏标签页 */
const ctx = inject(MENU_FORM_KEY)!;
const { t } = useI18n();
const form = ctx.model;
</script>

<template>
  <el-form-item :label="t('systemMenu.showLink')">
    <template #label>
      <form-question
        :description="t('systemMenu.exampleShowLink')"
        :label="t('systemMenu.showLink')"
      />
    </template>
    <el-switch v-model="form.meta.is_show_menu" />
  </el-form-item>

  <el-form-item :label="t('systemMenu.showParentMenu')">
    <el-switch v-model="form.meta.is_show_parent" />
  </el-form-item>

  <el-form-item :label="t('systemMenu.cache')">
    <template #label>
      <form-question
        :description="t('systemMenu.exampleCache')"
        :label="t('systemMenu.cache')"
      />
    </template>
    <el-switch v-model="form.meta.is_keepalive" />
  </el-form-item>

  <el-form-item :label="t('systemMenu.hiddenTag')">
    <template #label>
      <form-question
        :description="t('systemMenu.hiddenTagTip')"
        :label="t('systemMenu.hiddenTag')"
      />
    </template>
    <el-switch v-model="form.meta.is_hidden_tag" />
  </el-form-item>

  <el-form-item :label="t('systemMenu.fixedTag')">
    <template #label>
      <form-question
        :description="t('systemMenu.fixedTagTip')"
        :label="t('systemMenu.fixedTag')"
      />
    </template>
    <el-switch v-model="form.meta.fixed_tag" />
  </el-form-item>
</template>
