import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bars } from 'react-loader-spinner';
import { baseApi } from '../../../api/services/allEndpoints';
import {
  useGetPlantationPlanRequestsListQuery,
  useGetPlantationPlanRescheduleRequestsListQuery,
} from '../../../api/services NodeJs/plantationDashboardApi';
import {
  useGetBookingCreationMissionTypesQuery,
  useGetBookingCreationCropTypesQuery,
} from '../../../api/services NodeJs/bookingCreationApi';
import { useAppDispatch } from '../../../store/hooks';
import { withCurrentWingSearch } from '../../../config/wingRouteGuard';
import { mapPlantationRowToAdhocTile } from '../plantation-plan-requests/plantationPlanRequestApproval';
import { mapRescheduleRowToTile } from '../plantation-plan-requests/plantationPlanRescheduleApproval';
import '../../../styles/requestsQueue.css';

/** YYYY-MM-01 of the current local calendar month — past months are hidden in the queue. */
const currentMonthStartYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

const isOnOrAfterMonthStart = (dateValue, monthStart) => {
  const ymd = String(dateValue || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  return ymd >= monthStart;
};

const RequestsQueueMain = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const monthStart = useMemo(() => currentMonthStartYmd(), []);

  const {
    data: plantationRows,
    isLoading: adhocLoading,
    isError: adhocQueryError,
  } = useGetPlantationPlanRequestsListQuery({ status: 'pending' });
  const { data: missionTypesRaw } = useGetBookingCreationMissionTypesQuery();
  const { data: cropTypesRaw } = useGetBookingCreationCropTypesQuery();

  const adhocData = useMemo(() => {
    const rows = Array.isArray(plantationRows) ? plantationRows : [];
    const requests = rows
      .filter((row) => isOnOrAfterMonthStart(row?.picked_date || row?.pickedDate, monthStart))
      .map((row) =>
        mapPlantationRowToAdhocTile(row, {
          missionTypes: missionTypesRaw,
          cropTypes: cropTypesRaw,
        })
      )
      .filter(Boolean);
    return { requests, request_count: requests.length };
  }, [plantationRows, missionTypesRaw, cropTypesRaw, monthStart]);

  const adhocError = adhocQueryError ? 'Failed to load ad-hoc requests' : '';

  const {
    data: rescheduleRows,
    isLoading: rescheduleLoading,
    isError: rescheduleQueryError,
  } = useGetPlantationPlanRescheduleRequestsListQuery({ status: 'pending' });

  const rescheduleData = useMemo(() => {
    const rows = Array.isArray(rescheduleRows) ? rescheduleRows : [];
    const requests = rows
      .filter((row) =>
        isOnOrAfterMonthStart(
          row?.requested_picked_date || row?.requestedPickedDate || row?.picked_date,
          monthStart
        )
      )
      .map((row) => mapRescheduleRowToTile(row))
      .filter(Boolean);
    return { requests };
  }, [rescheduleRows, monthStart]);

  const rescheduleError = rescheduleQueryError ? 'Failed to load reschedule requests' : '';

  const [nonpLoading, setNonpLoading] = useState(false);
  const [nonpData, setNonpData] = useState(null);
  const [nonpError, setNonpError] = useState('');
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    const fetchNonpData = async () => {
      setNonpLoading(true);
      setNonpError('');
      try {
        const result = await dispatch(baseApi.endpoints.getPendingNonPlantationMissions.initiate());
        const data = result.data;
        if (data && data.status === 'true') {
          const requests = data['0'] || [];
          setNonpData({ requests, count: data.count || requests.length });
        } else {
          setNonpData({ requests: [], count: 0 });
        }
      } catch (e) {
        setNonpError('Failed to load non-plantation requests');
        setNonpData({ requests: [], count: 0 });
      } finally {
        setNonpLoading(false);
      }
    };

    fetchNonpData();
  }, [dispatch]);

  const formatDates = (datesString) => {
    if (!datesString) return 'N/A';
    return datesString.split(',').map((d) => d.trim()).join(', ');
  };

  return (
    <div className="wrapper-req-queue">
      <div className="header-req-queue">
        <button
          className="back-btn-req-queue"
          onClick={() => {
            if (isNavigating) return;
            setIsNavigating(true);
            navigate({ pathname: '/home/workflowDashboard', search: routerLocation.search });
          }}
          disabled={isNavigating}
          aria-label="Back"
        >
          {isNavigating ? (
            <Bars height="16" width="16" color="#004b71" ariaLabel="bars-loading" visible={true} />
          ) : (
            <svg className="back-icon-req-queue" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path fill="currentColor" d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
            </svg>
          )}
        </button>
        <div className="center-header-req-queue">
          <div className="heading-req-queue">Requests Queue</div>
        </div>
      </div>

      <div className="columns-container-req-queue">
        {/* Column 1: Plantation Add-hoc Request Queue */}
        <div className="column-req-queue">
          <div className="column-header-req-queue">
            <h2 className="column-title-req-queue">Plantation Add-hoc Request Queue</h2>
            <span className="column-count-req-queue">Plans {adhocData?.request_count || 0} »</span>
          </div>

          <div className="requests-list-req-queue">
            {adhocLoading && (
              <div className="loading-req-queue">
                <Bars height="30" width="30" color="#003057" ariaLabel="bars-loading" visible={true} />
                <span>Loading...</span>
              </div>
            )}
            {adhocError && <div className="error-req-queue">{adhocError}</div>}
            {!adhocLoading && !adhocError && (
              <>
                {!adhocData?.requests || adhocData.requests.length === 0 ? (
                  <div className="empty-req-queue">No pending requests</div>
                ) : (
                  adhocData.requests.map((request) => (
                    <div
                      key={request.request_id}
                      className="request-tile-req-queue"
                      onClick={() =>
                        navigate(withCurrentWingSearch('/home/requestProceed', routerLocation.search), {
                          state: { requestId: request.request_id, requestType: 'adhoc' },
                        })
                      }
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="tile-header-req-queue">
                        <span className="tile-id-req-queue">Request #{request.request_id}</span>
                        <span className="tile-status-req-queue">
                          {request.status === 'p' ? 'Pending' : request.status}
                        </span>
                      </div>
                      <div className="tile-body-req-queue">
                        <div className="tile-row-req-queue">
                          <span className="tile-label-req-queue">Estate:</span>
                          <span className="tile-value-req-queue">{request.estate || 'N/A'}</span>
                        </div>
                        {request.crop && (
                          <div className="tile-row-req-queue">
                            <span className="tile-label-req-queue">Crop:</span>
                            <span className="tile-value-req-queue">{request.crop}</span>
                          </div>
                        )}
                        {request.mission_type && (
                          <div className="tile-row-req-queue">
                            <span className="tile-label-req-queue">Mission:</span>
                            <span className="tile-value-req-queue">{request.mission_type}</span>
                          </div>
                        )}
                        <div className="tile-row-req-queue">
                          <span className="tile-label-req-queue">Requested date:</span>
                          <span className="tile-value-req-queue">{formatDates(request.dates)}</span>
                        </div>
                        {request.requested_plan_count != null && request.requested_plan_count > 0 && (
                          <div className="tile-row-req-queue">
                            <span className="tile-label-req-queue">Requested plans:</span>
                            <span className="tile-value-req-queue">{request.requested_plan_count}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </>
            )}
          </div>
        </div>

        {/* Column 2: Plantation Reschedule Request Queue */}
        <div className="column-req-queue">
          <div className="column-header-req-queue">
            <h2 className="column-title-req-queue">Plantation Reschedule Request Queue</h2>
            <span className="column-count-req-queue">Plans {rescheduleData?.requests?.length || 0} »</span>
          </div>

          <div className="requests-list-req-queue">
            {rescheduleLoading && (
              <div className="loading-req-queue">
                <Bars height="30" width="30" color="#003057" ariaLabel="bars-loading" visible={true} />
                <span>Loading...</span>
              </div>
            )}
            {rescheduleError && <div className="error-req-queue">{rescheduleError}</div>}
            {!rescheduleLoading && !rescheduleError && (
              <>
                {!rescheduleData?.requests || rescheduleData.requests.length === 0 ? (
                  <div className="empty-req-queue">No pending requests</div>
                ) : (
                  rescheduleData.requests.map((request) => (
                    <div
                      key={request.request_id}
                      className="request-tile-req-queue"
                      onClick={() => {
                        navigate(withCurrentWingSearch('/home/requestProceed', routerLocation.search), {
                          state: {
                            requestId: request.request_id,
                            requestType: 'reschedule',
                          },
                        });
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="tile-header-req-queue">
                        <span className="tile-id-req-queue">Plan #{request.plan}</span>
                        <span className="tile-status-req-queue">
                          {request.status === 'p' ? 'Pending' : request.status}
                        </span>
                      </div>
                      <div className="tile-body-req-queue">
                        <div className="tile-row-req-queue">
                          <span className="tile-label-req-queue">Estate:</span>
                          <span className="tile-value-req-queue">{request.estate || 'N/A'}</span>
                        </div>
                        <div className="tile-row-req-queue">
                          <span className="tile-label-req-queue">Original date:</span>
                          <span className="tile-value-req-queue">{request.plan_date || 'N/A'}</span>
                        </div>
                        <div className="tile-row-req-queue">
                          <span className="tile-label-req-queue">Requested date:</span>
                          <span className="tile-value-req-queue">{formatDates(request.requested_dates)}</span>
                        </div>
                        {request.reason && (
                          <div className="tile-row-req-queue">
                            <span className="tile-label-req-queue">Reason:</span>
                            <span className="tile-value-req-queue">{request.reason}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </>
            )}
          </div>
        </div>

        {/* Column 3: Non-Plantation Plan Request Queue */}
        <div className="column-req-queue">
          <div className="column-header-req-queue">
            <h2 className="column-title-req-queue">Non-Plantation Plan Request Queue</h2>
            <span className="column-count-req-queue">Plans {nonpData?.count || 0} »</span>
          </div>

          <div className="requests-list-req-queue">
            {nonpLoading && (
              <div className="loading-req-queue">
                <Bars height="30" width="30" color="#003057" ariaLabel="bars-loading" visible={true} />
                <span>Loading...</span>
              </div>
            )}
            {nonpError && <div className="error-req-queue">{nonpError}</div>}
            {!nonpLoading && !nonpError && (
              <>
                {!nonpData?.requests || nonpData.requests.length === 0 ? (
                  <div className="empty-req-queue">No pending requests</div>
                ) : (
                  nonpData.requests.map((request, idx) => (
                    <div key={`${request.mission_id}-${idx}`} className="request-tile-req-queue">
                      <div className="tile-header-req-queue">
                        <span className="tile-id-req-queue">Mission #{request.mission_id}</span>
                        <span className="tile-status-req-queue">
                          {request.status === 'p' ? 'Pending' : request.status_text || request.status}
                        </span>
                      </div>
                      <div className="tile-body-req-queue">
                        <div className="tile-row-req-queue">
                          <span className="tile-label-req-queue">Farmer:</span>
                          <span className="tile-value-req-queue">{request.farmer_name || 'N/A'}</span>
                        </div>
                        <div className="tile-row-req-queue">
                          <span className="tile-label-req-queue">NIC:</span>
                          <span className="tile-value-req-queue">{request.farmer_nic || 'N/A'}</span>
                        </div>
                        <div className="tile-row-req-queue">
                          <span className="tile-label-req-queue">Location:</span>
                          <span className="tile-value-req-queue">{request.location || 'N/A'}</span>
                        </div>
                        <div className="tile-row-req-queue">
                          <span className="tile-label-req-queue">Mission Type:</span>
                          <span className="tile-value-req-queue">{request.mission_type || 'N/A'}</span>
                        </div>
                        <div className="tile-row-req-queue">
                          <span className="tile-label-req-queue">Crop:</span>
                          <span className="tile-value-req-queue">{request.crop || 'N/A'}</span>
                        </div>
                        <div className="tile-row-req-queue">
                          <span className="tile-label-req-queue">Extent:</span>
                          <span className="tile-value-req-queue">{request.extent || 'N/A'} Ha</span>
                        </div>
                        <div className="tile-row-req-queue">
                          <span className="tile-label-req-queue">Requested Date:</span>
                          <span className="tile-value-req-queue">{request.requested_date || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RequestsQueueMain;
