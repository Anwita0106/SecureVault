import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import MyFilesPage from './pages/MyFilesPage';
import UploadFilePage from './pages/UploadFilePage';
import SharedFilesPage from './pages/SharedFilesPage';
import SecurityCenterPage from './pages/SecurityCenterPage';
import AuditLogsPage from './pages/AuditLogsPage';
import UserManagementPage from './pages/UserManagementPage';
import ProfilePage from './pages/ProfilePage';
import SharedAccessPage from './pages/SharedAccessPage';

// Layout
import Layout from './components/common/Layout';

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && !user.is_superuser) return <Navigate to="/dashboard" replace />;
  return children;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: { background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155' },
            duration: 4000,
          }}
        />
        <Routes>
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
          <Route path="/share/:token" element={<SharedAccessPage />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="files" element={<MyFilesPage />} />
            <Route path="upload" element={<UploadFilePage />} />
            <Route path="shared" element={<SharedFilesPage />} />
            <Route path="security" element={<SecurityCenterPage />} />
            <Route path="audit-logs" element={<AuditLogsPage />} />
            <Route path="users" element={<ProtectedRoute adminOnly><UserManagementPage /></ProtectedRoute>} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
