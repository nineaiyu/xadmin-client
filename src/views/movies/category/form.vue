<script setup lang="ts">
import { ref } from "vue";
import { formRules } from "./utils/rule";
import { FormProps } from "./utils/types";
import { useI18n } from "vue-i18n";
import ReCol from "@/components/ReCol";
import { usePublicHooks } from "@/views/system/hooks";

const props = withDefaults(defineProps<FormProps>(), {
  formInline: () => ({
    pk: "",
    name: "",
    rank: "",
    description: "",
    category_type: "",
    enable: true
  }),
  dictChoices: () => []
});

const ruleFormRef = ref();
const newFormInline = ref(props.formInline);
function getRef() {
  return ruleFormRef.value;
}

const { t } = useI18n();
const { switchStyle } = usePublicHooks();

defineExpose({ getRef });
</script>

<template>
  <el-form
    ref="ruleFormRef"
    :model="newFormInline"
    :rules="formRules"
    label-width="120px"
  >
    <el-row :gutter="30">
      <re-col :value="24" :xs="24" :sm="24">
        <el-form-item
          :label="t('MoviesCategory.categoryDisplay')"
          prop="category_type"
        >
          <el-select
            v-model="newFormInline.category_type"
            filterable
            class="filter-item"
            style="width: 180px"
            clearable
          >
            <el-option
              v-for="item in props.dictChoices"
              :key="item.key"
              :label="item.label"
              :disabled="item.disabled"
              :value="item.key"
            />
          </el-select>
        </el-form-item>
      </re-col>
      <re-col :value="24" :xs="24" :sm="24">
        <el-form-item :label="t('MoviesFilm.name')" prop="name">
          <el-input
            v-model="newFormInline.name"
            clearable
            :placeholder="t('MoviesFilm.name')"
          />
        </el-form-item>
      </re-col>
      <re-col :value="24" :xs="24" :sm="24">
        <el-form-item :label="t('MoviesCategory.rank')" prop="rank">
          <el-input
            v-model="newFormInline.rank"
            type="number"
            clearable
            :placeholder="t('MoviesCategory.name')"
          />
        </el-form-item>
      </re-col>
      <re-col :value="12" :xs="24" :sm="24">
        <el-form-item :label="t('labels.status')" prop="enable">
          <el-switch
            v-model="newFormInline.enable"
            inline-prompt
            :active-value="true"
            :inactive-value="false"
            :active-text="t('labels.enable')"
            :inactive-text="t('labels.disable')"
          />
        </el-form-item>
      </re-col>
      <re-col>
        <el-form-item :label="t('labels.description')">
          <el-input
            v-model="newFormInline.description"
            :placeholder="t('labels.description')"
            type="textarea"
            rows="3"
          />
        </el-form-item>
      </re-col>
    </el-row>
  </el-form>
</template>
