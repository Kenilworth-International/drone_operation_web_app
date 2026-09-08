import { baseApi } from '../baseApi';
import { nodeBackendBaseQuery } from './nodeBackendConfig';

export const incidentEquipmentApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getIncidentEquipment: builder.query({
      queryFn: async ({ include_inactive = true } = {}) => {
        const q = include_inactive ? '?include_inactive=1' : '';
        const result = await nodeBackendBaseQuery(
          { url: `/api/incident-equipment${q}`, method: 'GET' },
          {},
          {}
        );
        if (result.error) return result;
        return { data: result.data?.data || [] };
      },
      providesTags: ['IncidentEquipment'],
    }),

    getIncidentEquipmentSubCategories: builder.query({
      queryFn: async () => {
        const result = await nodeBackendBaseQuery(
          { url: '/api/incident-equipment/sub-categories', method: 'GET' },
          {},
          {}
        );
        if (result.error) return result;
        return { data: result.data?.data || [] };
      },
      providesTags: ['IncidentEquipment'],
    }),

    createIncidentEquipment: builder.mutation({
      queryFn: async (body) => {
        const result = await nodeBackendBaseQuery(
          { url: '/api/incident-equipment', method: 'POST', body },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['IncidentEquipment'],
    }),

    updateIncidentEquipment: builder.mutation({
      queryFn: async ({ id, ...body }) => {
        const result = await nodeBackendBaseQuery(
          { url: `/api/incident-equipment/${id}`, method: 'PUT', body },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['IncidentEquipment'],
    }),
  }),
});

export const {
  useGetIncidentEquipmentQuery,
  useGetIncidentEquipmentSubCategoriesQuery,
  useCreateIncidentEquipmentMutation,
  useUpdateIncidentEquipmentMutation,
} = incidentEquipmentApi;
