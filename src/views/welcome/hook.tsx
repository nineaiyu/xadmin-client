import { computed, onMounted, ref } from "vue";
import {
  getDashBoardTodayOperateTotalApi,
  getDashBoardUserActiveApi,
  getDashBoardUserLoginTotalApi,
  getDashBoardUserLoginTrendApi,
  getDashBoardUserRegisterTrendApi,
  getDashBoardUserTotalApi
} from "@/api/system/dashboard";
import { useI18n } from "vue-i18n";
import GroupLine from "@iconify-icons/ri/group-line";
import LoginLine from "@iconify-icons/ep/lock";
import LogLine from "@iconify-icons/ep/tickets";
import { operationLogApi } from "@/api/system/logs/operation";
import { getKeyList } from "@pureadmin/utils";
import { hasGlobalAuth } from "@/router/utils";

export function useDashboard() {
  const { t } = useI18n();
  const optionsBasis = computed(() => {
    return [
      {
        label: t("login.register")
      },
      {
        label: t("login.login")
      }
    ];
  });
  const dataList = ref([]);
  const loading = ref(true);

  const chartData = ref([]);
  const userLoginList = ref([]);
  const userRegisterList = ref([]);
  const operateLogList = ref([]);
  const userActiveList = ref([]);

  const getUserActiveList = () => {
    getDashBoardUserActiveApi().then(res => {
      if (res.code === 1000) {
        res.results.forEach(item => {
          userActiveList.value.push({
            name:
              item[0] === 1
                ? t("welcome.today")
                : `${item[0]}${t("welcome.days")}`,
            value: item,
            duration: 2200
          });
        });
      }
    });
  };

  const getTodayOperateTotal = () => {
    getDashBoardTodayOperateTotalApi().then(res => {
      if (hasGlobalAuth("list:systemOperationLog")) {
        getOperateLogList();
      }
      if (res.code === 1000) {
        chartData.value.push({
          icon: LogLine,
          bgColor: "#eff8f4",
          color: "#7846e5",
          duration: 2200,
          name: t("welcome.requestNum"),
          value: getKeyList(res.results, "count", false)[
            res.results.length - 1
          ],
          percent: res.percent > 0 ? `+${res.percent}%` : `${res.percent}%`,
          data: getKeyList(res.results, "count", false)
        });
      }
    });
  };
  const getUserTotal = () => {
    getDashBoardUserTotalApi().then(res => {
      if (res.code === 1000) {
        chartData.value.push({
          icon: GroupLine,
          bgColor: "#eff8f4",
          color: "#26ce83",
          duration: 2200,
          name: t("welcome.userNum"),
          value: res.count,
          percent: res.percent > 0 ? `+${res.percent}%` : `${res.percent}%`,
          data: getKeyList(res.results, "count", false)
        });
      }
    });
  };
  const getUserLoginTotal = () => {
    getDashBoardUserLoginTotalApi().then(res => {
      if (res.code === 1000) {
        chartData.value.push({
          icon: LoginLine,
          bgColor: "#effaff",
          color: "#41b6ff",
          duration: 2200,
          name: t("welcome.loginTimes"),
          value: res.count,
          percent: res.percent > 0 ? `+${res.percent}%` : `${res.percent}%`,
          data: getKeyList(res.results, "count", false)
        });
      }
    });
  };
  const getUserLoginList = () => {
    getDashBoardUserLoginTrendApi().then(res => {
      if (res.code === 1000) {
        userLoginList.value = res.results;
      }
    });
  };

  const getUserRegisterList = () => {
    getDashBoardUserRegisterTrendApi().then(res => {
      if (res.code === 1000) {
        userRegisterList.value = res.results;
      }
    });
  };

  const getOperateLogList = () => {
    operationLogApi
      .list({
        page: 1,
        size: 20,
        ordering: "-created_time"
      })
      .then(res => {
        if (res.code === 1000) {
          operateLogList.value = res.data?.results;
        }
      });
  };

  onMounted(() => {
    getUserTotal();
    getUserLoginList();
    getUserLoginTotal();
    getTodayOperateTotal();
    getUserActiveList();
    getUserRegisterList();
  });

  return {
    t,
    loading,
    dataList,
    chartData,
    optionsBasis,
    userLoginList,
    userActiveList,
    operateLogList,
    userRegisterList
  };
}
