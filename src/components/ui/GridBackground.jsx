import React from 'react';

const GridBackground = ({ color = '#f87171', size = 40 }) => {
  return (
    <div 
      className="absolute inset-0 pointer-events-none z-0"
      style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, ${color} 1px, transparent 0)`,
        backgroundSize: `${size}px ${size}px`,
        opacity: 0.2
      }}
    />
  );
};

export default GridBackground;