import { baseApi } from '../baseApi';
import { nodeBackendBaseQuery } from './nodeBackendConfig';

export const investigationWorkflowApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getInvestigationRecommendations: builder.query({
      queryFn: async (filters = {}) => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: '/api/investigation-workflow/recommendations', method: 'POST', body: filters },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || [] };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      providesTags: ['InvestigationRecommendations'],
    }),
    rejectInvestigationRecommendation: builder.mutation({
      queryFn: async ({ id, ...body }) => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: `/api/investigation-workflow/recommendations/${id}/reject`, method: 'POST', body },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || null };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['InvestigationRecommendations'],
    }),
    getHrInvestigations: builder.query({
      queryFn: async (filters = {}) => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: '/api/investigation-workflow/investigations', method: 'POST', body: filters },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || [] };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      providesTags: ['HrInvestigations'],
    }),
    createHrInvestigation: builder.mutation({
      queryFn: async (body) => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: '/api/investigation-workflow/investigations/create', method: 'POST', body },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || null };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['HrInvestigations', 'InvestigationRecommendations'],
    }),
    getWorkshopAccidentReports: builder.query({
      queryFn: async (filters = {}) => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: '/api/investigation-workflow/workshop-accident-reports', method: 'POST', body: filters },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || [] };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      providesTags: ['WorkshopAccidentReports'],
    }),
    getWorkshopAccidentReportById: builder.query({
      queryFn: async (id) => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: `/api/investigation-workflow/workshop-accident-reports/${id}`, method: 'GET' },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || null };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      providesTags: (r, e, id) => [{ type: 'WorkshopAccidentReports', id }],
    }),
    createWorkshopAccidentReport: builder.mutation({
      queryFn: async (body) => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: '/api/investigation-workflow/workshop-accident-reports/create', method: 'POST', body },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || null };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['WorkshopAccidentReports'],
    }),
    saveWorkshopAccidentReport: builder.mutation({
      queryFn: async ({ id, ...body }) => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: `/api/investigation-workflow/workshop-accident-reports/${id}`, method: 'PUT', body },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || null };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['WorkshopAccidentReports'],
    }),
    submitWorkshopAccidentReport: builder.mutation({
      queryFn: async ({ id, ...body }) => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: `/api/investigation-workflow/workshop-accident-reports/${id}/submit`, method: 'POST', body },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || null };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['WorkshopAccidentReports', 'InvestigationRecommendations'],
    }),
    createHrAccidentReport: builder.mutation({
      queryFn: async (body) => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: '/api/investigation-workflow/hr-accident-reports/create', method: 'POST', body },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || null };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['HrInvestigations'],
    }),
    getHrAccidentReportByInvestigation: builder.query({
      queryFn: async (investigationId) => {
        try {
          const result = await nodeBackendBaseQuery(
            {
              url: `/api/investigation-workflow/hr-accident-reports/by-investigation/${investigationId}`,
              method: 'GET',
            },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || null };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
    }),
    saveHrAccidentReport: builder.mutation({
      queryFn: async ({ id, ...body }) => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: `/api/investigation-workflow/hr-accident-reports/${id}`, method: 'PUT', body },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || null };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['HrInvestigations'],
    }),
    submitHrAccidentReport: builder.mutation({
      queryFn: async ({ id, ...body }) => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: `/api/investigation-workflow/hr-accident-reports/${id}/submit`, method: 'POST', body },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || null };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['HrInvestigations'],
    }),
  }),
});

export const {
  useGetInvestigationRecommendationsQuery,
  useRejectInvestigationRecommendationMutation,
  useGetHrInvestigationsQuery,
  useCreateHrInvestigationMutation,
  useGetWorkshopAccidentReportsQuery,
  useGetWorkshopAccidentReportByIdQuery,
  useCreateWorkshopAccidentReportMutation,
  useSaveWorkshopAccidentReportMutation,
  useSubmitWorkshopAccidentReportMutation,
  useCreateHrAccidentReportMutation,
  useGetHrAccidentReportByInvestigationQuery,
  useSaveHrAccidentReportMutation,
  useSubmitHrAccidentReportMutation,
} = investigationWorkflowApi;
