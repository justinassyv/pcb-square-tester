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
      'RTC initialized': true,
      'LACC initialized': true,
      'HACC initialized': true,
      'PSRAM initialized': true,
      'exFlash initialized': true,
      'Ext NFC configured': true,
      'Ext NFC initialized': true,
      'VSC_V': true,
      'VMC_V': true,
    };
  };

  const [pcbStatuses, setPcbStatuses] = useState<PCBStatus[]>(Array(6).fill('untested'));
  const [activePCB, setActivePCB] = useState<number>(1);
  const [requiredTests, setRequiredTests] = useState<RequiredTests>(loadRequiredTests());
  const [pcbTestResults, setPcbTestResults] = useState<TestResult[][]>(
    Array(6).fill([]).map(() => [
      { name: 'RTC initialized', passed: false },
      { name: 'LACC initialized', passed: false },
      { name: 'HACC initialized', passed: false },
      { name: 'PSRAM initialized', passed: false },
      { name: 'exFlash initialized', passed: false },
      { name: 'Ext NFC configured', passed: false },
      { name: 'Ext NFC initialized', passed: false },
      { name: 'VSC_V', passed: false },
      { name: 'VMC_V', passed: false },
    ])
  );
  const [terminalMessages, setTerminalMessages] = useState<string[]>([]);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  
  // Use ref to track latest statuses for event handlers
  const pcbStatusesRef = useRef(pcbStatuses);
  // Track which PCB is currently being processed (for test result updates)
  const currentProcessingPCBRef = useRef<number>(1);
  // Keep a rolling parse buffer so split UART chunks are still detectable
  const parserCarryRef = useRef<string>('');
  
  useEffect(() => {
    pcbStatusesRef.current = pcbStatuses;
  }, [pcbStatuses]);

  // Save test configuration to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('requiredTests', JSON.stringify(requiredTests));
  }, [requiredTests]);

  const parseTestResults = (message: string): Partial<Record<string, { passed: boolean; value?: string }>> => {
    const results: Partial<Record<string, { passed: boolean; value?: string }>> = {};

    console.log('=== PARSING MESSAGE ===');
    console.log('Original:', message);

    const normalizedMessage = message
      .replace(/\x1B\[[0-9;]*[A-Za-z]/g, ' ')
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (/RTC\s+initialized/i.test(normalizedMessage)) results['RTC initialized'] = { passed: true };

    // Check for LACC - look for the specific pattern
    if (/lacc\s+(failed|error)/i.test(normalizedMessage)) {
      console.log('✗ LACC FAILED');
      results['LACC initialized'] = { passed: false };
    } else if (/lacc\s+initialized/i.test(normalizedMessage)) {
      console.log('✓ LACC SUCCESS');
      results['LACC initialized'] = { passed: true };
    }

    // Check for HACC - look for the specific pattern
    if (/hacc\s+(failed|error)/i.test(normalizedMessage)) {
      console.log('✗ HACC FAILED');
      results['HACC initialized'] = { passed: false };
    } else if (/hacc\s+initialized/i.test(normalizedMessage)) {
      console.log('✓ HACC SUCCESS');
      results['HACC initialized'] = { passed: true };
    }

    // Check for PSRAM - look for the specific pattern
    if (/psram\s+(failed|error)/i.test(normalizedMessage)) {
      console.log('✗ PSRAM FAILED');
      results['PSRAM initialized'] = { passed: false };
    } else if (/psram\s+initialized/i.test(normalizedMessage)) {
      console.log('✓ PSRAM SUCCESS');
      results['PSRAM initialized'] = { passed: true };
    }

    const canonicalMessage = normalizedMessage
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

    const hasCanonicalExFlash =
      canonicalMessage.includes('exflash initialized')
      || canonicalMessage.includes('extflash initialized')
      || canonicalMessage.includes('external flash initialized')
      || canonicalMessage.includes('exflash size')
      || canonicalMessage.includes('extflash size')
      || canonicalMessage.includes('external flash size');

    if (
      /(?:^|\b)(?:ex|ext|external)\s*flash[^a-zA-Z0-9]{0,20}(?:initialized|init(?:ialized)?|ready|detected)\b/i.test(normalizedMessage)
      || /(?:^|\b)(?:ex|ext|external)\s*flash[^\n\r]{0,120}(?:size|capacity)\s*[:=]?\s*\d+(?:\.\d+)?\s*(?:kb|mb)\b/i.test(normalizedMessage)
      || /\bextflash\b[^\n\r]{0,80}(?:initialized|size|capacity)\b/i.test(normalizedMessage)
      || /(?:^|\b)(?:ex|ext|external)\s*flash\s*[:=-][^\n\r]{0,80}\b\d+(?:\.\d+)?\s*(?:kb|mb)\b/i.test(normalizedMessage)
      || /\b(?:ex|ext|external)flash[_\s-]*initialized\s*[:=]\s*(?:true|1|yes|ok|pass(?:ed)?)\b/i.test(normalizedMessage)
      || hasCanonicalExFlash
    ) {
      results['exFlash initialized'] = { passed: true };
    }
    if (/Ext\s+NFC\s+configur/i.test(normalizedMessage)) results['Ext NFC configured'] = { passed: true };
    if (/Ext\s+NFC\s+initialized/i.test(normalizedMessage)) results['Ext NFC initialized'] = { passed: true };

    // Check for VSC_V voltage (pass if between 3.2V and 3.4V)
    // Match patterns like "VSC: 3.291" or "VSC_V: 3.291"
    const vscMatch = message.match(/VSC(?:_V)?:\s*([\d.]+)/i);
    if (vscMatch) {
      const voltage = parseFloat(vscMatch[1]);
      const passed = voltage >= 3.2 && voltage <= 3.4;
      console.log(`VSC_V: ${voltage}V - ${passed ? '✓ PASS' : '✗ FAIL'} (range: 3.2-3.4V)`);
      results['VSC_V'] = { passed, value: `${voltage}V` };
    }

    // Check for VMC_V voltage (pass if between 3.2V and 3.4V)
    // Match patterns like "VMC: 3.298" or "VMC_V: 3.298"
    const vmcMatch = message.match(/VMC(?:_V)?:\s*([\d.]+)/i);
    if (vmcMatch) {
      const voltage = parseFloat(vmcMatch[1]);
      const passed = voltage >= 3.2 && voltage <= 3.4;
      console.log(`VMC_V: ${voltage}V - ${passed ? '✓ PASS' : '✗ FAIL'} (range: 3.2-3.4V)`);
      results['VMC_V'] = { passed, value: `${voltage}V` };
    }

    console.log('Parsed results:', results);
    console.log('======================');
    return results;
  };


  const handlePass = async () => {
    // Reset to PCB 1 at start
    setActivePCB(1);
    // Reset rolling parser carry for a clean new run
    parserCarryRef.current = '';

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
          const rawChunk = typeof data.message === 'string' ? data.message : String(data.message ?? '');

          // Keep channel attribution correct even if SSE "flashing" arrives late or lines are chunked
          const inlineChannelMatch = rawChunk.match(/(?:===\s*)?select(?:ing)?\s+channel\s+(\d+)(?:\s*===)?/i);
          if (inlineChannelMatch) {
            const detectedChannel = parseInt(inlineChannelMatch[1], 10);
            if (!Number.isNaN(detectedChannel)) {
              currentProcessingPCBRef.current = detectedChannel;
              setActivePCB(detectedChannel);
              // Reset carry on channel boundary to avoid previous channel text being re-parsed on new channel
              parserCarryRef.current = '';
            }
          }

          console.log('📥 RAW MESSAGE RECEIVED:', rawChunk);
          const formatted = rawChunk
            .replace(/\. /g, '.\n')  // Line break after periods
            .replace(/MCU reset reasons:/g, '\n🔄 MCU reset reasons:')
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
          const chunkForParsing = `${parserCarryRef.current}${rawChunk}`;
          // Keep only a short boundary tail to bridge split tokens without cross-channel contamination
          parserCarryRef.current = rawChunk.slice(-512);
          const testUpdates = parseTestResults(chunkForParsing);
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
                const update = testUpdates[test.name];
                if (update !== undefined) {
                  if (test.name === 'HACC initialized') {
                    console.log(`🎯 HACC Test Update:`);
                    console.log(`   Current: ${test.passed}`);
                    console.log(`   New: ${update.passed}`);
                  }
                  if (test.name === 'VSC_V' || test.name === 'VMC_V') {
                    console.log(`🔋 ${test.name} Update: ${update.value} - ${update.passed ? 'PASS' : 'FAIL'}`);
                  }
                  return {
                    ...test,
                    passed: update.passed,
                    value: update.value !== undefined ? update.value : test.value
                  };
                }
                return test;
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
        } else if (data.type === 'exflash_detected') {
          const pcbNum = parseInt(data.pcb, 10);
          if (!Number.isNaN(pcbNum) && pcbNum >= 1 && pcbNum <= 6) {
            setPcbTestResults(prevResults => {
              const next = [...prevResults];
              const idx = pcbNum - 1;
              next[idx] = next[idx].map(test =>
                test.name === 'exFlash initialized' ? { ...test, passed: true } : test
              );
              return next;
            });
          }
        } else if (data.type === 'parsed_report') {
          const pcbNum = parseInt(data.pcb, 10);
          if (!Number.isNaN(pcbNum) && pcbNum >= 1 && pcbNum <= 6) {
            setPcbTestResults(prevResults => {
              const next = [...prevResults];
              const idx = pcbNum - 1;
              next[idx] = next[idx].map(test => {
                if (test.name !== 'exFlash initialized') return test;
                if (data.exFlashInitialized === true) return { ...test, passed: true };
                return test;
              });
              return next;
            });
          }
        } else if (data.type === 'flash_complete') {
          const pcbNum = parseInt(data.pcb, 10);
          
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
          const errorType = data.error;
          
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
          
          const errorMessage = errorType === 'jlink_connection' 
            ? `PCB ${pcbNum} - J-Link connection error (check probe connection)`
            : `PCB ${pcbNum} failed to flash`;
          
          toast({
            title: "Flash Failed",
            description: errorMessage,
            variant: "destructive",
            duration: 3000,
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
        { name: 'RTC initialized', passed: false },
        { name: 'LACC initialized', passed: false },
        { name: 'HACC initialized', passed: false },
        { name: 'PSRAM initialized', passed: false },
        { name: 'exFlash initialized', passed: false },
        { name: 'Ext NFC configured', passed: false },
        { name: 'Ext NFC initialized', passed: false },
        { name: 'VSC_V', passed: false },
        { name: 'VMC_V', passed: false },
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
