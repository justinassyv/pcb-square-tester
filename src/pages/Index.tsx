import React, { useState } from 'react';
import PCBSquare from '@/components/PCBSquare';
import ControlPanel from '@/components/ControlPanel';
import { toast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import type { TestResult } from '@/components/PCBSquare';
import { mockDeviceData, type DeviceData } from '@/types/deviceData';

type PCBStatus = 'untested' | 'pass' | 'fail';

const generateTestResults = (data: DeviceData): TestResult[] => {
  return [
    { name: 'RTC configured', passed: data.RTC.configured },
    { name: 'RTC initialized', passed: data.RTC.initialized },
    { name: 'lowRateAccel initialized', passed: data.lowRateAccel.initialized },
    { name: 'lowRateAccel passed self-test', passed: data.lowRateAccel.selfTestPassed },
    { name: 'hiRateAccel initialized', passed: data.hiRateAccel.initialized },
    { name: 'Ext temperature sensor initialized', passed: data.extTemperatureSensor.initialized },
    { name: 'PSRAM initialized', passed: data.PSRAM.initialized },
    { name: 'PSRAM test passed', passed: data.PSRAM.testPassed },
    { name: 'exFlash initialized', passed: data.exFlash.initialized },
    { name: 'Ext NFC configuring', passed: data.extNFC.configuring },
    { name: 'Ext NFC initialized', passed: data.extNFC.initialized },
  ];
};

const Index = () => {
  const [pcbStatuses, setPcbStatuses] = useState<PCBStatus[]>(Array(6).fill('untested'));
  const [activePCB, setActivePCB] = useState<number>(1);
  const [pcbTestResults, setPcbTestResults] = useState<TestResult[][]>(
    Array(6).fill(generateTestResults(mockDeviceData))
  );
  
  const handlePass = async () => {
    console.log('Starting flash process...');
    
    // Reset to PCB 1 at start
    setActivePCB(1);
    
    toast({
      title: "Starting Flash Process",
      description: "Processing all PCBs in sequence...",
    });
    
    try {
      // Use relative URL or detect the correct host
      const apiUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:3001/api/flash-progress'
        : `http://${window.location.hostname}:3001/api/flash-progress`;
      
      console.log('Connecting to SSE endpoint:', apiUrl);
      const eventSource = new EventSource(apiUrl);
      console.log('EventSource created, waiting for events...');

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('Progress update received:', data);

        if (data.type === 'channel_selected') {
          // Update active PCB based on current channel
          console.log(`Switching to PCB ${data.pcb}`);
          setActivePCB(data.pcb);
          toast({
            title: `Switching to PCB ${data.pcb}`,
            description: `Now processing PCB ${data.pcb}`,
            duration: 2000,
          });
        } else if (data.type === 'flashing') {
          console.log(`Flashing PCB ${data.pcb}`);
          setActivePCB(data.pcb);
          toast({
            title: "Flashing",
            description: `Flashing PCB ${data.pcb}...`,
            duration: 2000,
          });
        } else if (data.type === 'flash_complete') {
          console.log(`Flash complete for PCB ${data.pcb}`);
          // Mark PCB as passed using the PCB number from the event
          setPcbStatuses(prevStatuses => {
            const newStatuses = [...prevStatuses];
            newStatuses[data.pcb - 1] = 'pass';
            return newStatuses;
          });

          setPcbTestResults(prevResults => {
            const newResults = [...prevResults];
            newResults[data.pcb - 1] = generateTestResults(mockDeviceData);
            return newResults;
          });

          toast({
            title: "Flash Complete",
            description: `PCB ${data.pcb} flashed successfully`,
            duration: 2000,
          });
        } else if (data.type === 'flash_failed') {
          console.log(`Flash failed for PCB ${data.pcb}`);
          // Mark PCB as failed using the PCB number from the event
          setPcbStatuses(prevStatuses => {
            const newStatuses = [...prevStatuses];
            newStatuses[data.pcb - 1] = 'fail';
            return newStatuses;
          });
          
          toast({
            title: "Flash Failed",
            description: `PCB ${data.pcb} failed to flash`,
            variant: "destructive",
            duration: 2000,
          });
        } else if (data.type === 'complete') {
          // All done
          eventSource.close();
          toast({
            title: "All PCBs Processed",
            description: "Flash sequence complete",
          });
        } else if (data.type === 'error') {
          eventSource.close();
          toast({
            title: "Error",
            description: data.message,
            variant: "destructive",
          });
        }
      };

      eventSource.onopen = () => {
        console.log('SSE connection established');
      };

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        eventSource.close();
        toast({
          title: "Connection Error",
          description: "Lost connection to server. Make sure the server is running on port 3001.",
          variant: "destructive",
        });
      };
    } catch (error) {
      console.error('Flash error:', error);
      toast({
        title: "Error",
        description: "Failed to start flash process",
        variant: "destructive",
      });
    }
  };
  
  const handleFail = () => {
    const newStatuses = [...pcbStatuses];
    newStatuses[activePCB - 1] = 'fail';
    setPcbStatuses(newStatuses);
    
    // Generate failed results by inverting the mock data
    const failedData: DeviceData = JSON.parse(JSON.stringify(mockDeviceData));
    Object.keys(failedData).forEach(key => {
      if (typeof failedData[key as keyof DeviceData] === 'object') {
        const obj = failedData[key as keyof DeviceData];
        Object.keys(obj).forEach(subKey => {
          if (typeof obj[subKey] === 'boolean') {
            obj[subKey] = Math.random() > 0.8; // 20% chance to pass
          }
        });
      }
    });
    
    const newResults = [...pcbTestResults];
    newResults[activePCB - 1] = generateTestResults(failedData);
    setPcbTestResults(newResults);
    
    toast({
      title: "Test Failed",
      description: `PCB #${activePCB} test failed.`,
      variant: "destructive",
    });
    
    moveToNextUntested();
  };
  
  const moveToNextUntested = () => {
    const currentIndex = activePCB - 1;
    let nextIndex = currentIndex;
    
    // Find the next untested PCB
    for (let i = 1; i <= pcbStatuses.length; i++) {
      const checkIndex = (currentIndex + i) % pcbStatuses.length;
      if (pcbStatuses[checkIndex] === 'untested') {
        nextIndex = checkIndex;
        break;
      }
    }
    
    setActivePCB(nextIndex + 1);
  };
  
  const handleNext = () => {
    moveToNextUntested();
  };
  
  const handleReset = () => {
    setPcbStatuses(Array(6).fill('untested'));
    setActivePCB(1);
    
    toast({
      title: "Reset Complete",
      description: "All PCB statuses have been reset.",
    });
  };
  
  const handleSquareClick = (index: number) => {
    if (pcbStatuses[index] === 'untested') {
      setActivePCB(index + 1);
    }
  };
  
  const allTested = pcbStatuses.every(status => status !== 'untested');
  const passCount = pcbStatuses.filter(status => status === 'pass').length;
  const failCount = pcbStatuses.filter(status => status === 'fail').length;
  
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800">PCB Square Tester</h1>
          <p className="text-gray-600 mt-2">Test your PCB boards and track results</p>
        </div>
        
        <Card className="p-6 bg-white shadow-md rounded-lg">
          <div className="mb-6">
            {/* Large Active PCB Indicator */}
            <div className="mb-6 p-6 bg-blue-600 rounded-lg text-center">
              <h2 className="text-4xl font-bold text-white mb-2">
                PROCESSING PCB {activePCB}
              </h2>
              <div className="w-16 h-16 mx-auto bg-white rounded-full animate-pulse flex items-center justify-center">
                <span className="text-3xl font-bold text-blue-600">{activePCB}</span>
              </div>
            </div>

            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-700">Test Status</h2>
              <div className="flex space-x-4">
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                  Passed: {passCount}
                </span>
                <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm">
                  Failed: {failCount}
                </span>
                <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm">
                  Untested: {6 - passCount - failCount}
                </span>
              </div>
            </div>
            
            <div className="flex justify-center gap-4 mb-8 overflow-x-auto">
              {pcbStatuses.map((status, index) => (
                <PCBSquare 
                  key={index}
                  number={index + 1}
                  status={status}
                  isActive={activePCB === index + 1}
                  testResults={pcbTestResults[index]}
                  onClick={() => handleSquareClick(index)}
                />
              ))}
            </div>
          </div>
          
          <div className="flex justify-center">
            <ControlPanel 
              onPass={handlePass}
              onCancel={handleNext}
              currentPCB={activePCB}
              disabled={{
                pass: pcbStatuses[activePCB - 1] !== 'untested' || allTested,
                cancel: allTested
              }}
            />
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Index;
