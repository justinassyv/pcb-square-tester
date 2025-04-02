
import React from 'react';
import { cn } from '@/lib/utils';

type PCBStatus = 'untested' | 'pass' | 'fail';

interface PCBSquareProps {
  number: number;
  status: PCBStatus;
  isActive: boolean;
  onClick?: () => void;
}

const PCBSquare: React.FC<PCBSquareProps> = ({ 
  number, 
  status, 
  isActive, 
  onClick 
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'pass':
        return 'bg-green-400';
      case 'fail':
        return 'bg-red-400';
      default:
        return 'bg-white';
    }
  };

  return (
    <div 
      onClick={onClick}
      className={cn(
        "w-24 h-24 md:w-32 md:h-32 flex items-center justify-center rounded-lg shadow-md transition-all duration-300",
        getStatusColor(),
        isActive ? 'ring-4 ring-blue-500 scale-105' : 'hover:scale-102',
        "cursor-pointer"
      )}
    >
      <span className={cn(
        "text-2xl font-bold",
        status === 'pass' ? 'text-green-800' : 
        status === 'fail' ? 'text-red-800' : 
        'text-gray-800'
      )}>
        {number}
      </span>
    </div>
  );
};

export default PCBSquare;
