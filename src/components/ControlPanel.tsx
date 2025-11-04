
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
          className="flex items-center justify-center p-6 bg-red-50 hover:bg-red-100 border-red-200"
        >
          <X className="mr-2 h-5 w-5 text-red-600" />
          <span className="text-lg font-medium text-red-600">Cancel</span>
        </Button>
      </div>
    </div>
  );
};

export default ControlPanel;
