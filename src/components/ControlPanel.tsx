
import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, ArrowRight, RefreshCw } from 'lucide-react';

interface ControlPanelProps {
  onPass: () => void;
  onFail: () => void;
  onNext: () => void;
  onReset: () => void;
  currentPCB: number;
  disabled: { pass: boolean; fail: boolean; next: boolean; }
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  onPass,
  onFail,
  onNext,
  onReset,
  currentPCB,
  disabled
}) => {
  return (
    <div className="flex flex-col space-y-4 w-full max-w-md">
      <div className="text-center mb-2">
        <h2 className="text-xl font-semibold text-gray-700">
          Currently Testing: PCB #{currentPCB}
        </h2>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <Button 
          onClick={onPass}
          disabled={disabled.pass}
          variant="outline"
          className="flex items-center justify-center p-6 bg-green-50 hover:bg-green-100 border-green-200"
        >
          <CheckCircle className="mr-2 h-5 w-5 text-green-600" />
          <span className="text-lg font-medium">FLASH PCB</span>
        </Button>
        
        <Button 
          onClick={onFail}
          disabled={disabled.fail}
          variant="outline"
          className="flex items-center justify-center p-6 bg-red-50 hover:bg-red-100 border-red-200"
        >
          <XCircle className="mr-2 h-5 w-5 text-red-600" />
          <span className="text-lg font-medium">Fail</span>
        </Button>
        
        <Button 
          onClick={onNext}
          disabled={disabled.next}
          variant="outline"
          className="flex items-center justify-center p-6 bg-blue-50 hover:bg-blue-100 border-blue-200"
        >
          <ArrowRight className="mr-2 h-5 w-5 text-blue-600" />
          <span className="text-lg font-medium">Next PCB</span>
        </Button>
        
        <Button 
          onClick={onReset}
          variant="outline"
          className="flex items-center justify-center p-6 bg-gray-50 hover:bg-gray-100 border-gray-200"
        >
          <RefreshCw className="mr-2 h-5 w-5 text-gray-600" />
          <span className="text-lg font-medium">Reset</span>
        </Button>
      </div>
    </div>
  );
};

export default ControlPanel;
