/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { ErrorBoundary } from './components/ErrorBoundary';
import LoadingSpinner from './components/LoadingSpinner';

// Lazy-loaded routes for code splitting
const LandingPage = lazy(() => import('./pages/LandingPage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const ClientPortal = lazy(() => import('./pages/ClientPortal'));
const PostSubmitScreen = lazy(() => import('./pages/PostSubmitScreen'));
const PaiementPage = lazy(() => import('./pages/PaiementPage'));
const CguPage = lazy(() => import('./pages/CguPage'));
const ConfidentialitePage = lazy(() => import('./pages/ConfidentialitePage'));
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
            <Route path="/inscription/confirmee" element={<PostSubmitScreen />} />
            <Route path="/paiement" element={<PaiementPage />} />
            <Route path="/cgu" element={<CguPage />} />
            <Route path="/confidentialite" element={<ConfidentialitePage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </Router>
      <Analytics />
    </ErrorBoundary>
  );
}

