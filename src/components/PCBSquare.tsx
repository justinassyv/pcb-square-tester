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
    if (status === 'fail') return 'bg-red-50';
    
    const allTestsPassed = testResults.length > 0 && testResults.every(test => test.passed);
    
    return allTestsPassed ? 'bg-green-50' : 'bg-red-50';
  };

  return (
    <div 
      onClick={onClick}
      className={cn(
        "w-64 h-auto p-4 flex flex-col rounded-lg shadow-md transition-all duration-300",
        getStatusColor(),
        isActive ? 'ring-4 ring-blue-500 scale-105' : 'hover:scale-102',
        "cursor-pointer"
      )}
    >
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
          <div key={index} className="flex items-center justify-between">
            <span className="text-gray-700">{test.name}</span>
            {test.passed ? (
              <Check className="text-green-600 h-4 w-4" />
            ) : (
              <X className="text-red-600 h-4 w-4" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PCBSquare;
