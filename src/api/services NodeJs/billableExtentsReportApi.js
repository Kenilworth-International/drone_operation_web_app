import { baseApi } from '../baseApi';
import { nodeBackendBaseQuery } from './nodeBackendConfig';

export const billableExtentsReportApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getBillableExtentsPlantations: builder.query({
      queryFn: async () => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: '/api/billable-extents-report/plantations', method: 'POST', body: {} },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || [] };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
    }),

    getBillableExtentsEstates: builder.query({
      queryFn: async (plantationId) => {
        try {
          const result = await nodeBackendBaseQuery(
            {
              url: '/api/billable-extents-report/estates',
              method: 'POST',
              body: { plantation_id: plantationId },
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
    }),

    getBillableExtentsReport: builder.query({
      queryFn: async (params = {}) => {
        try {
          const result = await nodeBackendBaseQuery(
            {
              url: '/api/billable-extents-report/report',
              method: 'POST',
              body: {
                start_date: params.start_date,
                end_date: params.end_date,
                plantation_id: params.plantation_id,
                estates: params.estates || [],
                mission_type: params.mission_type || 'all',
              },
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
  }),
});

export const {
  useGetBillableExtentsPlantationsQuery,
  useLazyGetBillableExtentsEstatesQuery,
  useLazyGetBillableExtentsReportQuery,
} = billableExtentsReportApi;
