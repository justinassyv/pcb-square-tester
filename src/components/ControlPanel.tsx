
import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle, X } from 'lucide-react';

interface ControlPanelProps {
  onPass: () => void;
  onCancel: () => void;
  currentPCB: number;
  disabled: { pass: boolean; cancel: boolean; }
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  onPass,
  onCancel,
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
          onClick={onCancel}
          disabled={disabled.cancel}
          variant="outline"
          className="flex items-center justify-center p-6 bg-gray-50 hover:bg-gray-100 border-gray-200"
        >
          <X className="mr-2 h-5 w-5 text-gray-600" />
          <span className="text-lg font-medium">Cancel</span>
        </Button>
      </div>
    </div>
  );
};

export default ControlPanel;
