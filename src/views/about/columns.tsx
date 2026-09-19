import { useI18n } from "vue-i18n";
import type { PlusColumn } from "plus-pro-components";

export function useColumns() {
  const { t } = useI18n();
  const { pkg, lastBuildTime } = __APP_INFO__;
  const { version, engines } = pkg;
  const columns: PlusColumn[] = [
    {
      label: t("about.version"),
      prop: "version",
      minWidth: 100,
      renderDescriptionsItem: () => {
        return (
          <el-tag size="large" class="text-base!">
            {version}
          </el-tag>
        );
      }
    },
    {
      label: t("about.buildTime"),
      prop: "buildTime",
      minWidth: 120,
      renderDescriptionsItem: () => {
        return (
          <el-tag size="large" class="text-base!">
            {lastBuildTime}
          </el-tag>
        );
      }
    },
    {
      label: t("about.nodeVersion"),
      prop: "node",
      minWidth: 140,
      renderDescriptionsItem: () => {
        return (
          <el-tag size="large" class="text-base!">
            {engines.node}
          </el-tag>
        );
      }
    },
    {
      label: t("about.pnpmVersion"),
      prop: "pnpm",
      minWidth: 140,
      renderDescriptionsItem: () => {
        return (
          <el-tag size="large" class="text-base!">
            {engines.pnpm}
          </el-tag>
        );
      }
    },
    {
      label: t("about.webRepo"),
      prop: "webUrl",
      minWidth: 140,
      className: "pure-version",
      renderDescriptionsItem: () => {
        return (
          <a href="https://github.com/nineaiyu/xadmin-client" target="_blank">
            <span style="color: var(--el-color-primary)">
              {t("about.webRepo")}
            </span>
          </a>
        );
      }
    },
    {
      label: t("about.serverRepo"),
      prop: "apiUrl",
      minWidth: 140,
      className: "pure-version",
      renderDescriptionsItem: () => {
        return (
          <a href="https://github.com/nineaiyu/xadmin-server" target="_blank">
            <span style="color: var(--el-color-primary)">
              {t("about.serverRepo")}
            </span>
          </a>
        );
      }
    },
    {
      label: t("about.docUrl"),
      prop: "docUrl",
      minWidth: 100,
      className: "pure-version",
      renderDescriptionsItem: () => {
        return (
          <a href="https://docs.dvcloud.xin" target="_blank">
            <span style="color: var(--el-color-primary)">
              {t("about.docUrl")}
            </span>
          </a>
        );
      }
    },
    {
      label: t("about.demoUrl"),
      prop: "demoUrl",
      minWidth: 100,
      className: "pure-version",
      renderDescriptionsItem: () => {
        return (
          <a href="https://xadmin.dvcloud.xin/" target="_blank">
            <span style="color: var(--el-color-primary)">
              {t("about.demoUrl")}
            </span>
          </a>
        );
      }
    }
  ];

  return {
    columns
  };
}
