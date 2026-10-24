import { useState } from 'react';

export default function ReliableImage({ src, alt = '', fallback = null, onError, ...props }) {
  const [failedSource, setFailedSource] = useState('');
  const imageUrl = typeof src === 'string' ? src.trim() : '';

  if (!imageUrl || imageUrl === failedSource) return fallback;

  return (
    <img
      {...props}
      src={imageUrl}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={(event) => {
        setFailedSource(imageUrl);
        onError?.(event);
      }}
    />
  );
}
