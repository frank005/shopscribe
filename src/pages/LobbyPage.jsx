import React from 'react';
import { useNavigate } from 'react-router-dom';
import AudienceLobby from '../components/AudienceLobby';

export default function LobbyPage() {
  const navigate = useNavigate();

  const handleJoinChannel = (channelName) => {
    // Navigate to watch page with channel parameter
    navigate(`/watch?channel=${encodeURIComponent(channelName)}`);
  };

  return (
    <div className="min-h-screen">
      <AudienceLobby onJoinChannel={handleJoinChannel} />
    </div>
  );
}
