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
} = plantationEstateManagerApi;
