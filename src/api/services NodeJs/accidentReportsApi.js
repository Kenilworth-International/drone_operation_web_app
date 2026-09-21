import { baseApi } from '../baseApi';
import { nodeBackendBaseQuery } from './nodeBackendConfig';

export const accidentReportsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Get all accident reports
    getAccidentReports: builder.query({
      queryFn: async (filters = {}) => {
        try {
          const result = await nodeBackendBaseQuery(
            {
              url: '/api/accident-reports',
              method: 'POST',
              body: filters,
            },
            {},
            {}
          );
          if (result.error) {
            return { error: result.error };
          }
          const reports = result.data?.data || result.data || [];
          return { data: reports };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      providesTags: ['AccidentReports'],
    }),

    // Get accident report by ID
    getAccidentReportById: builder.query({
      queryFn: async (id) => {
        try {
          const result = await nodeBackendBaseQuery(
            {
              url: `/api/accident-reports/${id}`,
              method: 'GET',
            },
            {},
            {}
          );
          if (result.error) {
            return { error: result.error };
          }
          const report = result.data?.data || result.data || null;
          return { data: report };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      providesTags: (result, error, id) => [{ type: 'AccidentReport', id }],
    }),

    // Create accident report
    createAccidentReport: builder.mutation({
      queryFn: async (reportData) => {
        try {
          const result = await nodeBackendBaseQuery(
            {
              url: '/api/accident-reports/create',
              method: 'POST',
              body: reportData,
            },
            {},
            {}
          );
          if (result.error) {
            return { error: result.error };
          }
          const report = result.data?.data || result.data || null;
          return { data: report };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['AccidentReports'],
    }),

    // Update accident report
    updateAccidentReport: builder.mutation({
      queryFn: async ({ id, ...reportData }) => {
        try {
          const result = await nodeBackendBaseQuery(
            {
              url: `/api/accident-reports/${id}`,
              method: 'PUT',
              body: reportData,
            },
            {},
            {}
          );
          if (result.error) {
            return { error: result.error };
          }
          const report = result.data?.data || result.data || null;
          return { data: report };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: (result, error, { id }) => [
        'AccidentReports',
        { type: 'AccidentReport', id },
      ],
    }),

    // Delete accident report
    deleteAccidentReport: builder.mutation({
      queryFn: async (id) => {
        try {
          const result = await nodeBackendBaseQuery(
            {
              url: `/api/accident-reports/${id}`,
              method: 'DELETE',
            },
            {},
            {}
          );
          if (result.error) {
            return { error: result.error };
          }
          return { data: { success: true } };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['AccidentReports'],
    }),

    // Decline accident report
    declineAccidentReport: builder.mutation({
      queryFn: async ({ id, decline_reason, action_by }) => {
        try {
          const result = await nodeBackendBaseQuery(
            {
              url: `/api/accident-reports/${id}/decline`,
              method: 'POST',
              body: { decline_reason, action_by },
            },
            {},
            {}
          );
          if (result.error) {
            return { error: result.error };
          }
          const report = result.data?.data || result.data || null;
          return { data: report };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['AccidentReports'],
    }),

    startInvestigation: builder.mutation({
      queryFn: async ({ id, action_by, notes }) => {
        try {
          const result = await nodeBackendBaseQuery(
            {
              url: `/api/accident-reports/${id}/start-investigation`,
              method: 'POST',
              body: { action_by, notes },
            },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || result.data || null };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['AccidentReports'],
    }),

    updateInvestigationNotes: builder.mutation({
      queryFn: async ({ id, notes }) => {
        try {
          const result = await nodeBackendBaseQuery(
            {
              url: `/api/accident-reports/${id}/investigation-notes`,
              method: 'POST',
              body: { notes },
            },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || result.data || null };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['AccidentReports'],
    }),

    submitInvestigationReview: builder.mutation({
      queryFn: async ({ id, action_by }) => {
        try {
          const result = await nodeBackendBaseQuery(
            {
              url: `/api/accident-reports/${id}/submit-investigation-review`,
              method: 'POST',
              body: { action_by },
            },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || result.data || null };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['AccidentReports'],
    }),

    completeInvestigation: builder.mutation({
      queryFn: async ({ id, action_by, findings }) => {
        try {
          const result = await nodeBackendBaseQuery(
            {
              url: `/api/accident-reports/${id}/complete-investigation`,
              method: 'POST',
              body: { action_by, findings },
            },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || result.data || null };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['AccidentReports'],
    }),

    approveAccidentReport: builder.mutation({
      queryFn: async ({ id, ...body }) => {
        try {
          const result = await nodeBackendBaseQuery(
            {
              url: `/api/accident-reports/${id}/approve`,
              method: 'POST',
              body,
            },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || result.data || null };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['AccidentReports', 'Maintenance'],
    }),

    // Get pilots for filter dropdown
    getPilots: builder.query({
      queryFn: async () => {
        try {
          const result = await nodeBackendBaseQuery(
            {
              url: '/api/pilot-assignment/pilots',
              method: 'POST',
              body: {},
            },
            {},
            {}
          );
          if (result.error) {
            return { error: result.error };
          }
          const pilots = result.data?.data || result.data || [];
          return { data: pilots };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      providesTags: ['Pilots'],
    }),
  }),
});

export const {
  useGetAccidentReportsQuery,
  useGetAccidentReportByIdQuery,
  useCreateAccidentReportMutation,
  useUpdateAccidentReportMutation,
  useDeleteAccidentReportMutation,
  useDeclineAccidentReportMutation,
  useStartInvestigationMutation,
  useUpdateInvestigationNotesMutation,
  useSubmitInvestigationReviewMutation,
  useCompleteInvestigationMutation,
  useApproveAccidentReportMutation,
  useGetPilotsQuery,
} = accidentReportsApi;

