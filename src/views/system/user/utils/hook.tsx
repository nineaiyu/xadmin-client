import "./reset.css";
import { getCurrentInstance, h, onMounted, reactive, ref, type Ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessageBox } from "element-plus";
import { userApi } from "@/api/system/user";
import { getDefaultAuths, hasAuth } from "@/router/utils";
import { useI18n } from "vue-i18n";
import {
  handleOperation,
  handleShowChangeHistory,
  usePublicHooks
} from "@/components/RePlusPage";
import {
  addDrawer,
  closeDrawer,
  type DrawerOptions
} from "@/components/ReDrawer";
import { deviceDetection } from "@pureadmin/utils";
import { rulesPasswordApi } from "@/api/auth";
import type { PasswordRule } from "@/api/auth";
import type { RecordType } from "plus-pro-components";
import PermissionPreview from "../components/PermissionPreview.vue";
import UserActionPanel from "../components/UserActionPanel.vue";

import { useUserOptions } from "./useUserOptions";
import { useUserAvatarUpload } from "./useUserAvatarUpload";
import { useUserResetPassword } from "./useUserResetPassword";
import { useUserColumnFormats } from "./useUserColumnFormats";
import { useUserButtons } from "./useUserButtons";
import { useUserImBinding } from "./useUserImBinding";
import { buildUserActionGroups } from "./userActions";
import { useTagAssign } from "@/views/system/components/useTagAssign";

/** 通用标签资源标识（与后端 TAGGABLE_MODELS 白名单键同源） */
const USER_TAG_RESOURCE = "system.userinfo";

/**
 * 用户视图组装入口：
 * - useUserOptions        部门树/角色/数据权限选项
 * - useUserAvatarUpload   头像裁剪上传
 * - useUserResetPassword  重置密码 + 强度评分
 * - useUserColumnFormats  列渲染与新增/编辑表单格式化（头像/用户名是抽屉入口）
 * - useUserButtons        工具栏批量按钮与操作列「管理」入口
 * - userActions           用户抽屉的动作清单（权限在构建期收敛）
 */
export function useUser(tableRef: Ref) {
  const { t } = useI18n();
  const router = useRouter();

  const api = reactive(userApi);

  const auth = reactive({
    unblock: false,
    empower: false,
    logout: false,
    resetPassword: false,
    resetMfa: false,
    preview: false,
    ...getDefaultAuths(getCurrentInstance(), [
      "resetPassword",
      "empower",
      "logout",
      "unblock",
      "resetMfa",
      "preview",
      "changeHistory",
      "imBinding",
      "invite"
    ])
  });
  const switchLoadMap = ref({});
  const { switchStyle } = usePublicHooks();
  const selectedNum = ref(0);
  const manySelectData = ref([]);
  const passwordRules = ref<PasswordRule[]>([]);

  const { treeData, treeLoading, onTreeSelect } = useUserOptions(tableRef);
  const { handleUpload } = useUserAvatarUpload({ t, api, tableRef });
  const { handleReset } = useUserResetPassword({ t, api, passwordRules });
  const { handleImBinding } = useUserImBinding({ t });
  // 通用标签：行内打标（单对象全量替换）与工具栏批量打标共用同一弹窗
  const { openTagDialog } = useTagAssign(tableRef);
  /** 用户权限预览抽屉（统一走 ReDrawer，不在页面模板手挂 el-drawer） */
  const openPreview = (row: RecordType) => {
    addDrawer({
      title: t("permissionPreview.userTitle"),
      size: "70%",
      destroyOnClose: true,
      hideFooter: true,
      contentRenderer: () => h(PermissionPreview, { row })
    });
  };

  /** 重置 MFA：清除动态口令与 Passkey 绑定，用户下次登录需重新绑定 */
  function handleResetMfa(row: RecordType) {
    handleOperation({
      t,
      apiReq: api.resetMfa(row.pk),
      success() {
        tableRef.value.handleGetData();
      }
    });
  }

  /** 强制下线：终止该用户全部在线会话 */
  function handleLogout(row: RecordType) {
    handleOperation({
      t,
      apiReq: api.logout(row.pk, {}),
      success() {
        tableRef.value.handleGetData();
      }
    });
  }

  /** 单行发送通知：跳转通知公告并预填收件人（与工具栏批量入口同参数口径） */
  function handleSendNotice(row: RecordType) {
    router.push({
      name: "SystemNotice",
      query: {
        notice_user: JSON.stringify([{ pk: row.pk, username: row.username }])
      }
    });
  }

  /**
   * 邀请激活：发送/重发邀请邮件（重置为待激活 + 密码立即失效）——高危动作二次确认；
   * 已激活账号重发后原密码失效，需重新激活（后端状态机保证非 pending 不可再激活）。
   */
  function handleInvite(row: RecordType) {
    ElMessageBox.confirm(
      t("systemUser.inviteConfirm"),
      t("systemUser.invite"),
      {
        confirmButtonText: t("buttons.sure"),
        cancelButtonText: t("buttons.cancel"),
        type: "warning"
      }
    )
      .then(() =>
        handleOperation({
          t,
          apiReq: api.invite(row.pk),
          success() {
            tableRef.value.handleGetData();
          }
        })
      )
      .catch(() => undefined);
  }

  /**
   * 用户抽屉：行内头像/用户名与操作列「管理」共用入口。
   * 动作执行前先收起抽屉再打开二级弹层（避免抽屉与弹窗叠加、焦点归属混乱）；
   * 分组与显隐由 buildUserActionGroups 统一裁决，面板只负责渲染。
   */
  function openUserPanel(row: RecordType) {
    const options: DrawerOptions = {
      title: t("systemUser.manageUser", { user: row.username }),
      size: deviceDetection() ? "100%" : "480px",
      destroyOnClose: true,
      hideFooter: true
    };
    const close = () => closeDrawer(options, 0);
    const withClosed =
      (run: (target: RecordType) => void) => (target: RecordType) => {
        close();
        run(target);
      };
    const groups = buildUserActionGroups({
      t,
      auth,
      flags: {
        sendNotice: hasAuth("create:SystemNotice"),
        assignTags: hasAuth("assign:Tag")
      },
      handlers: {
        resetPassword: withClosed(handleReset),
        uploadAvatar: withClosed(handleUpload),
        resetMfa: withClosed(handleResetMfa),
        logout: withClosed(handleLogout),
        assignRoles: withClosed(handleRoleRules),
        preview: withClosed(openPreview),
        invite: withClosed(handleInvite),
        sendNotice: withClosed(handleSendNotice),
        imBinding: withClosed(handleImBinding),
        assignTags: withClosed(target =>
          openTagDialog({ resource: USER_TAG_RESOURCE, row: target })
        ),
        changeHistory: withClosed(target =>
          handleShowChangeHistory({ t, api, row: target })
        )
      }
    });
    options.contentRenderer = () => h(UserActionPanel, { row, groups });
    addDrawer(options);
  }

  const {
    listColumnsFormat,
    addOrEditOptions,
    baseColumnsFormat,
    handleRoleRules
  } = useUserColumnFormats({
    t,
    api,
    auth,
    switchLoadMap,
    switchStyle,
    passwordRules,
    tableRef,
    openUserPanel
  });

  const { selectionChange, tableBarButtonsProps, operationButtonsProps } =
    useUserButtons({
      t,
      api,
      tableRef,
      selectedNum,
      manySelectData,
      handleBatchTags: pks =>
        openTagDialog({ resource: USER_TAG_RESOURCE, pks }),
      openUserPanel
    });

  // 全局密码规则（重置密码与新增/编辑表单校验共用）
  onMounted(() => {
    handleOperation({
      t,
      apiReq: rulesPasswordApi(),
      success(res) {
        passwordRules.value = res?.data?.password_rules;
      },
      showSuccessMsg: false
    });
  });

  // 联动：角色列表「用户数」跳转携带 ?role=<pk> —— 由 RePlusPage 的
  // routeParams 装配（route.query → 搜索默认值）自动生效，页面无需再注入：
  // 首开后二次手动刷新会覆盖请求序号，导致首开内联元数据被丢弃（表格无列）。

  return {
    api,
    auth,
    treeData,
    treeLoading,
    addOrEditOptions,
    tableBarButtonsProps,
    operationButtonsProps,
    onTreeSelect,
    selectionChange,
    deviceDetection,
    listColumnsFormat,
    baseColumnsFormat,
    openUserPanel
  };
}
