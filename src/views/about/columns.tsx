import { useI18n } from "vue-i18n";
import type { PlusColumn } from "plus-pro-components";

/**
 * 「平台信息」卡的版本行（descriptions）列定义：
 * 只放「键值对」形态的版本信息；仓库 / 文档 / 演示等外链由页面的链接行承载
 * （放在 descriptions 里会让 label 与链接文案重复，如「前端代码地址 | 前端代码地址」）。
 */
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
          <el-tag size="large" class="font-mono!">
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
          <el-tag size="large" class="font-mono!">
            {lastBuildTime}
          </el-tag>
        );
      }
    },
    {
      label: t("about.nodeVersion"),
      prop: "node",
      minWidth: 120,
      renderDescriptionsItem: () => {
        return (
          <el-tag size="large" class="font-mono!">
            {engines.node}
          </el-tag>
        );
      }
    },
    {
      label: t("about.pnpmVersion"),
      prop: "pnpm",
      minWidth: 120,
      renderDescriptionsItem: () => {
        return (
          <el-tag size="large" class="font-mono!">
            {engines.pnpm}
          </el-tag>
        );
      }
    }
  ];

  return {
    columns
  };
}
