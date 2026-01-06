import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Settings } from 'lucide-react';

export type RequiredTests = {
  'RTC configured': boolean;
  'RTC initialized': boolean;
  'LACC initialized': boolean;
  'HACC initialized': boolean;
  'PSRAM initialized': boolean;
  'exFlash initialized': boolean;
  'Ext NFC configured': boolean;
  'Ext NFC initialized': boolean;
  'VSC_V': boolean;
  'VMC_V': boolean;
};

interface TestConfigurationProps {
  requiredTests: RequiredTests;
  onRequiredTestsChange: (tests: RequiredTests) => void;
}

const TestConfiguration = ({ requiredTests, onRequiredTestsChange }: TestConfigurationProps) => {
  const handleToggle = (testName: keyof RequiredTests) => {
    onRequiredTestsChange({
      ...requiredTests,
      [testName]: !requiredTests[testName],
    });
  };

  const testNames: (keyof RequiredTests)[] = [
    'RTC configured',
    'RTC initialized',
    'LACC initialized',
    'HACC initialized',
    'PSRAM initialized',
    'exFlash initialized',
    'Ext NFC configured',
    'Ext NFC initialized',
    'VSC_V',
    'VMC_V',
  ];

  return (
    <Card className="p-4 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Settings className="h-5 w-5" />
        <h3 className="text-lg font-semibold">Required Tests Configuration</h3>
      </div>
      
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
    </Card>
  );
};

export default TestConfiguration;
