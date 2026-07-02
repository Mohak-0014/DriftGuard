import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, NavLink, Navigate, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import PortfolioDetails from './pages/PortfolioDetails';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import NotificationBell from './components/NotificationBell';

const Logo = () => (
    <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--accent)' }}>
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
        </div>
        <span className="font-bold text-lg" style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--text-primary)' }}>
            DriftGuard
        </span>
    </div>
);

const NavItem = ({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) => (
    <NavLink
        to={to}
        end={to === '/'}
        className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${isActive
                ? 'text-white'
                : 'hover:bg-[var(--bg-hover)]'
            }`
        }
        style={({ isActive }) => isActive
            ? { background: 'var(--accent-dim)', color: 'var(--accent-hover)' }
            : { color: 'var(--text-secondary)' }
        }
    >
        {icon}
        {label}
    </NavLink>
);

const Sidebar = () => {
    const { logout } = useAuth();
    return (
        <aside className="hidden lg:flex flex-col w-56 flex-shrink-0 h-screen sticky top-0"
            style={{ background: 'var(--bg-surface)', borderRight: '1px solid var(--border)' }}>
            <div className="px-4 py-5 border-b" style={{ borderColor: 'var(--border)' }}>
                <Logo />
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-widest"
                    style={{ color: 'var(--text-muted)' }}>Navigation</p>
                <NavItem to="/" label="Dashboard" icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                } />
                <NavItem to="/onboarding" label="New Portfolio" icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M12 4v16m8-8H4" />
                    </svg>
                } />
            </nav>

            <div className="px-3 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
                <button
                    onClick={logout}
                    className="btn btn-ghost w-full text-sm"
                    style={{ color: 'var(--text-secondary)', justifyContent: 'flex-start' }}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign out
                </button>
            </div>
        </aside>
    );
};

const TopBar = () => {
    const { logout } = useAuth();
    const [mobileOpen, setMobileOpen] = useState(false);
    const location = useLocation();

    const pageTitle: Record<string, string> = {
        '/': 'Dashboard',
        '/onboarding': 'New Portfolio',
    };
    const title = pageTitle[location.pathname] ?? 'Portfolio Details';

    return (
        <>
            <header className="lg:hidden flex items-center justify-between px-4 py-3 sticky top-0 z-30"
                style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
                <button onClick={() => setMobileOpen(true)} style={{ color: 'var(--text-secondary)' }}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>
                <Logo />
                <NotificationBell />
            </header>

            {/* Mobile drawer */}
            {mobileOpen && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
                    <div className="absolute left-0 top-0 bottom-0 w-64 flex flex-col"
                        style={{ background: 'var(--bg-surface)', borderRight: '1px solid var(--border)' }}>
                        <div className="px-4 py-5 border-b flex items-center justify-between"
                            style={{ borderColor: 'var(--border)' }}>
                            <Logo />
                            <button onClick={() => setMobileOpen(false)} style={{ color: 'var(--text-muted)' }}>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <nav className="flex-1 px-3 py-4 space-y-1" onClick={() => setMobileOpen(false)}>
                            <NavItem to="/" label="Dashboard" icon={
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                </svg>
                            } />
                            <NavItem to="/onboarding" label="New Portfolio" icon={
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                            } />
                        </nav>
                        <div className="px-3 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
                            <button onClick={logout} className="btn btn-ghost w-full text-sm"
                                style={{ color: 'var(--text-secondary)', justifyContent: 'flex-start' }}>
                                Sign out
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Desktop page header bar */}
            <div className="hidden lg:flex items-center justify-between px-6 py-4 border-b"
                style={{ borderColor: 'var(--border)' }}>
                <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif' }}>
                    {title}
                </h1>
                <div className="flex items-center gap-3">
                    <NotificationBell />
                </div>
            </div>
        </>
    );
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    const { isAuthenticated } = useAuth();
    const location = useLocation();
    if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
    return <>{children}</>;
};

const AppLayout = () => {
    const { isAuthenticated } = useAuth();
    const location = useLocation();
    const isLogin = location.pathname === '/login';

    if (!isAuthenticated || isLogin) {
        return (
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        );
    }

    return (
        <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
                <TopBar />
                <main className="flex-1 p-5 lg:p-6 overflow-y-auto">
                    <Routes>
                        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                        <Route path="/portfolio/:id" element={<ProtectedRoute><PortfolioDetails /></ProtectedRoute>} />
                        <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </main>
            </div>
        </div>
    );
};

function App() {
    return (
        <AuthProvider>
            <NotificationProvider>
                <Router>
                    <AppLayout />
                </Router>
            </NotificationProvider>
        </AuthProvider>
    );
}

export default App;
