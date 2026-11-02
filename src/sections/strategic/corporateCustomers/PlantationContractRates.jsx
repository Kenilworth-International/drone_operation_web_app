import React from 'react';
import { FaTags } from 'react-icons/fa';
import '../../../styles/corporateCustomers.css';
import PlantationBillingRatesPanel from './PlantationBillingRatesPanel';

/**
 * Contract Rates — shared spray / spread / scout catalog (no plantation list).
 */
export default function PlantationContractRates() {
  return (
    <div className="cc-page">
      <header
        className="cc-header"
        style={{
          backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.92), rgba(255, 255, 255, 0.92)), url(${process.env.PUBLIC_URL}/assets/images/cover.png)`,
        }}
      >
        <div className="cc-header-text">
          <h1 className="cc-title">
            <FaTags className="cc-title-icon" aria-hidden />
            Contract Rates
          </h1>
          <p className="cc-subtitle">
            Define spray, spread, and scout prices. On Corporate Customer, pick which rate each
            plantation uses (and from which date for mid-year changes).
          </p>
        </div>
      </header>

      <div className="cc-body cc-body--scroll">
        <div className="cc-rates-main cc-rates-main--solo">
          <PlantationBillingRatesPanel />
        </div>
      </div>
    </div>
  );
}
