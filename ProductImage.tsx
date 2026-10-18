import React, { useState } from 'react';
import { PLACEHOLDER_IMAGE } from '../utils/offers';

interface ProductImageProps {
  src?: string;
  className?: string;
  eager?: boolean;
}

/** Decorative product photo (the title is always written next to it). Falls back to a neutral placeholder. */
export const ProductImage: React.FC<ProductImageProps> = ({ src, className = '', eager = false }) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const usable = src && failedSrc !== src ? src : PLACEHOLDER_IMAGE;

  return (
    <img
      src={usable}
      alt=""
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => {
        if (src) setFailedSrc(src);
      }}
      className={className}
    />
  );
};
