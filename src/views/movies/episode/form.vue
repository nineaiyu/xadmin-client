<script setup lang="ts">
import { reactive, ref } from "vue";
import { formRules } from "./utils/rule";
import { FormProps } from "./utils/types";
import { useI18n } from "vue-i18n";
import ReCol from "@/components/ReCol";
import { FileUpload } from "../file/upload/index";
import VideoPreview from "../file/preview.vue";
import { getFileListApi } from "@/api/movies/file";
import { message } from "@/utils/message";
import dayjs from "dayjs";

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
const searchFlag = ref(false);
const fileInfo = reactive({ created_time: "", name: "", pk: "" });
const searchFile = () => {
  const query = {
    file_id: "",
    pk: ""
  };
  if (newFormInline.value.file_id.length > 20) {
    query.file_id = newFormInline.value.file_id;
  } else {
    query.pk = newFormInline.value.file_id;
  }
  if (query.pk || query.file_id) {
    newFormInline.value.file_pk = "";
    newFormInline.value.file_id = "";
    getFileListApi(query).then(res => {
      if (res.code === 1000 && res?.data?.results?.length === 1) {
        newFormInline.value.file_pk = res.data.results[0].pk;
        newFormInline.value.file_id = res.data.results[0].file_id;
        fileInfo.name = res.data.results[0].name;
        fileInfo.pk = res.data.results[0].pk;
        fileInfo.created_time = res.data.results[0].created_time;
        newFormInline.value.name = res.data.results[0].name;
      } else {
        message(`${t("results.failed")}，${res.detail}`, {
          type: "error"
        });
      }
    });
  }
};
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
      <re-col :value="24" :xs="24" :sm="24">
        <el-form-item :label="t('MoviesEpisode.rank')" prop="rank">
          <el-input
            v-model="newFormInline.rank"
            type="number"
            clearable
            :placeholder="t('MoviesEpisode.rank')"
          />
        </el-form-item>
      </re-col>
      <re-col>
        <el-form-item :label="t('MoviesEpisode.uploadVideo')" prop="file_id">
          <div class="w-[80%]">
            <el-input
              v-model="newFormInline.file_id"
              :disabled="searchFlag"
              clearable
              :placeholder="t('MoviesFile.fileId')"
            />
          </div>
          <el-col :span="4">
            <el-button @click="searchFile">文件ID搜索</el-button>
          </el-col>
          <div v-if="fileInfo.pk">
            <el-text>
              {{ fileInfo.name }}
            </el-text>
            上传时间：{{
              dayjs(fileInfo.created_time).format("YYYY-MM-DD HH:mm:ss")
            }}
          </div>
          <video-preview
            v-if="newFormInline.file_pk"
            class="mt-1"
            :form-inline="{
              pk: newFormInline.file_pk,
              name: '',
              file_id: '',
              autoplay: false,
              init: false
            }"
          />
          <file-upload
            v-else
            v-model:file-id="newFormInline.file_id"
            v-model:file-pk="newFormInline.file_pk"
            class="mt-1"
            style="width: 100%"
            accept="video/*, .mkv"
            :limit="1"
            :multiple="false"
            @success="searchFile"
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
            :active-text="t('labels.publish')"
            :inactive-text="t('labels.unPublish')"
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
