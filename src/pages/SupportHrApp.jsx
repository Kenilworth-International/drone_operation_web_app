import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { HrSupportAuthProvider } from '../sections/support/hr/auth/HrSupportAuthProvider';
import HrSupportLogin from '../sections/support/hr/auth/HrSupportLogin';
import HrSupportProtectedRoute from '../sections/support/hr/auth/HrSupportProtectedRoute';
import SupportHrRouter from './SupportHrRouter';
import '../styles/hrSupportShell.css';

/**
 * Self-contained HR Support portal mounted at /support/hr/*
 * Owns its own HrSupportAuthProvider — completely isolated from the main DSMS auth.
 */
export default function SupportHrApp() {
  return (
    <div className="hrsup-app-root">
    <HrSupportAuthProvider>
      <Routes>
        <Route path="login" element={<HrSupportLogin />} />
        <Route index element={<Navigate to="home" replace />} />
        <Route
          path="*"
          element={
            <HrSupportProtectedRoute>
              <SupportHrRouter />
            </HrSupportProtectedRoute>
          }
        />
      </Routes>
    </HrSupportAuthProvider>
    </div>
  );
}
