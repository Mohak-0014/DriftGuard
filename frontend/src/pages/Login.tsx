import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login: React.FC = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { login, signup } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            if (isLogin) {
                await login(email, password);
                navigate('/');
            } else {
                await signup(email, password);
                await login(email, password);
                navigate('/onboarding');
            }
        } catch (err: any) {
            const detail = err.response?.data?.detail;
            setError(Array.isArray(detail) ? detail[0]?.msg : detail || 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex" style={{ background: 'var(--bg-base)' }}>
            {/* Left branding panel */}
            <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12"
                style={{ background: 'var(--bg-surface)', borderRight: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: 'var(--accent)' }}>
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                    </div>
                    <span className="text-xl font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif' }}>
                        DriftGuard
                    </span>
                </div>

                <div>
                    <h1 className="text-4xl font-bold leading-tight mb-4"
                        style={{ color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif' }}>
                        Intelligent portfolio<br />
                        <span style={{ color: 'var(--accent)' }}>rebalancing</span> at<br />
                        your fingertips.
                    </h1>
                    <p className="text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        Mean-variance optimization, real-time drift alerts, AI-powered explanations,
                        and sentiment analysis — all in one platform.
                    </p>
                </div>

                <div className="grid grid-cols-3 gap-4">
                    {[
                        { label: 'Sharpe Optimized', icon: '📈' },
                        { label: 'AI Explanations', icon: '🤖' },
                        { label: 'Real-time Alerts', icon: '🔔' },
                    ].map(f => (
                        <div key={f.label} className="p-4 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                            <div className="text-2xl mb-2">{f.icon}</div>
                            <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{f.label}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right auth panel */}
            <div className="flex-1 flex items-center justify-center p-6">
                <div className="w-full max-w-sm fade-up">
                    {/* Mobile logo */}
                    <div className="flex lg:hidden items-center gap-2 mb-8 justify-center">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ background: 'var(--accent)' }}>
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                        </div>
                        <span className="text-xl font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif' }}>DriftGuard</span>
                    </div>

                    <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                        {isLogin ? 'Welcome back' : 'Create account'}
                    </h2>
                    <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
                        {isLogin ? 'Sign in to your portfolio dashboard' : 'Start optimizing your portfolio today'}
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold mb-1.5"
                                style={{ color: 'var(--text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                Email
                            </label>
                            <input
                                type="email"
                                required
                                placeholder="you@example.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="w-full px-3 py-2.5 text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold mb-1.5"
                                style={{ color: 'var(--text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                Password
                            </label>
                            <input
                                type="password"
                                required
                                placeholder={isLogin ? '••••••••' : 'Min. 8 characters'}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full px-3 py-2.5 text-sm"
                            />
                        </div>

                        {error && (
                            <div className="px-4 py-3 rounded-lg text-sm"
                                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn btn-primary w-full py-2.5"
                            style={{ marginTop: '8px' }}
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    {isLogin ? 'Signing in…' : 'Creating account…'}
                                </span>
                            ) : (isLogin ? 'Sign in' : 'Create account')}
                        </button>
                    </form>

                    <p className="mt-6 text-sm text-center" style={{ color: 'var(--text-muted)' }}>
                        {isLogin ? "Don't have an account? " : 'Already have an account? '}
                        <button
                            onClick={() => { setIsLogin(!isLogin); setError(''); }}
                            className="font-semibold"
                            style={{ color: 'var(--accent)' }}
                        >
                            {isLogin ? 'Sign up' : 'Sign in'}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
