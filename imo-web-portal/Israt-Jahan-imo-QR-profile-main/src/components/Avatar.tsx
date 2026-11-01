import React from 'react';
import { UserProfile } from '../types';

interface AvatarProps {
  profile: UserProfile;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
}

export const Avatar: React.FC<AvatarProps> = ({
  profile,
  size = 'md',
  className = '',
  onClick,
}) => {
  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-[52px] h-[52px]',
    lg: 'w-20 h-20',
  };

  const imageSrc =
    profile.avatarType === 'custom' && profile.customAvatarUrl
      ? profile.customAvatarUrl
      : '/my-logo.jpg';

  return (
    <div
      onClick={onClick}
      className={`relative rounded-full overflow-hidden shrink-0 select-none bg-slate-100 ${
        sizeClasses[size]
      } ${
        onClick ? 'cursor-pointer active:opacity-80 transition-opacity' : ''
      } ${className}`}
      title={onClick ? 'Tap to edit profile' : undefined}
    >
      <img
        src={imageSrc}
        alt={profile.name}
        className="w-full h-full object-cover"
        referrerPolicy="no-referrer"
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          if (!target.src.includes('israt_avatar.jpg')) {
            target.src = '/israt_avatar.jpg';
          }
        }}
      />
    </div>
  );
};
