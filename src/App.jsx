import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DailyReport from './pages/DailyReport';
import MonthlyReport from './pages/MonthlyReport';
import Providers from './pages/Providers';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#6b7280',
        fontSize: 14,
      }}>
        Loading…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        path="/*"
        element={
          <PrivateRoute>
            <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
              <Navbar />
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/daily" element={<DailyReport />} />
                <Route path="/monthly" element={<MonthlyReport />} />
                <Route path="/providers" element={<Providers />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          </PrivateRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
