import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Settings } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

export type RequiredTests = {
  'RTC configured': boolean;
  'RTC initialized': boolean;
  'LR_ACC initialized': boolean;
  'HR_ACC initialized': boolean;
  'PSRAM initialized': boolean;
  'exFlash initialized': boolean;
  'Ext NFC configured': boolean;
  'Ext NFC initialized': boolean;
};

interface TestConfigurationProps {
  requiredTests: RequiredTests;
  onRequiredTestsChange: (tests: RequiredTests) => void;
}

const TestConfiguration = ({ requiredTests, onRequiredTestsChange }: TestConfigurationProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = (testName: keyof RequiredTests) => {
    onRequiredTestsChange({
      ...requiredTests,
      [testName]: !requiredTests[testName],
    });
  };

  const testNames: (keyof RequiredTests)[] = [
    'RTC configured',
    'RTC initialized',
    'LR_ACC initialized',
    'HR_ACC initialized',
    'PSRAM initialized',
    'exFlash initialized',
    'Ext NFC configured',
    'Ext NFC initialized',
  ];

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="p-4 mb-6">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-0 hover:bg-transparent">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              <h3 className="text-lg font-semibold">Required Tests Configuration</h3>
            </div>
            {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="mt-4">
          <p className="text-sm text-muted-foreground mb-4">
            Toggle which tests are required for a PCB to pass. Disabled tests will not affect pass/fail status.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {testNames.map((testName) => (
              <div key={testName} className="flex items-center space-x-2">
                <Switch
                  id={testName}
                  checked={requiredTests[testName]}
                  onCheckedChange={() => handleToggle(testName)}
                />
                <Label htmlFor={testName} className="cursor-pointer">
                  {testName}
                </Label>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export default TestConfiguration;
