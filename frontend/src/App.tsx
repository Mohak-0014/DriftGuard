import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import PortfolioDetails from './pages/PortfolioDetails';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import NotificationBell from './components/NotificationBell';

const Navigation = () => {
  const { isAuthenticated, logout } = useAuth();

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link to="/" className="flex-shrink-0 flex items-center">
              <span className="font-['Outfit'] font-bold text-2xl text-indigo-600 tracking-tight">
                Portfolio<span className="text-slate-900">Rebalance</span>
              </span>
            </Link>
            {isAuthenticated && (
              <div className="hidden sm:-my-px sm:ml-10 sm:flex sm:space-x-8">
                <Link to="/" className="border-transparent text-slate-500 hover:text-indigo-600 hover:border-indigo-600 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors duration-200">
                  Dashboard
                </Link>
                <Link to="/onboarding" className="border-transparent text-slate-500 hover:text-indigo-600 hover:border-indigo-600 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors duration-200">
                  Create Portfolio
                </Link>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-4">
            {isAuthenticated && <NotificationBell />}
            {isAuthenticated ? (
              <button
                onClick={logout}
                className="text-slate-500 hover:text-red-600 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200"
              >
                Logout
              </button>
            ) : (
              <Link to="/login" className="text-indigo-600 hover:text-indigo-800 font-medium px-3 py-2 rounded-md text-sm transition-colors duration-200">
                Login
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
};

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <Router>
          <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
            <Navigation />

            <main className="py-10">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route
                    path="/"
                    element={
                      <ProtectedRoute>
                        <Dashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/portfolio/:id"
                    element={
                      <ProtectedRoute>
                        <PortfolioDetails />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/onboarding"
                    element={
                      <ProtectedRoute>
                        <Onboarding />
                      </ProtectedRoute>
                    }
                  />
                </Routes>
              </div>
            </main>
          </div>
        </Router>
      </NotificationProvider>
    </AuthProvider>
  );
}



export default App;
