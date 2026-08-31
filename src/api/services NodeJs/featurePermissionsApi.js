import { baseApi } from '../baseApi';
import { nodeBackendBaseQuery } from './nodeBackendConfig';

export const featurePermissionsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Get all feature permissions
    getFeaturePermissions: builder.query({
      queryFn: async (filters = {}) => {
        try {
          const queryParams = new URLSearchParams(filters).toString();
          const result = await nodeBackendBaseQuery(
            {
              url: `/api/feature-permissions?${queryParams}`,
              method: 'GET',
            },
            {},
            {}
          );
          if (result.error) {
            return { error: result.error };
          }
          const permissions = result.data?.data || result.data || [];
          return { data: permissions };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      providesTags: ['FeaturePermissions'],
    }),

    // Get permissions grouped by category and job role
    getGroupedPermissions: builder.query({
      queryFn: async () => {
        try {
          const result = await nodeBackendBaseQuery(
            {
              url: '/api/feature-permissions/grouped',
              method: 'GET',
            },
            {},
            {}
          );
          if (result.error) {
            return { error: result.error };
          }
          const grouped = result.data?.data || result.data || {};
          return { data: grouped };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      providesTags: ['FeaturePermissions'],
    }),

    // Get permissions for current user
    // Returns: { categories: { category: [featureCodes] }, paths: { path: true/false } }
    getMyPermissions: builder.query({
      queryFn: async (_arg, api, _extraOptions) => {
        try {
          const result = await nodeBackendBaseQuery(
            {
              url: '/api/feature-permissions/my-permissions',
              method: 'GET',
            },
            api,
            _extraOptions
          );
          if (result.error) {
            return { error: result.error };
          }
          // Backend returns: { status: true, data: { categories: {...}, paths: {...} } }
          const permissions = result.data?.data || result.data || { categories: {}, paths: {} };
          return { data: permissions };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      providesTags: ['MyPermissions'],
    }),

    // Get all feature definitions
    getFeatureDefinitions: builder.query({
      queryFn: async (filters = {}) => {
        try {
          const queryParams = new URLSearchParams(filters).toString();
          const result = await nodeBackendBaseQuery(
            {
              url: `/api/feature-permissions/definitions?${queryParams}`,
              method: 'GET',
            },
            {},
            {}
          );
          if (result.error) {
            return { error: result.error };
          }
          // Backend returns: { status: true, data: [...] }
          const definitions = result.data?.data || result.data || [];
          return { data: definitions };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      providesTags: ['FeatureDefinitions'],
    }),

    // Get all job roles
    getJobRoles: builder.query({
      queryFn: async () => {
        try {
          const result = await nodeBackendBaseQuery(
            {
              url: '/api/feature-permissions/job-roles',
              method: 'GET',
            },
            {},
            {}
          );
          if (result.error) {
            return { error: result.error };
          }
          const jobRoles = result.data?.data || result.data || [];
          return { data: jobRoles };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      providesTags: ['JobRoles'],
    }),

    // Create or update feature permission
    upsertFeaturePermission: builder.mutation({
      queryFn: async (data) => {
        try {
          const result = await nodeBackendBaseQuery(
            {
              url: '/api/feature-permissions',
              method: 'POST',
              body: data,
            },
            {},
            {}
          );
          if (result.error) {
            return { error: result.error };
          }
          const permission = result.data?.data || result.data || null;
          return { data: permission };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['FeaturePermissions', 'GroupedPermissions', 'MyPermissions'],
    }),

    // Bulk update permissions for a category
    bulkUpdateCategoryPermissions: builder.mutation({
      queryFn: async ({ category, permissions }) => {
        try {
          const result = await nodeBackendBaseQuery(
            {
              url: '/api/feature-permissions/bulk-update',
              method: 'POST',
              body: { category, permissions },
            },
            {},
            {}
          );
          if (result.error) {
            return { error: result.error };
          }
          return { data: result.data };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['FeaturePermissions', 'GroupedPermissions', 'MyPermissions'],
    }),

    // Sync navbar paths (deactivate orphan paths removed from config)
    syncNavbarPaths: builder.mutation({
      queryFn: async (paths) => {
        try {
          const result = await nodeBackendBaseQuery(
            {
              url: '/api/feature-permissions/sync-navbar-paths',
              method: 'POST',
              body: { paths },
            },
            {},
            {}
          );
          if (result.error) {
            return { error: result.error };
          }
          return { data: result.data };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['FeaturePermissions', 'FeatureDefinitions', 'GroupedPermissions', 'MyPermissions'],
    }),

    // Delete feature permission
    deleteFeaturePermission: builder.mutation({
      queryFn: async (id) => {
        try {
          const result = await nodeBackendBaseQuery(
            {
              url: `/api/feature-permissions/${id}`,
              method: 'DELETE',
            },
            {},
            {}
          );
          if (result.error) {
            return { error: result.error };
          }
          return { data: { id } };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['FeaturePermissions', 'GroupedPermissions'],
    }),

    getFeatureEligibleUsers: builder.query({
      queryFn: async (featureCode) => {
        try {
          const result = await nodeBackendBaseQuery(
            {
              url: `/api/feature-permissions/features/${encodeURIComponent(featureCode)}/eligible-users`,
              method: 'GET',
            },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || result.data || { users: [] } };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      providesTags: (result, error, featureCode) => [
        { type: 'FeatureEligibleUsers', id: featureCode },
      ],
    }),

    getUserFeaturePermissions: builder.query({
      queryFn: async (featureCode) => {
        try {
          const result = await nodeBackendBaseQuery(
            {
              url: `/api/feature-permissions/user-features?feature_code=${encodeURIComponent(featureCode)}`,
              method: 'GET',
            },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || result.data || [] };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      providesTags: (result, error, featureCode) => [
        { type: 'UserFeaturePermissions', id: featureCode },
      ],
    }),

    upsertUserFeaturePermission: builder.mutation({
      queryFn: async (body) => {
        try {
          const result = await nodeBackendBaseQuery(
            {
              url: '/api/feature-permissions/user-features',
              method: 'POST',
              body,
            },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || result.data };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: (result, error, arg) => [
        { type: 'UserFeaturePermissions', id: arg?.feature_code },
        'MyPermissions',
      ],
    }),

    updateFeatureDefinition: builder.mutation({
      queryFn: async ({ featureCode, ...body }) => {
        try {
          const result = await nodeBackendBaseQuery(
            {
              url: `/api/feature-permissions/definitions/${encodeURIComponent(featureCode)}`,
              method: 'PATCH',
              body,
            },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || result.data };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['FeatureDefinitions', 'FeatureEligibleUsers', 'MyPermissions'],
    }),
  }),
});

export const {
  useGetFeaturePermissionsQuery,
  useGetGroupedPermissionsQuery,
  useGetMyPermissionsQuery,
  useGetFeatureDefinitionsQuery,
  useGetJobRolesQuery,
  useUpsertFeaturePermissionMutation,
  useBulkUpdateCategoryPermissionsMutation,
  useSyncNavbarPathsMutation,
  useDeleteFeaturePermissionMutation,
  useGetFeatureEligibleUsersQuery,
  useLazyGetFeatureEligibleUsersQuery,
  useGetUserFeaturePermissionsQuery,
  useLazyGetUserFeaturePermissionsQuery,
  useUpsertUserFeaturePermissionMutation,
  useUpdateFeatureDefinitionMutation,
} = featurePermissionsApi;

