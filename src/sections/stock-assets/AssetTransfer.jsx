import React, { useEffect, useMemo, useState } from 'react';
import { FaPlane, FaCar, FaBolt, FaBatteryFull, FaGamepad, FaExchangeAlt, FaArrowLeft } from 'react-icons/fa';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchAssets, selectAssets } from '../../store/slices/assetsSlice';
import { baseApi } from '../../api/services/allEndpoints';
import { useGetWingsQuery } from '../../api/services/assetsApi';
import '../../styles/assetsTransfer.css';

const ASSET_TYPES = [
  { key: 'drones', label: 'Drones', icon: FaPlane },
  { key: 'vehicles', label: 'Vehicles', icon: FaCar },
  { key: 'generators', label: 'Generators', icon: FaBolt },
  { key: 'batteries', label: 'Batteries', icon: FaBatteryFull },
  { key: 'remoteControls', label: 'Remote Controls', icon: FaGamepad },
];

const AssetTransfer = ({ embedded = false }) => {
  const dispatch = useAppDispatch();
  const [selectedAssetType, setSelectedAssetType] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showWingModal, setShowWingModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [selectedWingId, setSelectedWingId] = useState(null);
  const [updating, setUpdating] = useState(false);
  const itemsPerPage = 12;

  const {
    data: wingsResponse,
    isLoading: wingsLoading,
    isError: wingsError,
    error: wingsErrorDetails,
  } = useGetWingsQuery();

  const wings = useMemo(() => {
    if (!wingsResponse) return [];
    if (Array.isArray(wingsResponse)) return wingsResponse;
    if (Array.isArray(wingsResponse?.data)) return wingsResponse.data;
    if (Array.isArray(wingsResponse?.wings)) return wingsResponse.wings;
    return [];
  }, [wingsResponse]);

  const wingIdToName = useMemo(() => {
    const map = new Map();
    wings.forEach((wing) => {
      if (wing?.id != null) {
        map.set(String(wing.id), wing.wing || '');
      }
    });
    return map;
  }, [wings]);

  const wingsErrorMessage = useMemo(() => {
    if (!wingsError) return '';
    if (typeof wingsErrorDetails === 'string') return wingsErrorDetails;
    if (wingsErrorDetails?.data?.message) return wingsErrorDetails.data.message;
    if (wingsErrorDetails?.error) return wingsErrorDetails.error;
    if (wingsErrorDetails?.message) return wingsErrorDetails.message;
    return 'Unable to load wings.';
  }, [wingsError, wingsErrorDetails]);

  const extractWingId = (asset) => {
    const candidates = [asset?.wing_id, asset?.wingId, asset?.wingID, asset?.sector_id, asset?.sectorId];
    for (const candidate of candidates) {
      if (candidate === undefined || candidate === null || candidate === '') continue;
      const parsed = Number.parseInt(candidate, 10);
      if (!Number.isNaN(parsed)) {
        return String(parsed);
      }
    }
    return '';
  };

  const resolveWingValue = (asset) =>
    asset?.wing ??
    asset?.wing_name ??
    asset?.wingName ??
    asset?.wing_title ??
    asset?.sector ??
    asset?.sector_name ??
    asset?.sectorName ??
    asset?.sector_title ??
    '';

  const formatWingDisplay = (asset) => {
    const wingText = resolveWingValue(asset);
    const trimmed = wingText ? wingText.trim() : '';
    const isNumericText = trimmed ? /^\d+$/.test(trimmed) : false;
    if (trimmed && !isNumericText) {
      return wingText;
    }
    const candidateId = extractWingId(asset) || (isNumericText ? trimmed : '');
    if (candidateId) {
      const resolved = wingIdToName.get(String(candidateId));
      if (resolved) {
        return resolved;
      }
    }
    return trimmed || 'Not Available';
  };

  // Get asset counts from Redux
  const drones = useAppSelector((state) => selectAssets(state, 'drones'));
  const vehicles = useAppSelector((state) => selectAssets(state, 'vehicles'));
  const generators = useAppSelector((state) => selectAssets(state, 'generators'));
  const batteries = useAppSelector((state) => selectAssets(state, 'batteries'));
  const remoteControls = useAppSelector((state) => selectAssets(state, 'remoteControls'));

  const assetCounts = {
    drones: drones.length,
    vehicles: vehicles.length,
    generators: generators.length,
    batteries: batteries.length,
    remoteControls: remoteControls.length,
  };

  // Fetch counts for all asset types
  useEffect(() => {
    ASSET_TYPES.forEach((type) => {
      dispatch(fetchAssets(type.key));
    });
  }, [dispatch]);

  // Fetch assets when an asset type is selected
  useEffect(() => {
    if (selectedAssetType) {
      dispatch(fetchAssets(selectedAssetType));
    }
  }, [selectedAssetType, dispatch]);

  // Get current assets based on selected type
  const getCurrentAssets = () => {
    switch (selectedAssetType) {
      case 'drones':
        return drones;
      case 'vehicles':
        return vehicles;
      case 'generators':
        return generators;
      case 'batteries':
        return batteries;
      case 'remoteControls':
        return remoteControls;
      default:
        return [];
    }
  };

  const handleTransfer = (assetType) => {
    setSelectedAssetType(assetType);
    setCurrentPage(1);
  };

  const handleBackToRegistry = () => {
    setSelectedAssetType(null);
    setCurrentPage(1);
  };

  const handleWingClick = (asset) => {
    setSelectedAsset(asset);
    const currentWingId = extractWingId(asset);
    setSelectedWingId(currentWingId || '');
    setShowWingModal(true);
  };

  const handleWingSelect = (wingId) => {
    setSelectedWingId(wingId);
  };

  const handleSaveWing = async () => {
    if (!selectedAsset || !selectedWingId) return;

    setUpdating(true);
    try {
      let mutation;
      switch (selectedAssetType) {
        case 'drones':
          mutation = baseApi.endpoints.updateAssetsSectorDrone;
          break;
        case 'vehicles':
          mutation = baseApi.endpoints.updateAssetsSectorVehicle;
          break;
        case 'generators':
          mutation = baseApi.endpoints.updateAssetsSectorGenerator;
          break;
        case 'remoteControls':
          mutation = baseApi.endpoints.updateAssetsSectorRemoteControl;
          break;
        case 'batteries':
          mutation = baseApi.endpoints.updateAssetsSectorBattery;
          break;
        default:
          return;
      }

      const result = await dispatch(
        mutation.initiate({
          id: selectedAsset.id,
          wing_id: selectedWingId,
        })
      ).unwrap();

      if (result?.status === true) {
        // Refresh assets
        dispatch(fetchAssets(selectedAssetType));
        setShowWingModal(false);
        setSelectedAsset(null);
        setSelectedWingId(null);
      }
    } catch (error) {
      console.error('Error updating wing:', error);
      const errorMessage = error?.data?.message || error?.message || 'Failed to update wing. Please try again.';
      if (error?.originalStatus === 404) {
        alert(`Endpoint not found. The backend endpoint 'update_assets_sector_${selectedAssetType}' may not be implemented yet. Please contact the backend team.`);
      } else {
        alert(errorMessage);
      }
    } finally {
      setUpdating(false);
    }
  };

  const renderTableHeader = () => {
    if (selectedAssetType === 'vehicles') {
      return (
        <tr>
          <th>Vehicle No</th>
          <th>Make</th>
          <th>Model</th>
          <th>Wing</th>
        </tr>
      );
    }
    return (
      <tr>
        <th>Tag</th>
        <th>Model</th>
        <th>Make</th>
        <th>Wing</th>
      </tr>
    );
  };

  const renderTableRow = (asset) => {
    if (selectedAssetType === 'vehicles') {
      return (
        <tr key={asset.id}>
          <td>{asset.vehicle_no || asset.vehicleNo || '-'}</td>
          <td>{asset.make || '-'}</td>
          <td>{asset.model || '-'}</td>
          <td>
            <button
              type="button"
              className="sector-button"
              onClick={() => handleWingClick(asset)}
            >
              {formatWingDisplay(asset)}
            </button>
          </td>
        </tr>
      );
    }
    return (
      <tr key={asset.id}>
        <td>{asset.tag || asset.equipment_tag || '-'}</td>
        <td>{asset.model || '-'}</td>
        <td>{asset.make || '-'}</td>
        <td>
          <button
            type="button"
            className="sector-button"
            onClick={() => handleWingClick(asset)}
          >
            {formatWingDisplay(asset)}
          </button>
        </td>
      </tr>
    );
  };

  // Pagination logic for cards
  const totalPages = Math.ceil(ASSET_TYPES.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const displayedTypes = ASSET_TYPES.slice(startIndex, startIndex + itemsPerPage);

  // If showing list view
  if (selectedAssetType) {
    const assets = getCurrentAssets();
    const assetTypeLabel = ASSET_TYPES.find((t) => t.key === selectedAssetType)?.label;

    return (
      <div className={`assets-transfer-container${embedded ? ' assets-transfer-container--embedded' : ''} admin-stock-body`}>
        <div className="assets-transfer-header">
          <button type="button" className="back-button admin-stock-btn" onClick={handleBackToRegistry}>
            <FaArrowLeft /> Back to Registry
          </button>
          <h3>Transfer {assetTypeLabel}</h3>
        </div>

        <div className="assets-transfer-table-container admin-stock-table-wrap">
          <table className="assets-transfer-table admin-stock-table">
            <thead>{renderTableHeader()}</thead>
            <tbody>
              {assets.length === 0 ? (
                <tr>
                  <td colSpan="4" className="no-data">
                    No {assetTypeLabel.toLowerCase()} found
                  </td>
                </tr>
              ) : (
                assets.map((asset) => renderTableRow(asset))
              )}
            </tbody>
          </table>
        </div>

        {/* Wing Selection Modal */}
        {showWingModal && (
          <div className="sector-modal-overlay" onClick={() => {
            setShowWingModal(false);
            setSelectedWingId(null);
          }}>
            <div className="sector-modal" onClick={(e) => e.stopPropagation()}>
              <div className="sector-modal-header">
                <h3>Select Wing</h3>
                <button
                  type="button"
                  className="close-button"
                  onClick={() => {
                    setShowWingModal(false);
                    setSelectedWingId(null);
                  }}
                >
                  ×
                </button>
              </div>
              <div className="sector-modal-content">
                {wingsLoading ? (
                  <div className="loading">Loading wings...</div>
                ) : wingsError ? (
                  <div className="loading error">{wingsErrorMessage}</div>
                ) : (
                  <div className="sector-list">
                    {wings.map((wing) => (
                      <button
                        key={wing.id}
                        type="button"
                        className={`sector-option ${selectedWingId === String(wing.id) ? 'selected' : ''}`}
                        onClick={() => handleWingSelect(String(wing.id))}
                      >
                        {wing.wing}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="sector-modal-footer">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => {
                    setShowWingModal(false);
                    setSelectedWingId(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="save-button"
                  onClick={handleSaveWing}
                  disabled={!selectedWingId || updating}
                >
                  {updating ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Card view
  return (
    <div className={`assets-transfer-container${embedded ? ' assets-transfer-container--embedded' : ''} admin-stock-body`}>
      <div className="assets-transfer-grid">
        {displayedTypes.map((type) => {
          const Icon = type.icon;
          const count = assetCounts[type.key] || 0;

          return (
            <div key={type.key} className="asset-transfer-card">
              <div className="asset-icon-wrapper">
                <Icon className="asset-icon" />
              </div>
              <div className="asset-info">
                <div className="asset-name">{type.label}</div>
                <div className="asset-count">Count: {count}</div>
              </div>
              <div className="transfer-button-container">
                <button
                  type="button"
                  className="transfer-button admin-stock-btn admin-stock-btn--primary"
                  onClick={() => handleTransfer(type.key)}
                >
                  <FaExchangeAlt className="transfer-icon" />
                  Transfer
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button
            type="button"
            className="pagination-button"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </button>
          <span className="pagination-info">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            className="pagination-button"
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default AssetTransfer;

