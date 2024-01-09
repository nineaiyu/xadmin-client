<script setup lang="ts">
import { onBeforeUnmount, ref, shallowRef } from "vue";
import "@wangeditor/editor/dist/css/style.css";
import { Editor, Toolbar } from "@wangeditor/editor-for-vue";
import { FormProps, InsertFnType } from "./utils/types";
import { formRules } from "./utils/rule";
import ReCol from "@/components/ReCol";
import { UploadFileApi } from "@/api/system/upload";
import { message } from "@/utils/message";
import { UploadFileResult } from "@/api/types";
import { getKeyList } from "@pureadmin/utils";
import { useI18n } from "vue-i18n";
import SearchUsers from "@/views/system/base/searchUsers.vue";
import SearchDepts from "@/views/system/base/searchDepts.vue";
import SearchRoles from "@/views/system/base/searchRoles.vue";
import { NoticeChoices } from "@/views/system/constants";
import { hasGlobalAuth } from "@/router/utils";

const props = withDefaults(defineProps<FormProps>(), {
  isAdd: () => true,
  showColumns: () => [],
  formInline: () => ({
    pk: 0,
    title: "",
    publish: false,
    message: "",
    level: "primary",
    notice_type_display: "",
    notice_type: NoticeChoices.NOTICE,
    noticeChoices: [],
    levelChoices: [],
    notice_dept: [],
    notice_role: [],
    notice_user: []
  })
});
const ruleFormRef = ref();
const { t } = useI18n();
const newFormInline = ref(props.formInline);
newFormInline.value.noticeChoices[0].disabled = true;
const editorRef = shallowRef();
const mode = "default";

function getRef() {
  return ruleFormRef.value;
}

function getUploadFiles() {
  return [
    ...getKeyList(editorRef.value.getElemsByType("attachment"), "link"),
    ...getKeyList(editorRef.value.getElemsByType("image"), "src"),
    ...getKeyList(editorRef.value.getElemsByType("video"), "src")
  ];
}

defineExpose({ getRef, getUploadFiles });

// 注册。要在创建编辑器之前注册，且只能注册一次，不可重复注册。
// created(() => {
//   Boot.registerModule(attachmentModule);
// });

const toolbarConfig: any = {
  excludeKeys: "fullScreen",
  insertKeys: {
    index: -1, // 自定义插入的位置
    keys: ["uploadAttachment"] // “上传附件”菜单
  }
};
const editorConfig = {
  placeholder: t("notice.verifyContent"),
  readOnly: !props.isAdd && props.showColumns.indexOf("message") === -1,
  MENU_CONF: {},
  hoverbarKeys: {
    attachment: {
      menuKeys: ["downloadAttachment"] // “下载附件”菜单
    }
  }
};

editorConfig.MENU_CONF["uploadImage"] = {
  // 自定义上传
  async customUpload(file: File, insertFn: InsertFnType) {
    loading.value = true;
    const data = new FormData();
    data.append("file", file);
    UploadFileApi({}, data).then((res: UploadFileResult) => {
      if (res.code === 1000) {
        insertFn(
          res.data[0]?.filepath,
          res.data[0]?.filename,
          res.data[0]?.filepath
        );
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
      loading.value = false;
    });
  }
};

editorConfig.MENU_CONF["uploadVideo"] = {
  // 自定义上传
  async customUpload(file: File, insertFn: InsertFnType) {
    loading.value = true;
    const data = new FormData();
    data.append("file", file);
    UploadFileApi({}, data).then((res: UploadFileResult) => {
      if (res.code === 1000) {
        insertFn(res.data[0]?.filepath, "");
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
      loading.value = false;
    });
  }
};

editorConfig.MENU_CONF["uploadAttachment"] = {
  // 自定义上传
  async customUpload(file: File, insertFn: InsertFnType) {
    loading.value = true;
    const data = new FormData();
    data.append("file", file);
    UploadFileApi({}, data).then((res: UploadFileResult) => {
      if (res.code === 1000) {
        insertFn(res.data[0]?.filename, res.data[0]?.filepath);
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
      loading.value = false;
    });
  }
};

const handleCreated = editor => {
  // 记录 editor 实例，重要！
  editorRef.value = editor;
};

// 组件销毁时，也及时销毁编辑器
onBeforeUnmount(() => {
  const editor = editorRef.value;
  if (editor == null) return;
  editor.destroy();
});
const loading = ref(false);
</script>

<template>
  <el-form
    ref="ruleFormRef"
    :model="newFormInline"
    :rules="formRules"
    label-width="82px"
  >
    <el-card shadow="never">
      <template #header>
        <el-row :gutter="30">
          <re-col>
            <el-form-item :label="t('notice.title')" prop="title">
              <el-input
                v-model="newFormInline.title"
                :disabled="
                  !props.isAdd && props.showColumns.indexOf('title') === -1
                "
                clearable
                :placeholder="t('notice.verifyTitle')"
              />
            </el-form-item>
          </re-col>
          <re-col :value="8" :xs="24" :sm="24">
            <el-form-item :label="t('notice.type')" prop="level">
              <el-select
                v-model="newFormInline.notice_type"
                :disabled="!props.isAdd"
                class="!w-[180px]"
                clearable
              >
                <el-option
                  v-for="item in newFormInline.noticeChoices"
                  :key="item.key"
                  :label="item.label"
                  :disabled="item.disabled"
                  :value="item.key"
                />
              </el-select>
            </el-form-item>
          </re-col>
          <re-col :value="8" :xs="24" :sm="24">
            <el-form-item :label="t('notice.level')" prop="level">
              <el-select
                v-model="newFormInline.level"
                :disabled="
                  !props.isAdd && props.showColumns.indexOf('level') === -1
                "
                class="!w-[180px]"
                clearable
              >
                <el-option
                  v-for="item in newFormInline.levelChoices"
                  :key="item.key"
                  :label="item.label"
                  :disabled="item.disabled"
                  :value="item.key"
                >
                  <template #default>
                    <el-text :type="item.key">{{ item.label }}</el-text>
                  </template>
                </el-option>
              </el-select>
            </el-form-item>
          </re-col>
          <re-col :value="8" :xs="24" :sm="24">
            <el-form-item :label="t('notice.publish')" prop="publish">
              <el-select
                v-model="newFormInline.publish"
                :disabled="
                  !props.isAdd && props.showColumns.indexOf('publish') === -1
                "
                class="!w-[180px]"
                clearable
              >
                <el-option :label="t('labels.publish')" :value="true" />
                <el-option :label="t('labels.unPublish')" :value="false" />
              </el-select>
            </el-form-item>
          </re-col>
          <re-col>
            <el-form-item
              v-if="
                newFormInline.notice_type === NoticeChoices.USER &&
                hasGlobalAuth('list:systemUser')
              "
              :label="t('user.userId')"
              prop="notice_user"
            >
              <search-users
                v-model="newFormInline.notice_user"
                :disabled="
                  !props.isAdd &&
                  props.showColumns.indexOf('notice_user') === -1
                "
              />
            </el-form-item>
            <el-form-item
              v-if="
                newFormInline.notice_type === NoticeChoices.DEPT &&
                hasGlobalAuth('list:systemDept')
              "
              :label="t('dept.dept')"
              prop="notice_dept"
            >
              <search-depts
                v-model="newFormInline.notice_dept"
                :disabled="
                  !props.isAdd &&
                  props.showColumns.indexOf('notice_dept') === -1
                "
              />
            </el-form-item>
            <el-form-item
              v-if="
                newFormInline.notice_type === NoticeChoices.ROLE &&
                hasGlobalAuth('list:systemRole')
              "
              :label="t('role.role')"
              prop="notice_role"
            >
              <search-roles
                v-model="newFormInline.notice_role"
                :disabled="
                  !props.isAdd &&
                  props.showColumns.indexOf('notice_role') === -1
                "
              />
            </el-form-item>
          </re-col>
        </el-row>
      </template>
      <div class="wangeditor">
        <Toolbar
          :editor="editorRef"
          :defaultConfig="toolbarConfig"
          :mode="mode"
          style="border-bottom: 1px solid #ccc"
        />
        <Editor
          v-model="newFormInline.message"
          v-loading="loading"
          :defaultConfig="editorConfig"
          :mode="mode"
          style="height: 400px; overflow-y: hidden"
          @onCreated="handleCreated"
        />
      </div>
    </el-card>
  </el-form>
</template>
