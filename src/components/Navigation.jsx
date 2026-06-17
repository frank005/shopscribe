import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShoppingBag, Video, Users, Home, Clock, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navigation() {
  const location = useLocation();
  const { authUser, sessionTimer, signOutUrl } = useAuth();
  const { timeRemaining, showWarning, formatTimeRemaining } = sessionTimer;
  const showQuotaBadge = timeRemaining !== null;
  const quotaUnlimited = timeRemaining === Infinity;

  const navItems = [
    { path: '/lobby', label: 'Browse', icon: Home },
    { path: '/host', label: 'Host', icon: Video },
    { path: '/watch', label: 'Watch', icon: Users },
  ];

  const isActive = (path) => {
    if (path === '/lobby' && location.pathname === '/') return true;
    return location.pathname === path;
  };

  const displayName =
    authUser?.name || authUser?.email?.split('@')[0] || 'User';

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/lobby" className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <ShoppingBag className="text-primary-600" size={24} />
            <span>ShopScribe</span>
          </Link>

          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    isActive(item.path)
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            {showQuotaBadge && (
              <div
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                  quotaUnlimited
                    ? 'bg-emerald-50 text-emerald-700'
                    : showWarning
                      ? 'bg-secondary-100 text-secondary-800'
                      : 'bg-gray-100 text-gray-600'
                }`}
              >
                <Clock size={12} />
                <span
                  title={
                    quotaUnlimited
                      ? 'Unlimited demo time for Agora accounts'
                      : 'Daily demo time remaining (UTC day)'
                  }
                >
                  {quotaUnlimited ? 'Unlimited' : formatTimeRemaining(timeRemaining)}
                </span>
              </div>
            )}
            <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center">
              <span className="text-white font-medium text-sm">
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>
            <a
              href={signOutUrl}
              className="text-gray-500 hover:text-gray-700 p-1"
              title="Sign out"
            >
              <LogOut size={18} />
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
}
