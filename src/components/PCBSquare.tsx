
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
      className={cn(
        "w-64 h-auto p-4 flex flex-col rounded-lg shadow-md transition-all duration-300 relative",
        getStatusColor()
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
