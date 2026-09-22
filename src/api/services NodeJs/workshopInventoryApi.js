import { baseApi } from '../baseApi';
import { nodeBackendBaseQuery } from './nodeBackendConfig';

export const workshopInventoryApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getWorkshopInventory: builder.query({
      queryFn: async (filters = {}) => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: '/api/workshop-inventory', method: 'POST', body: filters },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || [] };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      providesTags: ['WorkshopInventory'],
    }),
    createWorkshopInventory: builder.mutation({
      queryFn: async (body) => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: '/api/workshop-inventory/create', method: 'POST', body },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || null };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['WorkshopInventory', 'Maintenance'],
    }),
    receiveWorkshopInventory: builder.mutation({
      queryFn: async ({ id, ...body }) => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: `/api/workshop-inventory/${id}/receive`, method: 'POST', body },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || null };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['WorkshopInventory', 'Maintenance'],
    }),
    receiveByMaintenance: builder.mutation({
      queryFn: async ({ maintenanceId, ...body }) => {
        try {
          const result = await nodeBackendBaseQuery(
            {
              url: `/api/workshop-inventory/receive-by-maintenance/${maintenanceId}`,
              method: 'POST',
              body,
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
      invalidatesTags: ['WorkshopInventory', 'Maintenance'],
    }),
    updateWorkshopInventory: builder.mutation({
      queryFn: async ({ id, ...body }) => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: `/api/workshop-inventory/${id}`, method: 'PUT', body },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || null };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['WorkshopInventory'],
    }),
  }),
});

export const {
  useGetWorkshopInventoryQuery,
  useCreateWorkshopInventoryMutation,
  useReceiveWorkshopInventoryMutation,
  useReceiveByMaintenanceMutation,
  useUpdateWorkshopInventoryMutation,
} = workshopInventoryApi;
