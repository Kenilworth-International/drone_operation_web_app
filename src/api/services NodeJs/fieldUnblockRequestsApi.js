import { baseApi } from '../baseApi';
import { nodeBackendBaseQuery } from './nodeBackendConfig';

function extractRows(body) {
  if (Array.isArray(body)) return body;
  if (body?.data && Array.isArray(body.data)) return body.data;
  return [];
}

export const fieldUnblockRequestsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getFieldUnblockPendingCount: builder.query({
      queryFn: async () => {
        const result = await nodeBackendBaseQuery(
          { url: '/api/field-unblock-requests/pending-count', method: 'GET' },
          {},
          {}
        );
        if (result.error) return result;
        const count = Number(result.data?.data?.count ?? 0);
        return { data: { count } };
      },
      providesTags: ['FieldUnblockRequests'],
    }),

    getFieldUnblockRequestsList: builder.query({
      queryFn: async ({ status = 'p' } = {}) => {
        const result = await nodeBackendBaseQuery(
          {
            url: `/api/field-unblock-requests?status=${encodeURIComponent(status)}`,
            method: 'GET',
          },
          {},
          {}
        );
        if (result.error) return result;
        return { data: extractRows(result.data) };
      },
      providesTags: ['FieldUnblockRequests'],
    }),

    approveFieldUnblockRequest: builder.mutation({
      queryFn: async ({ id, reviewNote }) => {
        return nodeBackendBaseQuery(
          {
            url: `/api/field-unblock-requests/${id}/approve`,
            method: 'POST',
            body: { reviewNote: reviewNote || '' },
          },
          {},
          {}
        );
      },
      invalidatesTags: ['FieldUnblockRequests'],
    }),

    declineFieldUnblockRequest: builder.mutation({
      queryFn: async ({ id, reviewNote }) => {
        return nodeBackendBaseQuery(
          {
            url: `/api/field-unblock-requests/${id}/decline`,
            method: 'POST',
            body: { reviewNote: reviewNote || '' },
          },
          {},
          {}
        );
      },
      invalidatesTags: ['FieldUnblockRequests', 'PlantationFieldAvailability'],
    }),

    getFieldUnblockCategories: builder.query({
      queryFn: async () => {
        const result = await nodeBackendBaseQuery(
          { url: '/api/field-unblock-requests/categories', method: 'GET' },
          {},
          {}
        );
        if (result.error) return result;
        return { data: result.data?.data ?? result.data ?? [] };
      },
      providesTags: ['FieldUnblockRequests'],
    }),

    submitFieldUnblockRequest: builder.mutation({
      queryFn: async (body) => {
        const result = await nodeBackendBaseQuery(
          { url: '/api/field-unblock-requests/submit', method: 'POST', body },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['FieldUnblockRequests', 'PlantationFieldAvailability'],
    }),

    cancelFieldUnblockRequest: builder.mutation({
      queryFn: async (requestId) => {
        return nodeBackendBaseQuery(
          { url: `/api/field-unblock-requests/${requestId}/cancel`, method: 'POST', body: {} },
          {},
          {}
        );
      },
      invalidatesTags: ['FieldUnblockRequests', 'PlantationFieldAvailability'],
    }),
  }),
});

export const {
  useGetFieldUnblockPendingCountQuery,
  useGetFieldUnblockRequestsListQuery,
  useApproveFieldUnblockRequestMutation,
  useDeclineFieldUnblockRequestMutation,
  useGetFieldUnblockCategoriesQuery,
  useSubmitFieldUnblockRequestMutation,
  useCancelFieldUnblockRequestMutation,
} = fieldUnblockRequestsApi;
