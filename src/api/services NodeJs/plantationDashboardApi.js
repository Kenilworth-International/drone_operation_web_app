import { baseApi } from '../baseApi';
import { nodeBackendBaseQuery } from './nodeBackendConfig';

/**
 * Coerce API payload to a row array. Handles string JSON, raw arrays, numeric-key objects, nested data.
 * RTK cache stores this array directly so the queue never mis-reads { status, data } nesting.
 */
function parseJsonIfString(maybe) {
  if (typeof maybe === 'string') {
    try {
      return JSON.parse(maybe);
    } catch {
      return null;
    }
  }
  return maybe;
}

function extractPlantationPlanRequestsRows(body) {
  const parsed = parseJsonIfString(body);
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== 'object') return [];

  if (Array.isArray(parsed.data)) return parsed.data;

  if (parsed.data && typeof parsed.data === 'object') {
    if (Array.isArray(parsed.data.rows)) return parsed.data.rows;
    if (Array.isArray(parsed.data.data)) return parsed.data.data;
    const innerKeys = Object.keys(parsed.data).filter((k) => !isNaN(Number(k)));
    if (innerKeys.length > 0) {
      return innerKeys.sort((a, b) => Number(a) - Number(b)).map((k) => parsed.data[k]);
    }
  }

  const topKeys = Object.keys(parsed).filter(
    (k) => !isNaN(Number(k)) && k !== 'status' && k !== 'count' && k !== 'data'
  );
  if (topKeys.length > 0) {
    return topKeys.sort((a, b) => Number(a) - Number(b)).map((k) => parsed[k]);
  }

  return [];
}

export const plantationDashboardApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Get calendar plans for a specific month
    getCalendarPlans: builder.query({
      queryFn: async ({ yearMonth, missionType }) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/plantation-dashboard/calendar-plans',
            method: 'POST',
            body: { yearMonth, missionType },
          },
          {},
          {}
        );
        return result;
      },
      providesTags: ['PlantationCalendarPlans'],
    }),

    // Get upcoming plans (after today)
    getUpcomingPlans: builder.query({
      queryFn: async ({ missionType }) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/plantation-dashboard/upcoming-plans',
            method: 'POST',
            body: { missionType },
          },
          {},
          {}
        );
        return result;
      },
      providesTags: ['PlantationUpcomingPlans'],
    }),

    // Get Planned vs Tea Revenue Extent chart data
    getPlannedVsTeaRevenueChart: builder.query({
      queryFn: async ({ missionType, months, startMonth, endMonth }) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/plantation-dashboard/chart/planned-vs-tea-revenue',
            method: 'POST',
            body: { missionType, months, startMonth, endMonth },
          },
          {},
          {}
        );
        return result;
      },
      providesTags: ['PlantationCharts'],
      keepUnusedDataFor: 300,
    }),

    // Get Tea Revenue vs Sprayed chart data
    getTeaRevenueVsSprayedChart: builder.query({
      queryFn: async ({ missionType, months, startMonth, endMonth, completedPlansOnly = true }) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/plantation-dashboard/chart/tea-revenue-vs-sprayed',
            method: 'POST',
            body: { missionType, months, startMonth, endMonth, completedPlansOnly },
          },
          {},
          {}
        );
        return result;
      },
      providesTags: ['PlantationCharts'],
      keepUnusedDataFor: 300,
    }),

    // Get completed mission reports
    getCompletedMissionReports: builder.query({
      queryFn: async ({ startDate, endDate, missionType, completedPlansOnly = true }) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/plantation-dashboard/completed-mission-reports',
            method: 'POST',
            body: { startDate, endDate, missionType, completedPlansOnly },
          },
          {},
          {}
        );
        return result;
      },
      providesTags: ['PlantationMissionReports'],
    }),

    // Get chart breakdown for drill-down
    getChartBreakdown: builder.query({
      queryFn: async ({
        chartType,
        missionType,
        yearMonth,
        breakdownLevel,
        filterPlantationId,
        filterRegionId,
        completedPlansOnly = true,
      }) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/plantation-dashboard/chart/breakdown',
            method: 'POST',
            body: {
              chartType,
              missionType,
              yearMonth,
              breakdownLevel,
              filterPlantationId,
              filterRegionId,
              completedPlansOnly,
            },
          },
          {},
          {}
        );
        return result;
      },
      providesTags: ['PlantationCharts'],
    }),

    // Get spray/spread fields breakdown for an estate (drill-down from estate card)
    getEstateFieldsBreakdown: builder.query({
      queryFn: async ({ estateId, yearMonth, missionType, completedPlansOnly = true }) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/plantation-dashboard/chart/breakdown/estate-fields',
            method: 'POST',
            body: { estateId, yearMonth, missionType, completedPlansOnly },
          },
          {},
          {}
        );
        return result;
      },
      providesTags: ['PlantationCharts'],
    }),

    // Get estate-plan accordion breakdown (estate → plan → fields with map)
    getEstatePlanBreakdown: builder.query({
      queryFn: async ({ yearMonth, missionType, chartType, completedPlansOnly = true }) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/plantation-dashboard/chart/breakdown/estate-plans',
            method: 'POST',
            body: { yearMonth, missionType, chartType, completedPlansOnly },
          },
          {},
          {}
        );
        return result;
      },
      providesTags: ['PlantationCharts'],
      keepUnusedDataFor: 300,
    }),

    // Get dashboard summary (6 metric cards for main page)
    getDashboardSummary: builder.query({
      queryFn: async ({
        yearMonth,
        missionType,
        completedPlansOnly = true,
        planCountPickedDate,
        planCountPickedFrom,
        planCountPickedTo,
      }) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/plantation-dashboard/dashboard-summary',
            method: 'POST',
            body: {
              yearMonth,
              missionType,
              completedPlansOnly,
              ...(planCountPickedDate ? { planCountPickedDate } : {}),
              ...(planCountPickedFrom && planCountPickedTo
                ? { planCountPickedFrom, planCountPickedTo }
                : {}),
            },
          },
          {},
          {}
        );
        return result;
      },
      providesTags: ['PlantationDashboardSummary'],
      keepUnusedDataFor: 120,
    }),

    // Global chart data (no user hierarchy filter - for corporate DataViewer)
    getGlobalPlannedVsTeaRevenueChart: builder.query({
      queryFn: async ({ missionType, months, startMonth, endMonth, plantationId, regionId, estateId }) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/plantation-dashboard/chart/global/planned-vs-tea-revenue',
            method: 'POST',
            body: { missionType, months, startMonth, endMonth, plantationId, regionId, estateId },
          },
          {},
          {}
        );
        return result;
      },
      providesTags: ['PlantationCharts'],
    }),

    getGlobalTeaRevenueVsSprayedChart: builder.query({
      queryFn: async ({ missionType, months, startMonth, endMonth, plantationId, regionId, estateId }) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/plantation-dashboard/chart/global/tea-revenue-vs-sprayed',
            method: 'POST',
            body: { missionType, months, startMonth, endMonth, plantationId, regionId, estateId },
          },
          {},
          {}
        );
        return result;
      },
      providesTags: ['PlantationCharts'],
    }),

    getGlobalEstatePlanBreakdown: builder.query({
      queryFn: async ({ yearMonth, missionType, chartType, plantationId, regionId, estateId }) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/plantation-dashboard/chart/global/breakdown/estate-plans',
            method: 'POST',
            body: { yearMonth, missionType, chartType, plantationId, regionId, estateId },
          },
          {},
          {}
        );
        return result;
      },
      providesTags: ['PlantationCharts'],
    }),

    // Get one-month export (summary + field-wise) for Excel on Chart Details
    getMonthExport: builder.query({
      queryFn: async ({ yearMonth, missionType, chartType, completedPlansOnly = true }) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/plantation-dashboard/chart/export-month',
            method: 'POST',
            body: { yearMonth, missionType, chartType, completedPlansOnly },
          },
          {},
          {}
        );
        return result;
      },
      providesTags: ['PlantationCharts'],
    }),

    getPlantationsList: builder.query({
      queryFn: async () => {
        const result = await nodeBackendBaseQuery(
          { url: '/api/plantation-dashboard/plantations', method: 'GET' },
          {},
          {}
        );
        return result;
      },
      keepUnusedDataFor: 300,
    }),

    getEstatesList: builder.query({
      queryFn: async (plantationId) => {
        const url = plantationId
          ? `/api/plantation-dashboard/estates?plantationId=${plantationId}`
          : '/api/plantation-dashboard/estates';
        const result = await nodeBackendBaseQuery(
          { url, method: 'GET' },
          {},
          {}
        );
        return result;
      },
      keepUnusedDataFor: 300,
    }),

    createPlantationPlanRequest: builder.mutation({
      queryFn: async (body) => {
        const result = await nodeBackendBaseQuery(
          { url: '/api/plantation-plan-requests', method: 'POST', body },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['PlantationPlanRequests'],
    }),

    getPlantationPlanRequestsPendingCount: builder.query({
      queryFn: async () => {
        const result = await nodeBackendBaseQuery(
          { url: '/api/plantation-plan-requests/pending-count', method: 'GET' },
          {},
          {}
        );
        return result;
      },
      providesTags: ['PlantationPlanRequests'],
    }),

    getPlantationPlanRequestMonthStats: builder.query({
      queryFn: async ({ yearMonth }) => {
        const q = new URLSearchParams({ yearMonth: String(yearMonth) });
        const result = await nodeBackendBaseQuery(
          { url: `/api/plantation-plan-requests/month-stats?${q.toString()}`, method: 'GET' },
          {},
          {}
        );
        return result;
      },
      providesTags: ['PlantationPlanRequests'],
    }),

    getPlantationPlanRequestsEstateMonth: builder.query({
      queryFn: async ({ yearMonth }) => {
        const q = new URLSearchParams({ yearMonth: String(yearMonth) });
        const result = await nodeBackendBaseQuery(
          { url: `/api/plantation-plan-requests/estate-month?${q.toString()}`, method: 'GET' },
          {},
          {}
        );
        return result;
      },
      providesTags: ['PlantationPlanRequests'],
    }),

    getPlantationPlanRequestsList: builder.query({
      queryFn: async ({ status = 'pending', limit } = {}) => {
        const q = new URLSearchParams({ status: String(status) });
        if (limit != null && limit !== '') q.set('limit', String(limit));
        const result = await nodeBackendBaseQuery(
          { url: `/api/plantation-plan-requests?${q.toString()}`, method: 'GET' },
          {},
          {}
        );
        if (result.error) return result;
        const rows = extractPlantationPlanRequestsRows(result.data);
        return { data: rows };
      },
      providesTags: ['PlantationPlanRequests'],
    }),

    declinePlantationPlanRequest: builder.mutation({
      queryFn: async ({ id, declineReason }) => {
        const result = await nodeBackendBaseQuery(
          {
            url: `/api/plantation-plan-requests/${id}/decline`,
            method: 'POST',
            body: { declineReason: declineReason || '' },
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['PlantationPlanRequests'],
    }),

    markPlantationPlanRequestApproved: builder.mutation({
      queryFn: async ({ id, planCount } = {}) => {
        const result = await nodeBackendBaseQuery(
          {
            url: `/api/plantation-plan-requests/${id}/mark-approved`,
            method: 'POST',
            body: { planCount },
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['PlantationPlanRequests', 'Plans', 'Calendar'],
    }),

    approvePlantationPlanRequest: builder.mutation({
      queryFn: async ({ id, pickedDate, planCount }) => {
        const result = await nodeBackendBaseQuery(
          {
            url: `/api/plantation-plan-requests/${id}/approve`,
            method: 'POST',
            body: { pickedDate, planCount },
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['PlantationPlanRequests', 'Plans', 'Calendar'],
    }),

    getPlantationPlanRequestOpsCalendarPlans: builder.query({
      queryFn: async ({ startDate, endDate, estateId } = {}) => {
        const q = new URLSearchParams({
          startDate: String(startDate),
          endDate: String(endDate),
        });
        if (estateId != null && estateId !== '') {
          q.set('estateId', String(estateId));
        }
        const result = await nodeBackendBaseQuery(
          { url: `/api/plantation-plan-requests/ops-calendar-plans?${q.toString()}`, method: 'GET' },
          {},
          {}
        );
        if (result.error) return result;
        const rows = extractPlantationPlanRequestsRows(result.data);
        return { data: rows };
      },
      providesTags: ['PlantationPlanRequests', 'Calendar'],
    }),

    getPlantationPlanRescheduleRequestsPendingCount: builder.query({
      queryFn: async () => {
        const result = await nodeBackendBaseQuery(
          { url: '/api/plantation-plan-reschedule-requests/pending-count', method: 'GET' },
          {},
          {}
        );
        return result;
      },
      providesTags: ['PlantationPlanRescheduleRequests'],
    }),

    getPlantationPlanRescheduleRequestsList: builder.query({
      queryFn: async ({ status = 'pending', limit } = {}) => {
        const q = new URLSearchParams({ status: String(status) });
        if (limit != null && limit !== '') q.set('limit', String(limit));
        const result = await nodeBackendBaseQuery(
          { url: `/api/plantation-plan-reschedule-requests?${q.toString()}`, method: 'GET' },
          {},
          {}
        );
        if (result.error) return result;
        const rows = extractPlantationPlanRequestsRows(result.data);
        return { data: rows };
      },
      providesTags: ['PlantationPlanRescheduleRequests'],
    }),

    approvePlantationPlanRescheduleRequest: builder.mutation({
      queryFn: async ({ id, pickedDate }) => {
        const result = await nodeBackendBaseQuery(
          {
            url: `/api/plantation-plan-reschedule-requests/${id}/approve`,
            method: 'POST',
            body: { pickedDate },
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['PlantationPlanRescheduleRequests', 'Plans', 'Calendar'],
    }),

    declinePlantationPlanRescheduleRequest: builder.mutation({
      queryFn: async ({ id, declineReason }) => {
        const result = await nodeBackendBaseQuery(
          {
            url: `/api/plantation-plan-reschedule-requests/${id}/decline`,
            method: 'POST',
            body: { declineReason: declineReason || '' },
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['PlantationPlanRescheduleRequests'],
    }),

    getPlantationMonthlyPlanRequestsPendingCount: builder.query({
      queryFn: async () => {
        const result = await nodeBackendBaseQuery(
          { url: '/api/plantation-monthly-plan-requests/pending-count', method: 'GET' },
          {},
          {}
        );
        return result;
      },
      providesTags: ['PlantationMonthlyPlanRequests'],
    }),

    getPlantationMonthlyPlanRequestsList: builder.query({
      queryFn: async ({ status = 'pending', limit } = {}) => {
        const q = new URLSearchParams({ status: String(status) });
        if (limit != null && limit !== '') q.set('limit', String(limit));
        const result = await nodeBackendBaseQuery(
          { url: `/api/plantation-monthly-plan-requests?${q.toString()}`, method: 'GET' },
          {},
          {}
        );
        if (result.error) return result;
        const rows = extractPlantationPlanRequestsRows(result.data);
        return { data: rows };
      },
      providesTags: ['PlantationMonthlyPlanRequests'],
    }),

    getPlantationMonthlyPlanRequestById: builder.query({
      queryFn: async (id) => {
        const result = await nodeBackendBaseQuery(
          { url: `/api/plantation-monthly-plan-requests/${id}`, method: 'GET' },
          {},
          {}
        );
        return result;
      },
      providesTags: ['PlantationMonthlyPlanRequests'],
    }),

    getPlantationMonthlyPlanRequestCalendarContext: builder.query({
      queryFn: async (id) => {
        const result = await nodeBackendBaseQuery(
          { url: `/api/plantation-monthly-plan-requests/${id}/calendar-context`, method: 'GET' },
          {},
          {}
        );
        return result;
      },
      providesTags: ['PlantationMonthlyPlanRequests'],
    }),

    getPlantationMonthlyPlanAcceptBoard: builder.query({
      queryFn: async ({ yearMonth, status = 'open' } = {}) => {
        const q = new URLSearchParams({
          yearMonth: String(yearMonth || ''),
          status: String(status || 'open'),
        });
        const result = await nodeBackendBaseQuery(
          { url: `/api/plantation-monthly-plan-requests/accept-board?${q.toString()}`, method: 'GET' },
          {},
          {}
        );
        if (result.error) return result;
        const body = result.data;
        const data = body?.data ?? body;
        return { data };
      },
      providesTags: ['PlantationMonthlyPlanRequests', 'Plans', 'Calendar'],
    }),

    approvePlantationMonthlyPlanRequest: builder.mutation({
      queryFn: async ({ id, lines }) => {
        const result = await nodeBackendBaseQuery(
          {
            url: `/api/plantation-monthly-plan-requests/${id}/approve`,
            method: 'POST',
            body: { lines },
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['PlantationMonthlyPlanRequests', 'Plans', 'Calendar'],
    }),

    bulkApprovePlantationMonthlyPlanRequests: builder.mutation({
      queryFn: async (body) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/plantation-monthly-plan-requests/bulk-approve',
            method: 'POST',
            body,
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['PlantationMonthlyPlanRequests', 'Plans', 'Calendar'],
    }),

    bulkRejectPlantationMonthlyPlanRequests: builder.mutation({
      queryFn: async (body) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/plantation-monthly-plan-requests/bulk-reject',
            method: 'POST',
            body,
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['PlantationMonthlyPlanRequests', 'Plans', 'Calendar'],
    }),

    changePlantationMonthlyPlanLineDate: builder.mutation({
      queryFn: async ({ requestId, lineId, pickedDate }) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/plantation-monthly-plan-requests/change-line-date',
            method: 'POST',
            body: { requestId, lineId, pickedDate },
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['PlantationMonthlyPlanRequests', 'Plans', 'Calendar'],
    }),

    declinePlantationMonthlyPlanRequest: builder.mutation({
      queryFn: async ({ id, declineReason }) => {
        const result = await nodeBackendBaseQuery(
          {
            url: `/api/plantation-monthly-plan-requests/${id}/decline`,
            method: 'POST',
            body: { declineReason: declineReason || '' },
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['PlantationMonthlyPlanRequests'],
    }),
  }),
});

export const {
  useGetCalendarPlansQuery,
  useLazyGetCalendarPlansQuery,
  useGetUpcomingPlansQuery,
  useGetPlannedVsTeaRevenueChartQuery,
  useGetTeaRevenueVsSprayedChartQuery,
  useGetCompletedMissionReportsQuery,
  useGetChartBreakdownQuery,
  useGetEstateFieldsBreakdownQuery,
  useGetEstatePlanBreakdownQuery,
  useGetDashboardSummaryQuery,
  useGetMonthExportQuery,
  useLazyGetMonthExportQuery,
  useGetGlobalPlannedVsTeaRevenueChartQuery,
  useGetGlobalTeaRevenueVsSprayedChartQuery,
  useGetGlobalEstatePlanBreakdownQuery,
  useGetPlantationsListQuery,
  useLazyGetPlantationsListQuery,
  useGetEstatesListQuery,
  useLazyGetEstatesListQuery,
  useCreatePlantationPlanRequestMutation,
  useGetPlantationPlanRequestsPendingCountQuery,
  useGetPlantationPlanRequestMonthStatsQuery,
  useGetPlantationPlanRequestsEstateMonthQuery,
  useGetPlantationPlanRequestsListQuery,
  useDeclinePlantationPlanRequestMutation,
  useMarkPlantationPlanRequestApprovedMutation,
  useApprovePlantationPlanRequestMutation,
  useLazyGetPlantationPlanRequestOpsCalendarPlansQuery,
  useGetPlantationPlanRescheduleRequestsPendingCountQuery,
  useGetPlantationPlanRescheduleRequestsListQuery,
  useApprovePlantationPlanRescheduleRequestMutation,
  useDeclinePlantationPlanRescheduleRequestMutation,
  useGetPlantationMonthlyPlanRequestsPendingCountQuery,
  useGetPlantationMonthlyPlanRequestsListQuery,
  useGetPlantationMonthlyPlanRequestByIdQuery,
  useGetPlantationMonthlyPlanRequestCalendarContextQuery,
  useGetPlantationMonthlyPlanAcceptBoardQuery,
  useApprovePlantationMonthlyPlanRequestMutation,
  useBulkApprovePlantationMonthlyPlanRequestsMutation,
  useBulkRejectPlantationMonthlyPlanRequestsMutation,
  useChangePlantationMonthlyPlanLineDateMutation,
  useDeclinePlantationMonthlyPlanRequestMutation,
} = plantationDashboardApi;
