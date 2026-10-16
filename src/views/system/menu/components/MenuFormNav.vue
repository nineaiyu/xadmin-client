<script lang="ts" setup>
import { computed, inject } from "vue";
import { useI18n } from "vue-i18n";
import FormQuestion from "./FormQuestion.vue";
import { MenuChoices } from "@/views/system/constants";
import { MENU_FORM_KEY } from "../utils/formContext";

/** 侧栏与标签：菜单可见、显示父级、页面缓存、固定/隐藏标签页 + 侧栏装饰（高亮路径/徽标/分组） */
const ctx = inject(MENU_FORM_KEY)!;
const { t } = useI18n();
const form = ctx.model;

const isMenu = computed(() => form.menuType === MenuChoices.MENU);
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

  <el-form-item
    v-if="isMenu"
    :label="t('systemMenu.activePath')"
    prop="meta.active_path"
  >
    <template #label>
      <form-question
        :description="t('systemMenu.activePathTip')"
        :label="t('systemMenu.activePath')"
      />
    </template>
    <el-input
      v-model="form.meta.active_path"
      :placeholder="t('systemMenu.activePathPlaceholder')"
      clearable
    />
  </el-form-item>

  <el-form-item :label="t('systemMenu.badge')">
    <template #label>
      <form-question
        :description="t('systemMenu.badgeTip')"
        :label="t('systemMenu.badge')"
      />
    </template>
    <div class="menu-form-row">
      <el-input
        v-model="form.meta.badge"
        :placeholder="t('systemMenu.badgePlaceholder')"
        clearable
      />
      <el-select v-model="form.meta.badge_type" :style="{ width: '110px' }">
        <el-option value="normal" :label="t('systemMenu.badgeTypeNormal')" />
        <el-option value="dot" :label="t('systemMenu.badgeTypeDot')" />
      </el-select>
    </div>
  </el-form-item>

  <el-form-item :label="t('systemMenu.groupName')">
    <template #label>
      <form-question
        :description="t('systemMenu.groupNameTip')"
        :label="t('systemMenu.groupName')"
      />
    </template>
    <div class="menu-form-row">
      <el-input
        v-model="form.meta.group_name"
        :placeholder="t('systemMenu.groupNamePlaceholder')"
        clearable
      />
      <el-input-number
        v-model="form.meta.group_rank"
        :min="0"
        :controls="false"
        :style="{ width: '110px' }"
        :placeholder="t('systemMenu.groupRank')"
      />
    </div>
  </el-form-item>
</template>

<style lang="scss" scoped>
/* 双控件行：主输入自适应、附属控件定宽（.el-select 默认 100% 会挤占主输入） */
.menu-form-row {
  display: flex;
  gap: 8px;
  align-items: center;
  width: 100%;

  > :first-child {
    flex: 1;
    min-width: 0;
  }
}
</style>
