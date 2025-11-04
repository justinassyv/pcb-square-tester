
import React from 'react';
import { cn } from '@/lib/utils';
import { Check, X } from 'lucide-react';

export type TestResult = {
  name: string;
  passed: boolean;
};

interface PCBSquareProps {
  number: number;
  status: 'untested' | 'pass' | 'fail';
  isActive: boolean;
  testResults?: TestResult[];
  onClick?: () => void;
}

const PCBSquare: React.FC<PCBSquareProps> = ({ 
  number, 
  status, 
  isActive, 
  testResults = [],
  onClick 
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'pass':
        return 'bg-green-50';
      case 'fail':
        return 'bg-red-50';
      default:
        return 'bg-gray-50';
    }
  };

  return (
    <div 
      onClick={onClick}
      className={cn(
        "w-64 h-auto p-4 flex flex-col rounded-lg shadow-md transition-all duration-300 relative",
        getStatusColor(),
        isActive ? 'ring-8 ring-blue-600 scale-110 shadow-2xl shadow-blue-500/50 animate-pulse' : 'hover:scale-102',
        "cursor-pointer"
      )}
    >
      {isActive && (
        <div className="absolute -top-3 -right-3 w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center animate-bounce">
          <span className="text-white text-2xl font-bold">✓</span>
        </div>
      )}
      <span className={cn(
        "text-xl font-bold mb-2 text-center",
        status === 'pass' ? 'text-green-800' : 
        status === 'fail' ? 'text-red-800' : 
        'text-gray-800'
      )}>
        PCB{number}
      </span>
      
      <div className="space-y-2 text-sm">
        {testResults.map((test, index) => (
          <div key={index} className="flex items-center gap-3">
            <div className={cn(
              "p-1 rounded-full",
              test.passed ? "bg-green-100" : "bg-red-100"
            )}>
              {test.passed ? (
                <Check className="text-green-600 h-4 w-4" />
              ) : (
                <X className="text-red-600 h-4 w-4" />
              )}
            </div>
            <span className="text-gray-700">{test.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PCBSquare;
