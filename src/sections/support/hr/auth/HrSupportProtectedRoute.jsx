import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useHrSupportAuth } from './HrSupportAuthProvider';

export default function HrSupportProtectedRoute({ children }) {
  const { isAuthenticated } = useHrSupportAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/support/hr/login" state={{ from: location }} replace />;
  }
  return children;
}
