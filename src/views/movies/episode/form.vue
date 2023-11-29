<script setup lang="ts">
import { ref } from "vue";
import { formRules } from "./utils/rule";
import { FormProps } from "./utils/types";
import { useI18n } from "vue-i18n";
import ReCol from "@/components/ReCol";
import { FileUpload } from "../file/upload/index";
import VideoPreview from "../file/preview.vue";

const props = withDefaults(defineProps<FormProps>(), {
  formInline: () => ({
    pk: "",
    name: "",
    rank: "",
    description: "",
    file_id: "",
    file_pk: "",
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
    label-width="120px"
  >
    <el-row :gutter="30">
      <re-col :value="24" :xs="24" :sm="24">
        <el-form-item :label="t('MoviesEpisode.film')" prop="film">
          <el-input
            v-model="newFormInline.film"
            clearable
            disabled
            :placeholder="t('MoviesEpisode.film')"
          />
        </el-form-item>
      </re-col>
      <re-col :value="24" :xs="24" :sm="24">
        <el-form-item :label="t('MoviesEpisode.name')" prop="name">
          <el-input
            v-model="newFormInline.name"
            clearable
            :placeholder="t('MoviesEpisode.name')"
          />
        </el-form-item>
      </re-col>
      <re-col>
        <el-form-item :label="t('MoviesEpisode.uploadVideo')" prop="file_id">
          <el-input v-model="newFormInline.file_id" disabled />
          <video-preview
            v-if="newFormInline.file_pk"
            :form-inline="{ pk: newFormInline.file_pk, name: '', file_id: '' }"
          />
          <file-upload
            v-else
            v-model:file-id="newFormInline.file_id"
            v-model:file-pk="newFormInline.file_pk"
            style="width: 100%"
            :accept="'video/*'"
            :limit="1"
            :multiple="false"
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
