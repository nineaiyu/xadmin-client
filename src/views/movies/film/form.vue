<script setup lang="ts">
import { ref } from "vue";
import { formRules } from "./utils/rule";
import { FormProps } from "./utils/types";
import { useI18n } from "vue-i18n";
import ReCol from "@/components/ReCol";

const props = withDefaults(defineProps<FormProps>(), {
  formInline: () => ({
    pk: "",
    name: "",
    title: "",
    poster: "",
    category: [],
    episodes: "",
    region: "",
    language: "",
    subtitles: "",
    director: "",
    starring: "",
    times: "",
    views: "",
    rate: "",
    description: "",
    enable: true
  }),
  categoryData: () => []
});

const ruleFormRef = ref();
const newFormInline = ref(props.formInline);
function getRef() {
  return ruleFormRef.value;
}

const { t } = useI18n();

defineExpose({ getRef });
</script>

<template>
  <el-form
    ref="ruleFormRef"
    :model="newFormInline"
    :rules="formRules"
    label-width="140px"
  >
    <el-row :gutter="30">
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
        <el-form-item :label="t('MoviesFilm.title')" prop="title">
          <el-input
            v-model="newFormInline.title"
            clearable
            :placeholder="t('MoviesFilm.title')"
          />
        </el-form-item>
      </re-col>

      <re-col :value="24" :xs="24" :sm="24">
        <el-form-item :label="t('MoviesFilm.category')" prop="category">
          <el-select
            v-model="newFormInline.category"
            multiple
            clearable
            :placeholder="t('MoviesFilm.category')"
            style="width: 100%"
          >
            <el-option
              v-for="item in props.categoryData"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
      </re-col>

      <re-col :value="12" :xs="24" :sm="24">
        <el-form-item :label="t('MoviesFilm.director')" prop="director">
          <el-input
            v-model="newFormInline.director"
            clearable
            :placeholder="t('MoviesFilm.director')"
          />
        </el-form-item>
      </re-col>
      <re-col :value="12" :xs="24" :sm="24">
        <el-form-item :label="t('MoviesFilm.rate')" prop="rate">
          <el-rate v-model="newFormInline.rate" allow-half show-score />
        </el-form-item>
      </re-col>

      <re-col :value="24" :xs="24" :sm="24">
        <el-form-item :label="t('MoviesFilm.starring')" prop="starring">
          <el-input
            v-model="newFormInline.starring"
            clearable
            :placeholder="t('MoviesFilm.starring')"
          />
        </el-form-item>
      </re-col>
      <re-col :value="24" :xs="24" :sm="24">
        <el-form-item :label="t('MoviesFilm.subtitles')" prop="subtitles">
          <el-input
            v-model="newFormInline.subtitles"
            clearable
            :placeholder="t('MoviesFilm.subtitles')"
          />
        </el-form-item>
      </re-col>
      <re-col :value="12" :xs="24" :sm="24">
        <el-form-item :label="t('MoviesFilm.language')" prop="language">
          <el-input
            v-model="newFormInline.language"
            clearable
            :placeholder="t('MoviesFilm.language')"
          />
        </el-form-item>
      </re-col>
      <re-col :value="12" :xs="24" :sm="24">
        <el-form-item :label="t('MoviesFilm.region')" prop="region">
          <el-input
            v-model="newFormInline.region"
            clearable
            :placeholder="t('MoviesFilm.region')"
          />
        </el-form-item>
      </re-col>
      <re-col :value="12" :xs="24" :sm="24">
        <el-form-item :label="t('MoviesFilm.views')" prop="views">
          <el-input
            v-model="newFormInline.views"
            type="number"
            clearable
            :placeholder="t('MoviesFilm.views')"
          />
        </el-form-item>
      </re-col>
      <re-col :value="12" :xs="24" :sm="24">
        <el-form-item :label="t('MoviesFilm.times')" prop="times">
          <el-input
            v-model="newFormInline.times"
            type="number"
            clearable
            :placeholder="t('MoviesFilm.times')"
          />
        </el-form-item>
      </re-col>
      <re-col>
        <el-form-item :label="t('labels.remark')">
          <el-input
            v-model="newFormInline.description"
            :placeholder="t('labels.remark')"
            type="textarea"
            rows="3"
          />
        </el-form-item>
      </re-col>
    </el-row>
  </el-form>
</template>
