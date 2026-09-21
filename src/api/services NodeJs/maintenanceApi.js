import { baseApi } from '../baseApi';
import { nodeBackendBaseQuery } from './nodeBackendConfig';

export const maintenanceApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Get all maintenance records
    getMaintenance: builder.query({
      queryFn: async (filters = {}) => {
        try {
          const result = await nodeBackendBaseQuery(
            {
              url: '/api/maintenance',
              method: 'POST',
              body: filters,
            },
            {},
            {}
          );
          if (result.error) {
            return { error: result.error };
          }
          const records = result.data?.data || result.data || [];
          return { data: records };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      providesTags: ['Maintenance'],
    }),

    // Get maintenance record by ID
    getMaintenanceById: builder.query({
      queryFn: async (id) => {
        try {
          const result = await nodeBackendBaseQuery(
            {
              url: `/api/maintenance/${id}`,
              method: 'GET',
            },
            {},
            {}
          );
          if (result.error) {
            return { error: result.error };
          }
          const record = result.data?.data || result.data || null;
          return { data: record };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      providesTags: (result, error, id) => [{ type: 'Maintenance', id }],
    }),

    // Create maintenance record
    createMaintenance: builder.mutation({
      queryFn: async (maintenanceData) => {
        try {
          const result = await nodeBackendBaseQuery(
            {
              url: '/api/maintenance/create',
              method: 'POST',
              body: maintenanceData,
            },
            {},
            {}
          );
          if (result.error) {
            return { error: result.error };
          }
          const record = result.data?.data || result.data || null;
          return { data: record };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['Maintenance'],
    }),

    // Create maintenance from accident report
    createMaintenanceFromIncident: builder.mutation({
      queryFn: async ({ incidentId, ...maintenanceData }) => {
        try {
          const result = await nodeBackendBaseQuery(
            {
              url: `/api/maintenance/from-incident/${incidentId}`,
              method: 'POST',
              body: maintenanceData,
            },
            {},
            {}
          );
          if (result.error) {
            return { error: result.error };
          }
          const record = result.data?.data || result.data || null;
          return { data: record };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['Maintenance', 'AccidentReports'],
    }),

    // Update maintenance record
    updateMaintenance: builder.mutation({
      queryFn: async ({ id, ...maintenanceData }) => {
        try {
          const result = await nodeBackendBaseQuery(
            {
              url: `/api/maintenance/${id}`,
              method: 'PUT',
              body: maintenanceData,
            },
            {},
            {}
          );
          if (result.error) {
            return { error: result.error };
          }
          const record = result.data?.data || result.data || null;
          return { data: record };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: (result, error, { id }) => [
        'Maintenance',
        { type: 'Maintenance', id },
      ],
    }),

    // Update maintenance status
    updateMaintenanceStatus: builder.mutation({
      queryFn: async ({ id, status, status_reason, completed_date, repair_notes }) => {
        try {
          const result = await nodeBackendBaseQuery(
            {
              url: `/api/maintenance/${id}/status`,
              method: 'PATCH',
              body: { status, status_reason, completed_date, repair_notes },
            },
            {},
            {}
          );
          if (result.error) {
            return { error: result.error };
          }
          const record = result.data?.data || result.data || null;
          return { data: record };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: (result, error, { id }) => [
        'Maintenance',
        { type: 'Maintenance', id },
      ],
    }),

    // Delete maintenance record
    deleteMaintenance: builder.mutation({
      queryFn: async (id) => {
        try {
          const result = await nodeBackendBaseQuery(
            {
              url: `/api/maintenance/${id}`,
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
      invalidatesTags: ['Maintenance'],
    }),

    // Get technicians
    getTechnicians: builder.query({
      queryFn: async () => {
        try {
          const result = await nodeBackendBaseQuery(
            {
              url: '/api/maintenance/technicians',
              method: 'GET',
            },
            {},
            {}
          );
          if (result.error) {
            return { error: result.error };
          }
          const technicians = result.data?.data || result.data || [];
          return { data: Array.isArray(technicians) ? technicians : [technicians] };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      providesTags: ['Technicians'],
    }),
  }),
});

export const {
  useGetMaintenanceQuery,
  useGetMaintenanceByIdQuery,
  useCreateMaintenanceMutation,
  useCreateMaintenanceFromIncidentMutation,
  useUpdateMaintenanceMutation,
  useUpdateMaintenanceStatusMutation,
  useDeleteMaintenanceMutation,
  useGetTechniciansQuery,
} = maintenanceApi;

