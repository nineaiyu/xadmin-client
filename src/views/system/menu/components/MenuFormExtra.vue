<script lang="ts" setup>
import { computed, inject } from "vue";
import { useI18n } from "vue-i18n";
import FormQuestion from "@/components/FormQuestion/index.vue";
import ReAnimateSelector from "@/components/ReAnimateSelector";
import { MenuChoices } from "@/views/system/constants";
import { MENU_FORM_KEY } from "../utils/formContext";

/** 外链与高级：内嵌外链、内嵌动画、进/离场动画（菜单）与页面水印 */
const ctx = inject(MENU_FORM_KEY)!;
const { t } = useI18n();
const form = ctx.model;

const isMenu = computed(() => form.menuType === MenuChoices.MENU);
</script>

<template>
  <template v-if="isMenu">
    <el-form-item :label="t('systemMenu.externalLink')">
      <template #label>
        <form-question
          :description="t('systemMenu.exampleExternalLink')"
          :label="t('systemMenu.externalLink')"
        />
      </template>
      <el-input
        v-model="form.meta.frame_url"
        :placeholder="t('systemMenu.verifyExampleExternalLink')"
        clearable
      />
    </el-form-item>

    <el-form-item :label="t('systemMenu.animation')">
      <template #label>
        <form-question
          :description="t('systemMenu.exampleAnimation')"
          :label="t('systemMenu.animation')"
        />
      </template>
      <el-switch v-model="form.meta.frame_loading" />
    </el-form-item>

    <el-form-item :label="t('systemMenu.transitionEnter')">
      <ReAnimateSelector v-model="form.meta.transition_enter" />
    </el-form-item>

    <el-form-item :label="t('systemMenu.transitionLeave')">
      <ReAnimateSelector
        v-model="form.meta.transition_leave"
        :disabled="!form.meta.transition_enter"
      />
    </el-form-item>
  </template>

  <el-form-item :label="t('systemMenu.pageWatermark')">
    <template #label>
      <form-question
        :description="t('systemMenu.pageWatermarkTip')"
        :label="t('systemMenu.pageWatermark')"
      />
    </template>
    <el-switch v-model="form.meta.watermark" />
  </el-form-item>
</template>
