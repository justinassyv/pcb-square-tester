import React, { useState, useRef, useEffect } from 'react';
import PCBSquare from '@/components/PCBSquare';
import ControlPanel from '@/components/ControlPanel';
import TestConfiguration, { type RequiredTests } from '@/components/TestConfiguration';
import { toast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import type { TestResult } from '@/components/PCBSquare';
import { mockDeviceData, type DeviceData } from '@/types/deviceData';

type PCBStatus = 'untested' | 'pass' | 'fail';

const generateTestResults = (data: DeviceData): TestResult[] => {
  return [
    { name: 'RTC configured', passed: data.RTC.configured },
    { name: 'RTC initialized', passed: data.RTC.initialized },
    { name: 'LACC initialized', passed: data.lowRateAccel.initialized },
    { name: 'HACC initialized', passed: data.hiRateAccel.initialized },
    { name: 'PSRAM initialized', passed: data.PSRAM.initialized },
    { name: 'PSRAM test passed', passed: data.PSRAM.testPassed },
    { name: 'exFlash initialized', passed: data.exFlash.initialized },
    { name: 'Ext NFC configuring', passed: data.extNFC.configuring },
    { name: 'Ext NFC initialized', passed: data.extNFC.initialized },
  ];
};

const Index = () => {
  // Load test configuration from localStorage
  const loadRequiredTests = (): RequiredTests => {
    const saved = localStorage.getItem('requiredTests');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Fall back to defaults if parsing fails
      }
    }
    return {
      'RTC configured': true,
      'RTC initialized': true,
      'LACC initialized': true,
      'HACC initialized': true,
      'PSRAM initialized': true,
      'exFlash initialized': true,
      'Ext NFC configured': true,
      'Ext NFC initialized': true,
    };
  };

  const [pcbStatuses, setPcbStatuses] = useState<PCBStatus[]>(Array(6).fill('untested'));
  const [activePCB, setActivePCB] = useState<number>(1);
  const [requiredTests, setRequiredTests] = useState<RequiredTests>(loadRequiredTests());
  const [pcbTestResults, setPcbTestResults] = useState<TestResult[][]>(
    Array(6).fill([]).map(() => [
      { name: 'RTC configured', passed: false },
      { name: 'RTC initialized', passed: false },
      { name: 'LACC initialized', passed: false },
      { name: 'HACC initialized', passed: false },
      { name: 'PSRAM initialized', passed: false },
      { name: 'exFlash initialized', passed: false },
      { name: 'Ext NFC configured', passed: false },
      { name: 'Ext NFC initialized', passed: false },
    ])
  );
  const [terminalMessages, setTerminalMessages] = useState<string[]>([]);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  
  // Use ref to track latest statuses for event handlers
  const pcbStatusesRef = useRef(pcbStatuses);
  // Track which PCB is currently being processed (for test result updates)
  const currentProcessingPCBRef = useRef<number>(1);
  
  useEffect(() => {
    pcbStatusesRef.current = pcbStatuses;
  }, [pcbStatuses]);

  // Save test configuration to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('requiredTests', JSON.stringify(requiredTests));
  }, [requiredTests]);
  const parseTestResults = (message: string): Partial<Record<string, boolean>> => {
    const results: Partial<Record<string, boolean>> = {};
    const lowerMsg = message.toLowerCase();
    
    console.log('=== PARSING MESSAGE ===');
    console.log('Original:', message);
    
    if (message.includes('RTC configured')) results['RTC configured'] = true;
    if (message.includes('RTC initialized')) results['RTC initialized'] = true;
    
    // Check for LACC - look for the specific pattern
    if (/lacc\s+(failed|error)/i.test(message)) {
      console.log('✗ LACC FAILED');
      results['LACC initialized'] = false;
    } else if (/lacc\s+initialized/i.test(message)) {
      console.log('✓ LACC SUCCESS');
      results['LACC initialized'] = true;
    }
    
    // Check for HACC - look for the specific pattern
    if (/hacc\s+(failed|error)/i.test(message)) {
      console.log('✗ HACC FAILED');
      results['HACC initialized'] = false;
    } else if (/hacc\s+initialized/i.test(message)) {
      console.log('✓ HACC SUCCESS');
      results['HACC initialized'] = true;
    }
    
    // Check for PSRAM - look for the specific pattern
    if (/psram\s+(failed|error)/i.test(message)) {
      console.log('✗ PSRAM FAILED');
      results['PSRAM initialized'] = false;
    } else if (/psram\s+initialized/i.test(message)) {
      console.log('✓ PSRAM SUCCESS');
      results['PSRAM initialized'] = true;
    }
    
    if (message.includes('exFlash initialized')) results['exFlash initialized'] = true;
    if (message.includes('Ext NFC configured')) results['Ext NFC configured'] = true;
    if (message.includes('Ext NFC initialized')) results['Ext NFC initialized'] = true;
    
    console.log('Parsed results:', results);
    console.log('======================');
    return results;
  };
  
  
  const handlePass = async () => {
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
      
      const eventSource = new EventSource(apiUrl);

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        // Capture raw terminal output
        if (data.type === 'raw_output') {
          console.log('📥 RAW MESSAGE RECEIVED:', data.message);
          const formatted = data.message
            .replace(/\. /g, '.\n')  // Line break after periods
            .replace(/MCU reset reasons:/g, '\n🔄 MCU reset reasons:')
            .replace(/RTC configured/g, '\n✓ RTC configured')
            .replace(/RTC initialized/g, '✓ RTC initialized')
            .replace(/Error,/g, '\n❌ Error:')
            .replace(/initialized/g, 'initialized')
            .replace(/DUID :/g, '\n📋 DUID:')
            .replace(/MAC Address :/g, '\n📋 MAC Address:')
            .replace(/Hw ver :/g, '\n📋 Hw ver:')
            .replace(/Appl ver :/g, '\n📋 Appl ver:')
            .replace(/Boot ver :/g, '\n📋 Boot ver:')
            .replace(/SD ver :/g, '\n📋 SD ver:')
            .replace(/Ble adv\. name :/g, '\n📋 BLE adv. name:')
            .replace(/MCU :/g, '\n🔧 MCU:')
            .replace(/MCU memory :/g, '\n💾 MCU memory:')
            .replace(/Internal flash memory layout:/g, '\n\n📂 Internal flash memory layout:')
            .replace(/MBR 0x/g, '\n  • MBR 0x')
            .replace(/SD 0x/g, '\n  • SD 0x')
            .replace(/APPL 0x/g, '\n  • APPL 0x')
            .replace(/BOOT 0x/g, '\n  • BOOT 0x')
            .replace(/BOOT2 0x/g, '\n  • BOOT2 0x')
            .replace(/MBR_P 0x/g, '\n  • MBR_P 0x')
            .replace(/BOOT_S 0x/g, '\n  • BOOT_S 0x')
            .replace(/Task State/g, '\n\n📊 Task State')
            .replace(/Wake up source:/g, '\n⏰ Wake up source:')
            .replace(/BLE adv name/g, '\n📡 BLE adv name')
            .replace(/BLE on/g, '\n✓ BLE on')
            .trim();
          
          setTerminalMessages(prev => [...prev, ...formatted.split('\n').filter(m => m.trim().length > 0)]);
          setTimeout(() => terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
          
          // Parse and update test results for currently processing PCB
          const testUpdates = parseTestResults(data.message);
          if (Object.keys(testUpdates).length > 0) {
            console.log('🔄 APPLYING TEST UPDATES');
            console.log('Current processing PCB:', currentProcessingPCBRef.current);
            console.log('Test updates to apply:', testUpdates);
            setPcbTestResults(prevResults => {
              const newResults = [...prevResults];
              const processingPCBIndex = currentProcessingPCBRef.current - 1;
              console.log('Updating PCB index:', processingPCBIndex);
              console.log('Current tests BEFORE update:', newResults[processingPCBIndex]);
              const updatedTests = newResults[processingPCBIndex].map(test => {
                const newPassed = testUpdates[test.name] !== undefined ? testUpdates[test.name]! : test.passed;
                if (test.name === 'HACC initialized') {
                  console.log(`🎯 HACC Test Update:`);
                  console.log(`   Current: ${test.passed}`);
                  console.log(`   New: ${newPassed}`);
                  console.log(`   From updates: ${testUpdates[test.name]}`);
                }
                return {
                  ...test,
                  passed: newPassed
                };
              });
              newResults[processingPCBIndex] = updatedTests;
              console.log('Updated tests AFTER update:', updatedTests);
              console.log('HACC final state:', updatedTests.find(t => t.name === 'HACC initialized'));
              return newResults;
            });
          }
        }

        if (data.type === 'channel_selected') {
          const pcbNum = parseInt(data.pcb);
          currentProcessingPCBRef.current = pcbNum;
          setActivePCB(pcbNum);
          toast({
            title: `Switching to PCB ${pcbNum}`,
            description: `Now processing PCB ${pcbNum}`,
            duration: 1500,
          });
        } else if (data.type === 'flashing') {
          const pcbNum = parseInt(data.pcb);
          currentProcessingPCBRef.current = pcbNum;
          setActivePCB(pcbNum);
          toast({
            title: "Flashing",
            description: `Flashing PCB ${pcbNum}...`,
            duration: 1500,
          });
        } else if (data.type === 'flash_complete') {
          const pcbNum = parseInt(data.pcb);
          
          // Check if all REQUIRED tests passed for this PCB
          setPcbTestResults(currentTestResults => {
            const pcbTests = currentTestResults[pcbNum - 1];
            
            // Only check tests that are marked as required
            const requiredTestResults = pcbTests.filter(test => 
              requiredTests[test.name as keyof RequiredTests]
            );
            
            const allRequiredTestsPassed = requiredTestResults.every(test => test.passed);
            const ignoredTestsCount = pcbTests.length - requiredTestResults.length;
            
            setPcbStatuses(prevStatuses => {
              const newStatuses = [...prevStatuses];
              newStatuses[pcbNum - 1] = allRequiredTestsPassed ? 'pass' : 'fail';
              return newStatuses;
            });

            const descriptionParts = [
              allRequiredTestsPassed 
                ? `All ${requiredTestResults.length} required tests passed`
                : `Some required tests failed`
            ];
            
            if (ignoredTestsCount > 0) {
              descriptionParts.push(`(${ignoredTestsCount} test${ignoredTestsCount > 1 ? 's' : ''} ignored)`);
            }

            toast({
              title: allRequiredTestsPassed ? "Flash Complete" : "Flash Complete - Tests Failed",
              description: descriptionParts.join(' '),
              variant: allRequiredTestsPassed ? "default" : "destructive",
              duration: 1500,
            });
            
            return currentTestResults;
          });
        } else if (data.type === 'flash_failed') {
          const pcbNum = parseInt(data.pcb);
          
          setPcbStatuses(prevStatuses => {
            const newStatuses = [...prevStatuses];
            newStatuses[pcbNum - 1] = 'fail';
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
        } else if (data.type === 'complete') {
          // Process exit - this means Python script fully finished
          eventSource.close();
          
          // Calculate final results using current state
          setTimeout(() => {
            const currentStatuses = pcbStatusesRef.current;
            const finalPassCount = currentStatuses.filter(s => s === 'pass').length;
            const finalFailCount = currentStatuses.filter(s => s === 'fail').length;
            const totalTested = finalPassCount + finalFailCount;
            const successRate = totalTested > 0 ? Math.round((finalPassCount / totalTested) * 100) : 0;
            
            toast({
              title: "🎉 All PCBs Processed",
              description: `Results: ${finalPassCount} passed, ${finalFailCount} failed (${successRate}% success rate)`,
              duration: 5000,
            });

            // Find first untested PCB or stay on last one
            const firstUntestedIndex = currentStatuses.findIndex(s => s === 'untested');
            if (firstUntestedIndex !== -1) {
              setActivePCB(firstUntestedIndex + 1);
            }
          }, 100);
        } else if (data.type === 'error') {
          eventSource.close();
          toast({
            title: "Error",
            description: data.message,
            variant: "destructive",
          });
        }
      };

      eventSource.onerror = (error) => {
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
    setTerminalMessages([]);
    setPcbTestResults(
      Array(6).fill([]).map(() => [
        { name: 'RTC configured', passed: false },
        { name: 'RTC initialized', passed: false },
        { name: 'LACC initialized', passed: false },
        { name: 'HACC initialized', passed: false },
        { name: 'PSRAM initialized', passed: false },
        { name: 'exFlash initialized', passed: false },
        { name: 'Ext NFC configured', passed: false },
        { name: 'Ext NFC initialized', passed: false },
      ])
    );
    
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
  
  const isButtonDisabled = allTested;
  
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800">SONORA Sensor Tester</h1>
          <p className="text-gray-600 mt-2">Test your sensor boards and track results</p>
        </div>
        
        <TestConfiguration 
          requiredTests={requiredTests}
          onRequiredTestsChange={setRequiredTests}
        />
        
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
          
          {/* Terminal Output Display */}
          {terminalMessages.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-700 mb-3">Terminal Output</h2>
              <div className="bg-black text-green-400 font-mono text-sm p-4 rounded-lg h-64 overflow-y-auto">
                {terminalMessages.map((msg, idx) => (
                  <div key={idx} className="mb-1">{msg}</div>
                ))}
                <div ref={terminalEndRef} />
              </div>
            </div>
          )}
          
          <div className="flex justify-center">
            <ControlPanel 
              onPass={handlePass}
              onCancel={handleCancel}
              onReset={handleReset}
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
