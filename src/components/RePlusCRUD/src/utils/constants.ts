import { $t, transformI18n } from "@/plugins/i18n";

export const ExportImportFormatOptions = [
  { label: "CSV", value: "csv" },
  { label: "Excel", value: "xlsx" }
];

export const selectBooleanOptions = [
  {
    label: transformI18n($t("labels.enable")),
    value: true
  },
  {
    label: transformI18n($t("labels.disable")),
    value: false
  }
];
