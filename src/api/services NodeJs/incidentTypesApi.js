import { baseApi } from '../baseApi';
import { nodeBackendBaseQuery } from './nodeBackendConfig';

export const incidentTypesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getIncidentTypes: builder.query({
      queryFn: async ({ include_inactive = true } = {}) => {
        const q = include_inactive ? '?include_inactive=1' : '';
        const result = await nodeBackendBaseQuery(
          { url: `/api/incident-types${q}`, method: 'GET' },
          {},
          {}
        );
        if (result.error) return result;
        return { data: result.data?.data || [] };
      },
      providesTags: ['IncidentTypes'],
    }),

    createIncidentType: builder.mutation({
      queryFn: async (body) => {
        const result = await nodeBackendBaseQuery(
          { url: '/api/incident-types', method: 'POST', body },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['IncidentTypes'],
    }),

    updateIncidentType: builder.mutation({
      queryFn: async ({ id, ...body }) => {
        const result = await nodeBackendBaseQuery(
          { url: `/api/incident-types/${id}`, method: 'PUT', body },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['IncidentTypes'],
    }),
  }),
});

export const {
  useGetIncidentTypesQuery,
  useCreateIncidentTypeMutation,
  useUpdateIncidentTypeMutation,
} = incidentTypesApi;
