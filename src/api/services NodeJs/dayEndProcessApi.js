import { baseApi } from '../baseApi';
import { nodeBackendBaseQuery } from './nodeBackendConfig';

export const dayEndProcessApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Update ops_task_status after DJI submission
    updateOpsTaskStatus: builder.mutation({
      queryFn: async ({ taskId, status }) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/day-end-process/update-ops-task-status',
            method: 'POST',
            body: { taskId, status },
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['DayEndProcess'],
    }),

    // Get plans pending day end process count
    getPlansPendingDayEndCount: builder.query({
      queryFn: async () => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/day-end-process/plans-pending-count',
            method: 'POST',
            body: {},
          },
          {},
          {}
        );
        return result;
      },
      providesTags: ['DayEndProcessCount'],
    }),

    // Get plan completion statistics
    getPlanCompletionStats: builder.query({
      queryFn: async ({ planId }) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/day-end-process/plan-completion-stats',
            method: 'POST',
            body: { planId },
          },
          {},
          {}
        );
        return result;
      },
      providesTags: (result, error, { planId }) => [{ type: 'PlanCompletionStats', id: planId }],
    }),

    // Get plans with completion statistics for a date
    getPlansWithCompletionStats: builder.query({
      queryFn: async ({ date }) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/day-end-process/plans-completion-stats',
            method: 'POST',
            body: { date },
          },
          {},
          {}
        );
        return result;
      },
      providesTags: ['PlansCompletionStats'],
    }),
    // Get cancel reasons (mission_partial_reasons)
    getCancelReasons: builder.query({
      queryFn: async (arg) => {
        try {
          const reasonFlag = arg?.reasonFlag;
          const body =
            reasonFlag === 'c' || reasonFlag === 'h' ? { reasonFlag } : {};
          const result = await nodeBackendBaseQuery(
            { url: '/api/day-end-process/cancel-reasons', method: 'POST', body },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || [] };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      providesTags: ['CancelReasons'],
    }),

    // Get cancel status for tasks in a plan (com_naration data)
    getTasksCancelStatus: builder.query({
      queryFn: async ({ planId }) => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: '/api/day-end-process/tasks-cancel-status', method: 'POST', body: { planId } },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || {} };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      providesTags: (result, error, { planId }) => [{ type: 'TaskCancelStatus', id: planId }],
    }),

    // Cancel a task (set com_naration)
    cancelTask: builder.mutation({
      queryFn: async ({ taskId, reasonId }) => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: '/api/day-end-process/cancel-task', method: 'POST', body: { taskId, reasonId } },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || null };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: (result, error, { taskId }) => ['DayEndProcess', 'TaskCancelStatus'],
    }),

    // Remove ops room cancel reason (clear com_naration)
    clearOpsCancel: builder.mutation({
      queryFn: async ({ taskId }) => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: '/api/day-end-process/clear-ops-cancel', method: 'POST', body: { taskId } },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data || null };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['DayEndProcess', 'TaskCancelStatus'],
    }),

    // Reset pilot cancel - Reset pilot canceled task to pending
    resetPilotCancel: builder.mutation({
      queryFn: async ({ taskId }) => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: '/api/day-end-process/reset-pilot-cancel', method: 'POST', body: { taskId } },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || null };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: (result, error, { taskId }) => ['DayEndProcess', 'TaskCancelStatus'],
    }),

    // Get ops room canceled tasks by date range (report)
    getOpsRoomCanceledByDateRange: builder.query({
      queryFn: async ({ startDate, endDate, reasonFlag }) => {
        try {
          const result = await nodeBackendBaseQuery(
            {
              url: '/api/day-end-process/ops-room-canceled-by-date-range',
              method: 'POST',
              body: { startDate, endDate, reasonFlag: reasonFlag || undefined },
            },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || [] };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      providesTags: ['OpsRoomCanceledReport'],
    }),

    getDayOverview: builder.query({
      queryFn: async ({ date }) => {
        const result = await nodeBackendBaseQuery(
          { url: '/api/day-end-process/day-overview', method: 'POST', body: { date } },
          {},
          {}
        );
        if (result.error) return { error: result.error };
        return { data: result.data?.data || [] };
      },
      providesTags: ['DayEndProcess', 'PlansCompletionStats'],
    }),

    getDayEndAutomationSummary: builder.query({
      queryFn: async ({ date }) => {
        const result = await nodeBackendBaseQuery(
          { url: '/api/day-end-process/automation-summary', method: 'POST', body: { date } },
          {},
          {}
        );
        if (result.error) return { error: result.error };
        return { data: result.data?.data || null };
      },
      providesTags: ['DayEndAutomationSummary', 'DayEndProcess'],
    }),

    addExtraDjiFieldToPlan: builder.mutation({
      queryFn: async ({ djiImageId, planId, pilotId }) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/day-end-process/add-extra-dji-field',
            method: 'POST',
            body: { dji_image_id: djiImageId, plan_id: planId, pilot_id: pilotId || undefined },
          },
          {},
          {}
        );
        if (result.error) return { error: result.error };
        return { data: result.data || null };
      },
      invalidatesTags: ['DayEndAutomationSummary', 'DayEndProcess', 'PlansCompletionStats', 'PlanDetails'],
    }),

    getDayEndPlanSummary: builder.query({
      queryFn: async (planId) => {
        const result = await nodeBackendBaseQuery(
          { url: '/api/day-end-process/plan-summary', method: 'POST', body: { planId } },
          {},
          {}
        );
        if (result.error) return { error: result.error };
        return { data: result.data?.data || null };
      },
      providesTags: (result, error, planId) => [{ type: 'PlanDetails', id: `dayend-summary-${planId}` }],
    }),

    getDayEndTasksByPlanAndField: builder.query({
      queryFn: async ({ planId, fieldId }) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/day-end-process/tasks-by-plan-and-field',
            method: 'POST',
            body: { planId, fieldId },
          },
          {},
          {}
        );
        if (result.error) return { error: result.error };
        return { data: result.data?.data || { tasks: [] } };
      },
      providesTags: (result, error, { planId, fieldId }) => [
        { type: 'PlanDetails', id: `dayend-tasks-${planId}-${fieldId}` },
      ],
    }),

    submitDayEndDjiRecord: builder.mutation({
      queryFn: async (body) => {
        const result = await nodeBackendBaseQuery(
          { url: '/api/day-end-process/submit-dji-record', method: 'POST', body },
          {},
          {}
        );
        if (result.error) return { error: result.error };
        return { data: result.data || null };
      },
      invalidatesTags: ['DayEndProcess', 'PlansCompletionStats', 'PlanDetails'],
    }),

    updateDayEndOpsApproval: builder.mutation({
      queryFn: async ({ planId, status }) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/day-end-process/update-ops-approval',
            method: 'POST',
            body: { planId, status },
          },
          {},
          {}
        );
        if (result.error) return { error: result.error };
        return { data: result.data || null };
      },
      invalidatesTags: ['DayEndProcess', 'PlansCompletionStats'],
    }),

    getDayEndFlagReasons: builder.query({
      queryFn: async () => {
        const result = await nodeBackendBaseQuery(
          { url: '/api/day-end-process/flag-reasons', method: 'POST', body: {} },
          {},
          {}
        );
        if (result.error) return { error: result.error };
        const payload = result.data;
        const list = Array.isArray(payload) ? payload : payload?.data || [];
        return { data: list };
      },
      providesTags: ['Reasons'],
    }),

    getDayEndTaskFlag: builder.query({
      queryFn: async (taskId) => {
        const result = await nodeBackendBaseQuery(
          { url: '/api/day-end-process/task-flag', method: 'POST', body: { taskId } },
          {},
          {}
        );
        if (result.error) return { error: result.error };
        return { data: result.data || { flags: [] } };
      },
      providesTags: (result, error, taskId) => [{ type: 'TaskReports', id: taskId }],
    }),

    submitDayEndTaskFlag: builder.mutation({
      queryFn: async ({ taskId, reason, reasonList }) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/day-end-process/submit-task-flag',
            method: 'POST',
            body: { taskId, reason, reasonList },
          },
          {},
          {}
        );
        if (result.error) return { error: result.error };
        return { data: result.data || null };
      },
      invalidatesTags: (result, error, { taskId }) => ['TaskReports', { type: 'TaskReports', id: taskId }],
    }),
  }),
});

export const {
  useUpdateOpsTaskStatusMutation,
  useGetPlansPendingDayEndCountQuery,
  useGetPlanCompletionStatsQuery,
  useGetPlansWithCompletionStatsQuery,
  useGetCancelReasonsQuery,
  useLazyGetCancelReasonsQuery,
  useGetTasksCancelStatusQuery,
  useCancelTaskMutation,
  useClearOpsCancelMutation,
  useResetPilotCancelMutation,
  useGetOpsRoomCanceledByDateRangeQuery,
  useGetDayOverviewQuery,
  useLazyGetDayOverviewQuery,
  useGetDayEndAutomationSummaryQuery,
  useAddExtraDjiFieldToPlanMutation,
  useGetDayEndPlanSummaryQuery,
  useLazyGetDayEndPlanSummaryQuery,
  useGetDayEndTasksByPlanAndFieldQuery,
  useLazyGetDayEndTasksByPlanAndFieldQuery,
  useSubmitDayEndDjiRecordMutation,
  useUpdateDayEndOpsApprovalMutation,
  useGetDayEndFlagReasonsQuery,
  useLazyGetDayEndFlagReasonsQuery,
  useGetDayEndTaskFlagQuery,
  useLazyGetDayEndTaskFlagQuery,
  useSubmitDayEndTaskFlagMutation,
} = dayEndProcessApi;

