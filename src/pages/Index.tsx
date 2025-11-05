import React, { useState, useRef, useEffect } from 'react';
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
  
  // Use ref to track latest statuses for event handlers
  const pcbStatusesRef = useRef(pcbStatuses);
  
  useEffect(() => {
    pcbStatusesRef.current = pcbStatuses;
    console.log('🔄 Component Rendered - Current statuses:', pcbStatuses);
  }, [pcbStatuses]);
  
  const handlePass = async () => {
    console.log('🚀 FLASH PCB BUTTON CLICKED');
    console.log('Starting flash process...');
    
    // Reset to PCB 1 at start
    setActivePCB(1);
    
    toast({
      title: "Starting Flash Process",
      description: "Processing all PCBs in sequence...",
    });
    
    try {
      // IMPORTANT: Replace this with your Raspberry Pi's IP address
      // Find it by running: hostname -I
      const RPI_IP = '192.168.1.212'; // e.g., '192.168.1.100'
      const apiUrl = `http://${RPI_IP}:3001/api/flash-progress`;
      
      console.log('Connecting to SSE endpoint:', apiUrl);
      const eventSource = new EventSource(apiUrl);
      console.log('EventSource created, waiting for events...');

      eventSource.onmessage = (event) => {
        console.log('📨 RAW SSE MESSAGE RECEIVED:', event.data);
        
        const data = JSON.parse(event.data);
        console.log('=== SSE EVENT RECEIVED ===');
        console.log('Event data:', data);
        console.log('Event type:', data.type);
        console.log('PCB number:', data.pcb);
        console.log('Current pcbStatuses state:', pcbStatusesRef.current);
        console.log('========================');

        if (data.type === 'debug') {
          console.log('[PYTHON]:', data.message);
        } else if (data.type === 'channel_selected') {
          // Update active PCB based on current channel
          const pcbNum = parseInt(data.pcb);
          console.log(`[FRONTEND] Switching to PCB ${pcbNum}`);
          setActivePCB(pcbNum);
          toast({
            title: `Switching to PCB ${pcbNum}`,
            description: `Now processing PCB ${pcbNum}`,
            duration: 1500,
          });
        } else if (data.type === 'flashing') {
          const pcbNum = parseInt(data.pcb);
          console.log(`🔥 [FRONTEND] FLASHING EVENT - Switching to PCB ${pcbNum}`);
          setActivePCB(pcbNum);
          toast({
            title: "Flashing",
            description: `Flashing PCB ${pcbNum}...`,
            duration: 1500,
          });
        } else if (data.type === 'flash_complete') {
          const pcbNum = parseInt(data.pcb);
          console.log('✅ [FRONTEND] FLASH COMPLETE - PCB:', pcbNum);
          
          // Mark PCB as passed
          setPcbStatuses(prevStatuses => {
            console.log('📝 setState callback - prevStatuses:', prevStatuses);
            const newStatuses = [...prevStatuses];
            newStatuses[pcbNum - 1] = 'pass';
            console.log('📝 setState callback - newStatuses:', newStatuses);
            console.log('📝 Setting PCB', pcbNum, 'to PASS');
            return newStatuses;
          });

          setPcbTestResults(prevResults => {
            const newResults = [...prevResults];
            newResults[pcbNum - 1] = generateTestResults(mockDeviceData);
            return newResults;
          });

          toast({
            title: "Flash Complete",
            description: `PCB ${pcbNum} flashed successfully`,
            duration: 1500,
          });
        } else if (data.type === 'flash_failed') {
          const pcbNum = parseInt(data.pcb);
          console.log('=== FLASH FAILED EVENT ===');
          console.log('PCB Number:', pcbNum);
          
          // Mark PCB as failed
          setPcbStatuses(prevStatuses => {
            console.log('Inside setState - prevStatuses:', prevStatuses);
            const newStatuses = [...prevStatuses];
            newStatuses[pcbNum - 1] = 'fail';
            console.log('Inside setState - newStatuses:', newStatuses);
            
            // Find next untested PCB
            setTimeout(() => {
              setActivePCB(current => {
                for (let i = 1; i <= 6; i++) {
                  const checkIndex = (pcbNum - 1 + i) % 6;
                  if (newStatuses[checkIndex] === 'untested') {
                    return checkIndex + 1;
                  }
                }
                return current;
              });
            }, 100);
            
            return newStatuses;
          });
          
          toast({
            title: "Flash Failed",
            description: `PCB ${pcbNum} failed to flash`,
            variant: "destructive",
            duration: 1500,
          });
        } else if (data.type === 'all_done') {
          console.log('Done message received for current PCB - continuing...');
          // Don't close - the Python script continues to next PCB
        } else if (data.type === 'complete') {
          // Process exit - this means Python script fully finished
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
        console.log('=== SSE CONNECTION OPENED ===');
        console.log('Connected to:', apiUrl);
        console.log('============================');
      };

      eventSource.onerror = (error) => {
        console.error('=== SSE CONNECTION ERROR ===');
        console.error('Error:', error);
        console.error('ReadyState:', eventSource.readyState);
        console.error('===========================');
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
  
  const handleCancel = async () => {
    try {
      // Use same RPI_IP as above
      const RPI_IP = '192.168.1.212'; // e.g., '192.168.1.100'
      const apiUrl = `http://${RPI_IP}:3001/api/kill-process`;
      
      await fetch(apiUrl, { method: 'POST' });
      
      toast({
        title: "Process Cancelled",
        description: "Flash process has been terminated",
        variant: "destructive",
      });
      
      // Reset to first untested PCB
      moveToNextUntested();
    } catch (error) {
      console.error('Error killing process:', error);
      toast({
        title: "Error",
        description: "Failed to cancel process",
        variant: "destructive",
      });
    }
  };
  
  // Removed automatic PCB switching effect - now handled in SSE events
  
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
  
  const isCurrentPCBUntested = pcbStatuses[activePCB - 1] === 'untested';
  const isButtonDisabled = !isCurrentPCBUntested || allTested;
  
  console.log('=== RENDER ===');
  console.log('pcbStatuses:', pcbStatuses);
  console.log('activePCB:', activePCB, 'Status:', pcbStatuses[activePCB - 1]);
  console.log('Button disabled:', isButtonDisabled, 'Reason:', !isCurrentPCBUntested ? 'Current PCB not untested' : allTested ? 'All tested' : 'None');
  console.log('Counts - Pass:', passCount, 'Fail:', failCount, 'Untested:', 6 - passCount - failCount);
  
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
                />
              ))}
            </div>
          </div>
          
          <div className="flex justify-center">
            <ControlPanel 
              onPass={handlePass}
              onCancel={handleCancel}
              currentPCB={activePCB}
              disabled={{
                pass: isButtonDisabled,
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
