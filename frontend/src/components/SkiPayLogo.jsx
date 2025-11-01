import React from 'react';
import './SkiPayLogo.css';

const SkiPayLogo = ({ size = 'large', className = '' }) => {
  const sizeClasses = {
    small: 'text-xl',
    medium: 'text-2xl',
    large: 'text-3xl',
    xlarge: 'text-4xl'
  };

  return (
    <div className={`skipay-logo ${sizeClasses[size]} ${className}`}>
      <span className="logo-text">Sk</span>
      <span className="logo-i-container">
        <span className="logo-i-stick">I</span>
        <span className="logo-i-dot">●</span>
      </span>
      <span className="logo-text">Pay</span>
    </div>
  );
};

export default SkiPayLogo;
