<script setup lang="ts">
import { onMounted, ref } from "vue";
import { formRules } from "./utils/rule";
import { FormProps } from "./utils/types";
import { useI18n } from "vue-i18n";
import ReCol from "@/components/ReCol";
import { getActorListApi } from "@/api/movies/actor";

const props = withDefaults(defineProps<FormProps>(), {
  formInline: () => ({
    pk: "",
    name: "",
    title: "",
    channel: "",
    poster: "",
    category: [],
    episodes: "",
    region: "",
    language: "",
    subtitle: "",
    release_date: "",
    director: [],
    starring: [],
    times: "",
    views: "",
    rate: 5,
    description: "",
    introduction: "",
    enable: true
  }),
  categoryData: () => [],
  channelData: () => [],
  regionData: () => [],
  subtitleData: () => [],
  languageData: () => []
});

const ruleFormRef = ref();
const newFormInline = ref(props.formInline);

function getRef() {
  return ruleFormRef.value;
}

const { t } = useI18n();
const actorData = ref();
const loading = ref(false);
defineExpose({ getRef });

const getActorData = (search: string, pks: string[], init = false) => {
  const query = {
    name: "",
    pks: "",
    page: 1,
    size: 100,
    enable: true
  };
  if (search) {
    query.name = search.toLowerCase();
  }
  if (pks && pks.length > 0) {
    query.pks = JSON.stringify(pks);
  }
  if (pks || search || init) {
    loading.value = true;
    getActorListApi(query).then(res => {
      if (res.code === 1000) {
        actorData.value = [];
        res.data.results.forEach(item => {
          actorData.value.push({
            value: item.pk,
            label: `${item.name} -- ${item.foreign_name}`
          });
        });
      }
      loading.value = false;
    });
  }
};

onMounted(() => {
  let pks = [...newFormInline.value.director, ...newFormInline.value.starring];
  if (pks && pks.length > 0) {
    getActorData("", pks);
  } else {
    getActorData("", null, true);
  }
});
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
        <el-form-item :label="t('MoviesFilm.channel')" prop="channel">
          <el-select
            v-model="newFormInline.channel"
            filterable
            multiple
            clearable
            :placeholder="t('MoviesFilm.channel')"
            style="width: 100%"
          >
            <el-option
              v-for="item in props.channelData"
              :key="item.value"
              :label="item.label"
              :value="item.value"
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
            filterable
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
      <re-col :value="24" :xs="24" :sm="24">
        <el-form-item :label="t('MoviesFilm.region')" prop="region">
          <el-select
            v-model="newFormInline.region"
            filterable
            multiple
            clearable
            :placeholder="t('MoviesFilm.region')"
            style="width: 100%"
          >
            <el-option
              v-for="item in props.regionData"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
      </re-col>
      <re-col :value="24" :xs="24" :sm="24">
        <el-form-item :label="t('MoviesFilm.language')" prop="language">
          <el-select
            v-model="newFormInline.language"
            filterable
            multiple
            clearable
            :placeholder="t('MoviesFilm.language')"
            style="width: 100%"
          >
            <el-option
              v-for="item in props.languageData"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
      </re-col>
      <re-col :value="24" :xs="24" :sm="24">
        <el-form-item :label="t('MoviesFilm.subtitle')" prop="subtitle">
          <el-select
            v-model="newFormInline.subtitle"
            filterable
            multiple
            clearable
            :placeholder="t('MoviesFilm.subtitle')"
            style="width: 100%"
          >
            <el-option
              v-for="item in props.subtitleData"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
      </re-col>

      <re-col :value="24" :xs="24" :sm="24">
        <el-form-item :label="t('MoviesFilm.director')" prop="director">
          <el-select
            v-model="newFormInline.director"
            filterable
            clearable
            multiple
            remote
            reserve-keyword
            :placeholder="t('MoviesFilm.director')"
            remote-show-suffix
            :remote-method="getActorData"
            :loading="loading"
            style="width: 100%"
          >
            <el-option
              v-for="item in actorData"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
      </re-col>

      <re-col :value="24" :xs="24" :sm="24">
        <el-form-item :label="t('MoviesFilm.starring')" prop="starring">
          <el-select
            v-model="newFormInline.starring"
            multiple
            filterable
            clearable
            remote
            reserve-keyword
            :placeholder="t('MoviesFilm.starring')"
            remote-show-suffix
            :remote-method="getActorData"
            :loading="loading"
            style="width: 100%"
          >
            <el-option
              v-for="item in actorData"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
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
      <re-col :value="12" :xs="24" :sm="24">
        <el-form-item :label="t('MoviesFilm.releaseDate')" prop="release_date">
          <el-date-picker
            v-model="newFormInline.release_date"
            type="date"
            :placeholder="t('MoviesFilm.releaseDate')"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            clearable
          />
        </el-form-item>
      </re-col>
      <re-col :value="12" :xs="24" :sm="24">
        <el-form-item :label="t('MoviesFilm.rate')" prop="rate">
          <el-rate v-model="newFormInline.rate" allow-half show-score />
        </el-form-item>
      </re-col>
      <re-col :value="12" :xs="24" :sm="24">
        <el-form-item :label="t('labels.status')" prop="enable">
          <el-switch
            v-model="newFormInline.enable"
            inline-prompt
            :active-value="true"
            :inactive-value="false"
            :active-text="t('labels.publish')"
            :inactive-text="t('labels.unPublish')"
          />
        </el-form-item>
      </re-col>
      <re-col>
        <el-form-item :label="t('MoviesFilm.introduction')">
          <el-input
            v-model="newFormInline.introduction"
            :placeholder="t('MoviesFilm.introduction')"
            type="textarea"
            rows="5"
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
