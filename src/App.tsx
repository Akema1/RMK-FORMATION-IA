/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import LoadingSpinner from './components/LoadingSpinner';

// Lazy-loaded routes for code splitting
const LandingPage = lazy(() => import('./pages/LandingPage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const ClientPortal = lazy(() => import('./pages/ClientPortal'));
const NotFound = lazy(() => import('./pages/NotFound'));

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/portal" element={<ClientPortal />} />
            <Route path="/portail" element={<Navigate to="/portal" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </Router>
    </ErrorBoundary>
  );
}

