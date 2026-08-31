import { baseApi } from '../baseApi';
import { nodeBackendBaseQuery } from './nodeBackendConfig';

export const plantationEstateManagerApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPendingManagerPlans: builder.query({
      queryFn: async () => {
        const result = await nodeBackendBaseQuery(
          { url: '/api/plantation-estate-manager/pending-plans', method: 'GET' },
          {},
          {}
        );
        return result;
      },
      providesTags: ['PlantationEstateManager'],
    }),

    getAllManagerPlans: builder.query({
      queryFn: async ({ yearMonth }) => {
        const result = await nodeBackendBaseQuery(
          {
            url: `/api/plantation-estate-manager/all-plans?${new URLSearchParams({ yearMonth }).toString()}`,
            method: 'GET',
          },
          {},
          {}
        );
        return result;
      },
      providesTags: ['PlantationEstateManager'],
    }),

    getManagerPlanDetail: builder.query({
      queryFn: async (planId) => {
        const result = await nodeBackendBaseQuery(
          { url: `/api/plantation-estate-manager/plan-detail/${planId}`, method: 'GET' },
          {},
          {}
        );
        return result;
      },
      providesTags: ['PlantationEstateManager'],
    }),

    getPlanEditContext: builder.query({
      queryFn: async (planId) => {
        const result = await nodeBackendBaseQuery(
          {
            url: `/api/plantation-estate-manager/web-plan-edit-context/${planId}?skipDateRestriction=true&skipPlanSizeCheck=true`,
            method: 'GET',
          },
          {},
          {}
        );
        return result;
      },
      providesTags: (result, error, planId) => [
        { type: 'PlantationEstateManager', id: `edit-context-${planId}` },
      ],
    }),

    getApprovePlanContext: builder.query({
      queryFn: async (planId) => {
        const result = await nodeBackendBaseQuery(
          { url: `/api/plantation-estate-manager/approve-context/${planId}`, method: 'GET' },
          {},
          {}
        );
        return result;
      },
      providesTags: ['PlantationEstateManager'],
    }),

    submitPlanEdit: builder.mutation({
      queryFn: async ({ planId, fieldIds, timeOfDayId, chemicals, removeReasonId }) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/plantation-estate-manager/web-plan-edit',
            method: 'POST',
            body: {
              planId,
              fieldIds,
              timeOfDayId,
              chemicals,
              skipDateRestriction: true,
              skipPlanSizeCheck: true,
              ...(removeReasonId ? { removeReasonId } : {}),
            },
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: (result, error, { planId }) => [
        'PlantationEstateManager',
        'EmergencyMoving',
        { type: 'PlantationEstateManager', id: `edit-context-${planId}` },
      ],
    }),

    getManagerFieldRemoveReasons: builder.query({
      queryFn: async () => {
        const result = await nodeBackendBaseQuery(
          { url: '/api/plantation-estate-manager/manager-field-remove-reasons', method: 'GET' },
          {},
          {}
        );
        return result;
      },
      providesTags: ['PlantationEstateManager'],
    }),

    getPlanCustomizationLog: builder.query({
      queryFn: async ({ planId }) => {
        const result = await nodeBackendBaseQuery(
          { url: `/api/plantation-estate-manager/plan-customization-log/${planId}`, method: 'GET' },
          {},
          {}
        );
        return result;
      },
      providesTags: ['PlantationEstateManager'],
    }),

    getWebPlanCustomizationLog: builder.query({
      queryFn: async (planId) => {
        const result = await nodeBackendBaseQuery(
          { url: `/api/plantation-estate-manager/web-plan-customization-log/${planId}`, method: 'GET' },
          {},
          {}
        );
        return result;
      },
      providesTags: ['PlantationEstateManager'],
    }),

    getManagerPlanEditContext: builder.query({
      queryFn: async (planId) => {
        const result = await nodeBackendBaseQuery(
          { url: `/api/plantation-estate-manager/plan-edit-context/${planId}`, method: 'GET' },
          {},
          {}
        );
        if (result.error) return result;
        return { data: result.data?.data ?? result.data };
      },
      providesTags: (result, error, planId) => [
        { type: 'PlantationEstateManager', id: `mgr-edit-context-${planId}` },
      ],
    }),

    submitManagerPlanEdit: builder.mutation({
      queryFn: async (body) => {
        const result = await nodeBackendBaseQuery(
          { url: '/api/plantation-estate-manager/plan-edit', method: 'POST', body },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['PlantationEstateManager', 'PlantationCalendarPlans', 'PlantationPlans'],
    }),

    submitPlanApproval: builder.mutation({
      queryFn: async (body) => {
        const result = await nodeBackendBaseQuery(
          { url: '/api/plantation-estate-manager/approve-plan', method: 'POST', body },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['PlantationEstateManager', 'PlantationCalendarPlans', 'PlantationDashboardSummary'],
    }),

    cancelManagerPlan: builder.mutation({
      queryFn: async (body) => {
        const result = await nodeBackendBaseQuery(
          { url: '/api/plantation-estate-manager/cancel-plan', method: 'POST', body },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['PlantationEstateManager', 'PlantationCalendarPlans'],
    }),

    getManagerCancelReasons: builder.query({
      queryFn: async () => {
        const result = await nodeBackendBaseQuery(
          { url: '/api/plantation-estate-manager/manager-cancel-reasons', method: 'GET' },
          {},
          {}
        );
        if (result.error) return result;
        return { data: result.data?.data ?? result.data ?? [] };
      },
      providesTags: ['PlantationEstateManager'],
    }),
  }),
});

export const {
  useGetPendingManagerPlansQuery,
  useGetAllManagerPlansQuery,
  useGetManagerPlanDetailQuery,
  useGetPlanEditContextQuery,
  useGetApprovePlanContextQuery,
  useSubmitPlanEditMutation,
  useGetManagerFieldRemoveReasonsQuery,
  useGetPlanCustomizationLogQuery,
  useGetWebPlanCustomizationLogQuery,
  useGetManagerPlanEditContextQuery,
  useSubmitManagerPlanEditMutation,
  useSubmitPlanApprovalMutation,
  useCancelManagerPlanMutation,
  useGetManagerCancelReasonsQuery,
} = plantationEstateManagerApi;
