import React from 'react';
import '../../../styles/accidentReports.css';
import { useIncidentReportsPage } from './hooks/useIncidentReportsPage';
import PageHeader from './components/PageHeader';
import FeedbackBanner from './components/FeedbackBanner';
import FiltersPanel from './components/FiltersPanel';
import ReportsTable from './components/ReportsTable';
import DetailModal from './components/DetailModal';
import ImageViewerModal from './components/ImageViewerModal';
import ActionModal from './components/ActionModal';

const IncidentReportsPage = () => {
  const page = useIncidentReportsPage();

  if (page.isLoading && !page.reports.length) {
    return (
      <div className="accidentreports-loading-container">
        <p>Loading incident reports…</p>
      </div>
    );
  }

  return (
    <div className="accidentreports-container">
      <PageHeader
        totalCount={page.reports.length}
        filteredCount={page.filteredReports.length}
        activeFilterCount={page.activeFilterCount}
      />

      <FeedbackBanner message={page.message} messageType={page.messageType} />

      <FiltersPanel
        filters={page.filters}
        pilots={page.pilots}
        onChange={page.handleFilterChange}
        onClear={page.clearFilters}
        hasActiveFilters={page.hasActiveFilters}
        searchTerm={page.searchTerm}
        onSearchChange={page.setSearchTerm}
      />

      <ReportsTable
        reports={page.filteredReports}
        isLoading={page.isLoading}
        error={page.error}
        totalCount={page.reports.length}
        onView={page.openDetails}
        onAction={page.openAction}
      />

      {page.showDetailsModal && page.detailView ? (
        <DetailModal
          report={page.detailView}
          isLoading={page.detailLoading}
          onClose={page.closeDetails}
          onViewImage={page.openImageViewer}
          onDownload={page.handleDownload}
        />
      ) : null}

      <ImageViewerModal
        imageUrl={page.selectedImage}
        rotation={page.imageRotation}
        onClose={page.closeImageViewer}
        onRotate={page.rotateImage}
        onDownload={page.handleDownload}
      />

      {page.showActionModal && page.selectedReport ? (
        <ActionModal
          actionType={page.actionType}
          form={page.actionForm}
          technicians={page.technicians}
          onChange={page.setActionForm}
          onClose={page.closeAction}
          onSubmit={page.submitAction}
        />
      ) : null}
    </div>
  );
};

export default IncidentReportsPage;
