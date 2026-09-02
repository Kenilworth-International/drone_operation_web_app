import { baseApi } from '../baseApi';
import { nodeBackendBaseQuery, getNodeBackendUrl, getToken } from './nodeBackendConfig';

export const mappingHierarchyApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // =====================================================
    // DASHBOARD
    // =====================================================
    getMappingDashboardStats: builder.query({
      queryFn: async () => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/mapping-hierarchy/dashboard-stats',
            method: 'POST',
            body: {},
          },
          {},
          {}
        );
        return result;
      },
      providesTags: ['MappingDashboard'],
    }),

    // =====================================================
    // GROUPS
    // =====================================================
    getMappingGroups: builder.query({
      queryFn: async (filters = {}) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/mapping-hierarchy/groups',
            method: 'POST',
            body: filters,
          },
          {},
          {}
        );
        return result;
      },
      providesTags: ['Groups'],
    }),

    getMappingGroup: builder.query({
      queryFn: async (id) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/mapping-hierarchy/groups/view',
            method: 'POST',
            body: { id },
          },
          {},
          {}
        );
        return result;
      },
      providesTags: (result, error, id) => [{ type: 'Groups', id }],
    }),

    createMappingGroup: builder.mutation({
      queryFn: async (data) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/mapping-hierarchy/groups/create',
            method: 'POST',
            body: data,
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['Groups'],
    }),

    updateMappingGroup: builder.mutation({
      queryFn: async (data) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/mapping-hierarchy/groups/update',
            method: 'POST',
            body: data,
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: (result, error, data) => [
        { type: 'Groups', id: data?.id },
        'Groups'
      ],
    }),

    deleteMappingGroup: builder.mutation({
      queryFn: async (id) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/mapping-hierarchy/groups/delete',
            method: 'POST',
            body: { id },
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['Groups'],
    }),

    // =====================================================
    // PLANTATIONS
    // =====================================================
    getMappingPlantations: builder.query({
      queryFn: async (filters = {}) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/mapping-hierarchy/plantations',
            method: 'POST',
            body: filters,
          },
          {},
          {}
        );
        return result;
      },
      providesTags: ['Plantations'],
    }),

    getMappingPlantation: builder.query({
      queryFn: async (id) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/mapping-hierarchy/plantations/view',
            method: 'POST',
            body: { id },
          },
          {},
          {}
        );
        return result;
      },
      providesTags: (result, error, id) => [{ type: 'Plantations', id }],
    }),

    getMappingPlantationsByGroup: builder.query({
      queryFn: async (groupId) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/mapping-hierarchy/plantations/by-group',
            method: 'POST',
            body: { groupId },
          },
          {},
          {}
        );
        return result;
      },
      providesTags: ['Plantations'],
    }),

    createMappingPlantation: builder.mutation({
      queryFn: async (data) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/mapping-hierarchy/plantations/create',
            method: 'POST',
            body: data,
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['Plantations'],
    }),

    updateMappingPlantation: builder.mutation({
      queryFn: async (data) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/mapping-hierarchy/plantations/update',
            method: 'POST',
            body: data,
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: (result, error, data) => [
        { type: 'Plantations', id: data?.id },
        'Plantations'
      ],
    }),

    deleteMappingPlantation: builder.mutation({
      queryFn: async (id) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/mapping-hierarchy/plantations/delete',
            method: 'POST',
            body: { id },
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['Plantations'],
    }),

    // =====================================================
    // REGIONS
    // =====================================================
    getMappingRegions: builder.query({
      queryFn: async (filters = {}) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/mapping-hierarchy/regions',
            method: 'POST',
            body: filters,
          },
          {},
          {}
        );
        return result;
      },
      providesTags: ['Regions'],
    }),

    getMappingRegionsByPlantation: builder.query({
      queryFn: async (plantationId) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/mapping-hierarchy/regions/by-plantation',
            method: 'POST',
            body: { plantationId },
          },
          {},
          {}
        );
        return result;
      },
      providesTags: ['Regions'],
    }),

    createMappingRegion: builder.mutation({
      queryFn: async (data) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/mapping-hierarchy/regions/create',
            method: 'POST',
            body: data,
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['Regions'],
    }),

    updateMappingRegion: builder.mutation({
      queryFn: async (data) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/mapping-hierarchy/regions/update',
            method: 'POST',
            body: data,
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: (result, error, data) => [
        { type: 'Regions', id: data?.id },
        'Regions'
      ],
    }),

    deleteMappingRegion: builder.mutation({
      queryFn: async (id) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/mapping-hierarchy/regions/delete',
            method: 'POST',
            body: { id },
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['Regions'],
    }),

    // =====================================================
    // ESTATES
    // =====================================================
    getMappingEstates: builder.query({
      queryFn: async (filters = {}) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/mapping-hierarchy/estates',
            method: 'POST',
            body: filters,
          },
          {},
          {}
        );
        return result;
      },
      providesTags: ['Estates'],
    }),

    getMappingEstatesByRegion: builder.query({
      queryFn: async (regionId) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/mapping-hierarchy/estates/by-region',
            method: 'POST',
            body: { regionId },
          },
          {},
          {}
        );
        return result;
      },
      providesTags: ['Estates'],
    }),

    createMappingEstate: builder.mutation({
      queryFn: async (data) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/mapping-hierarchy/estates/create',
            method: 'POST',
            body: data,
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['Estates'],
    }),

    updateMappingEstate: builder.mutation({
      queryFn: async (data) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/mapping-hierarchy/estates/update',
            method: 'POST',
            body: data,
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: (result, error, data) => [
        { type: 'Estates', id: data?.id },
        'Estates'
      ],
    }),

    deleteMappingEstate: builder.mutation({
      queryFn: async (id) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/mapping-hierarchy/estates/delete',
            method: 'POST',
            body: { id },
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['Estates'],
    }),

    // =====================================================
    // DIVISIONS
    // =====================================================
    getMappingDivisions: builder.query({
      queryFn: async (filters = {}) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/mapping-hierarchy/divisions',
            method: 'POST',
            body: filters,
          },
          {},
          {}
        );
        return result;
      },
      providesTags: ['Divisions'],
    }),

    getMappingDivisionsByEstate: builder.query({
      queryFn: async (estateId) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/mapping-hierarchy/divisions/by-estate',
            method: 'POST',
            body: { estateId },
          },
          {},
          {}
        );
        return result;
      },
      providesTags: ['Divisions'],
    }),

    createMappingDivision: builder.mutation({
      queryFn: async (data) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/mapping-hierarchy/divisions/create',
            method: 'POST',
            body: data,
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['Divisions'],
    }),

    updateMappingDivision: builder.mutation({
      queryFn: async (data) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/mapping-hierarchy/divisions/update',
            method: 'POST',
            body: data,
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: (result, error, data) => [
        { type: 'Divisions', id: data?.id },
        'Divisions'
      ],
    }),

    deleteMappingDivision: builder.mutation({
      queryFn: async (id) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/mapping-hierarchy/divisions/delete',
            method: 'POST',
            body: { id },
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['Divisions'],
    }),

    // =====================================================
    // FIELDS
    // =====================================================
    getMappingFields: builder.query({
      queryFn: async (filters = {}) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/mapping-hierarchy/fields',
            method: 'POST',
            body: filters,
          },
          {},
          {}
        );
        return result;
      },
      providesTags: ['Fields'],
    }),

    getMappingAllFieldsReport: builder.query({
      queryFn: async () => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/mapping-hierarchy/fields/all-report',
            method: 'POST',
            body: {},
          },
          {},
          {}
        );
        return result;
      },
      providesTags: ['Fields'],
    }),

    getMappingFieldsByDivision: builder.query({
      queryFn: async (divisionId) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/mapping-hierarchy/fields/by-division',
            method: 'POST',
            body: { divisionId },
          },
          {},
          {}
        );
        return result;
      },
      providesTags: ['Fields'],
    }),

    getMappingFieldsByDivisionAll: builder.query({
      queryFn: async (divisionId) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/mapping-hierarchy/fields/by-division',
            method: 'POST',
            body: { divisionId, includeInactive: true },
          },
          {},
          {}
        );
        return result;
      },
      providesTags: ['Fields'],
    }),

    searchMappingFields: builder.query({
      queryFn: async (searchTerm) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/mapping-hierarchy/fields/search',
            method: 'POST',
            body: { searchTerm },
          },
          {},
          {}
        );
        return result;
      },
      providesTags: ['Fields'],
    }),

    createMappingField: builder.mutation({
      queryFn: async (data) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/mapping-hierarchy/fields/create',
            method: 'POST',
            body: data,
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['Fields'],
    }),

    updateMappingField: builder.mutation({
      queryFn: async (data) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/mapping-hierarchy/fields/update',
            method: 'POST',
            body: data,
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: (result, error, data) => [
        { type: 'Fields', id: data?.id },
        'Fields'
      ],
    }),

    deleteMappingField: builder.mutation({
      queryFn: async (id) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/mapping-hierarchy/fields/delete',
            method: 'POST',
            body: { id },
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['Fields'],
    }),

    // =====================================================
    // MISSION PARTIAL REASONS
    // =====================================================
    getMappingMissionPartialReasons: builder.query({
      queryFn: async (filters = {}) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/mapping-hierarchy/mission-partial-reasons',
            method: 'POST',
            body: filters,
          },
          {},
          {}
        );
        return result;
      },
      providesTags: ['MissionPartialReasons'],
    }),

    getMappingMissionPartialReason: builder.query({
      queryFn: async (id) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/mapping-hierarchy/mission-partial-reasons/view',
            method: 'POST',
            body: { id },
          },
          {},
          {}
        );
        return result;
      },
      providesTags: (result, error, id) => [{ type: 'MissionPartialReasons', id }],
    }),

    // Toggle Activation Mutations
    toggleMappingGroupActivation: builder.mutation({
      queryFn: async (id) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/mapping-hierarchy/groups/toggle-activation',
            method: 'POST',
            body: { id },
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['Groups'],
    }),

    toggleMappingPlantationActivation: builder.mutation({
      queryFn: async (id) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/mapping-hierarchy/plantations/toggle-activation',
            method: 'POST',
            body: { id },
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['Plantations'],
    }),

    toggleMappingRegionActivation: builder.mutation({
      queryFn: async (id) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/mapping-hierarchy/regions/toggle-activation',
            method: 'POST',
            body: { id },
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['Regions'],
    }),

    toggleMappingEstateActivation: builder.mutation({
      queryFn: async (id) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/mapping-hierarchy/estates/toggle-activation',
            method: 'POST',
            body: { id },
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['Estates'],
    }),

    setMappingEstateFinalized: builder.mutation({
      queryFn: async ({ id, finalized }) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/mapping-hierarchy/estates/set-finalized',
            method: 'POST',
            body: { id, finalized: finalized ? 1 : 0 },
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['Estates'],
    }),

    setMappingEstatePlanSizes: builder.mutation({
      queryFn: async ({ id, min_plan_size, max_plan_size }) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/mapping-hierarchy/estates/set-plan-sizes',
            method: 'POST',
            body: { id, min_plan_size, max_plan_size },
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['Estates'],
    }),

    setMappingHierarchyMapImage: builder.mutation({
      queryFn: async ({ level, id, map_image }) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/mapping-hierarchy/set-map-image',
            method: 'POST',
            body: { level, id, map_image },
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: (result, error, { level }) => {
        const tagByLevel = {
          group: ['Groups'],
          plantation: ['Plantations'],
          region: ['Regions'],
          estate: ['Estates'],
          division: ['Divisions'],
        };
        return tagByLevel[level] || [];
      },
    }),

    toggleMappingDivisionActivation: builder.mutation({
      queryFn: async (id) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/mapping-hierarchy/divisions/toggle-activation',
            method: 'POST',
            body: { id },
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['Divisions'],
    }),

    toggleMappingFieldActivation: builder.mutation({
      queryFn: async (id) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/mapping-hierarchy/fields/toggle-activation',
            method: 'POST',
            body: { id },
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['Fields'],
    }),

  }),
});

// Export hooks for usage in functional components
export const {
  // Dashboard
  useGetMappingDashboardStatsQuery,
  // Groups
  useGetMappingGroupsQuery,
  useGetMappingGroupQuery,
  useCreateMappingGroupMutation,
  useUpdateMappingGroupMutation,
  useDeleteMappingGroupMutation,
  useToggleMappingGroupActivationMutation,
  // Plantations
  useGetMappingPlantationsQuery,
  useGetMappingPlantationQuery,
  useGetMappingPlantationsByGroupQuery,
  useCreateMappingPlantationMutation,
  useUpdateMappingPlantationMutation,
  useDeleteMappingPlantationMutation,
  useToggleMappingPlantationActivationMutation,
  // Regions
  useGetMappingRegionsQuery,
  useGetMappingRegionsByPlantationQuery,
  useCreateMappingRegionMutation,
  useUpdateMappingRegionMutation,
  useDeleteMappingRegionMutation,
  useToggleMappingRegionActivationMutation,
  // Estates
  useGetMappingEstatesQuery,
  useGetMappingEstatesByRegionQuery,
  useCreateMappingEstateMutation,
  useUpdateMappingEstateMutation,
  useDeleteMappingEstateMutation,
  useToggleMappingEstateActivationMutation,
  useSetMappingEstateFinalizedMutation,
  useSetMappingEstatePlanSizesMutation,
  useSetMappingHierarchyMapImageMutation,
  // Divisions
  useGetMappingDivisionsQuery,
  useGetMappingDivisionsByEstateQuery,
  useCreateMappingDivisionMutation,
  useUpdateMappingDivisionMutation,
  useDeleteMappingDivisionMutation,
  useToggleMappingDivisionActivationMutation,
  // Fields
  useGetMappingFieldsQuery,
  useGetMappingAllFieldsReportQuery,
  useLazyGetMappingAllFieldsReportQuery,
  useGetMappingFieldsByDivisionQuery,
  useGetMappingFieldsByDivisionAllQuery,
  useSearchMappingFieldsQuery,
  useCreateMappingFieldMutation,
  useUpdateMappingFieldMutation,
  useDeleteMappingFieldMutation,
  useToggleMappingFieldActivationMutation,
  // Mission Partial Reasons
  useGetMappingMissionPartialReasonsQuery,
  useGetMappingMissionPartialReasonQuery,
} = mappingHierarchyApi;
