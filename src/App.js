import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Pages
import LobbyPage from './pages/LobbyPage';
import HostPage from './pages/HostPage';
import AudiencePage from './pages/AudiencePage';

// Components
import Navigation from './components/Navigation';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        
        <main className="container mx-auto px-4 py-6">
          <Routes>
            {/* Default route - redirect to lobby */}
            <Route path="/" element={<Navigate to="/lobby" replace />} />
            
            {/* Lobby - Channel discovery */}
            <Route path="/lobby" element={<LobbyPage />} />
            
            {/* Host - Stream and control products */}
            <Route path="/host" element={<HostPage />} />
            
            {/* Audience - Watch stream */}
            <Route path="/watch" element={<AudiencePage />} />
            
            {/* Catch all - redirect to lobby */}
            <Route path="*" element={<Navigate to="/lobby" replace />} />
          </Routes>
        </main>
        
        {/* Toast notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#10B981',
                secondary: '#fff',
              },
            },
            error: {
              duration: 5000,
              iconTheme: {
                primary: '#EF4444',
                secondary: '#fff',
              },
            },
          }}
        />
      </div>
    </Router>
  );
}

export default App;
