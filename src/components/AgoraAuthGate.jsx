import React from "react";
import { ShoppingBag, Sparkles } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getDailyQuotaSeconds } from "../utils/dailyQuota";
import SessionWarning from "./SessionWarning";

export default function AgoraAuthGate({ children }) {
  const { me, loading, authError, signInUrl, sessionTimer } = useAuth();
  const quotaMinutes = Math.floor(getDailyQuotaSeconds() / 60);

  if (loading || !me) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4" />
          <p className="text-gray-600">Checking sign-in…</p>
        </div>
      </div>
    );
  }

  if (!me.authenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full card text-center border-primary-100 shadow-lg">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center shadow-md">
              <ShoppingBag className="w-7 h-7 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">ShopScribe Live</h1>
          <p className="text-gray-600 mb-6">
            Sign in with your Agora account to host or watch live shopping streams.
            Each user gets {quotaMinutes} minutes of demo time per day.
          </p>
          {authError ? (
            <p className="text-red-600 text-sm mb-4">
              Sign-in error: <code>{authError}</code>
            </p>
          ) : null}
          <a href={signInUrl} className="btn-primary inline-flex items-center gap-2 px-8 py-3">
            <Sparkles size={18} />
            Sign in with Agora
          </a>
          <p className="text-xs text-gray-400 mt-4">
            Auth mode: <code>{me.authMode}</code>
          </p>
        </div>
      </div>
    );
  }

  if (sessionTimer.quotaExhausted && !sessionTimer.isTracking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full card text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Daily demo time used up
          </h1>
          <p className="text-gray-600 mb-6">
            You&apos;ve used your {quotaMinutes}-minute daily budget on ShopScribe.
            Quota resets at midnight UTC.
          </p>
          <a href="/api/auth/agora/logout" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
            Sign out
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      <SessionWarning />
      {children}
    </>
  );
}
