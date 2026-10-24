import { useState } from 'react';

function initialsFor(name) {
  return (name || 'U')
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function ProfileAvatar({
  src,
  name,
  alt = 'Profile picture',
  imageClassName = '',
  fallbackClassName = '',
  style,
}) {
  const [failedSource, setFailedSource] = useState('');
  const imageUrl = typeof src === 'string' ? src.trim() : '';

  if (imageUrl && imageUrl !== failedSource) {
    return (
      <img
        className={imageClassName}
        src={imageUrl}
        alt={alt}
        referrerPolicy="no-referrer"
        onError={() => setFailedSource(imageUrl)}
        style={style}
      />
    );
  }

  return (
    <span className={fallbackClassName} role="img" aria-label={alt} style={style}>
      {initialsFor(name)}
    </span>
  );
}
