import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShoppingBag, Video, Users, Home } from 'lucide-react';

export default function Navigation() {
  const location = useLocation();

  const navItems = [
    { path: '/lobby', label: 'Browse', icon: Home },
    { path: '/host', label: 'Host', icon: Video },
    { path: '/watch', label: 'Watch', icon: Users },
  ];

  const isActive = (path) => {
    if (path === '/lobby' && location.pathname === '/') return true;
    return location.pathname === path;
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/lobby" className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <ShoppingBag className="text-primary-600" size={24} />
            <span>ShopScribe</span>
          </Link>

          {/* Navigation Links */}
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

          {/* Right side - could add user menu, settings, etc. */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-primary-600 font-medium text-sm">U</span>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
