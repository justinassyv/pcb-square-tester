
import React, { useState } from 'react';
import PCBSquare from '@/components/PCBSquare';
import ControlPanel from '@/components/ControlPanel';
import { toast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';

type PCBStatus = 'untested' | 'pass' | 'fail';

const Index = () => {
  const [pcbStatuses, setPcbStatuses] = useState<PCBStatus[]>(Array(6).fill('untested'));
  const [activePCB, setActivePCB] = useState<number>(1);
  
  const handlePass = () => {
    const newStatuses = [...pcbStatuses];
    newStatuses[activePCB - 1] = 'pass';
    setPcbStatuses(newStatuses);
    
    toast({
      title: "Test Passed",
      description: `PCB #${activePCB} test completed successfully.`,
      variant: "default",
    });
    
    // Auto move to next untested PCB
    moveToNextUntested();
  };
  
  const handleFail = () => {
    const newStatuses = [...pcbStatuses];
    newStatuses[activePCB - 1] = 'fail';
    setPcbStatuses(newStatuses);
    
    toast({
      title: "Test Failed",
      description: `PCB #${activePCB} test failed.`,
      variant: "destructive",
    });
    
    // Auto move to next untested PCB
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
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800">PCB Square Tester</h1>
          <p className="text-gray-600 mt-2">Test your PCB boards and track results</p>
        </div>
        
        <Card className="p-6 bg-white shadow-md rounded-lg">
          <div className="mb-6">
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
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-8">
              {pcbStatuses.map((status, index) => (
                <PCBSquare 
                  key={index}
                  number={index + 1}
                  status={status}
                  isActive={activePCB === index + 1}
                  onClick={() => handleSquareClick(index)}
                />
              ))}
            </div>
          </div>
          
          <div className="flex justify-center">
            <ControlPanel 
              onPass={handlePass}
              onFail={handleFail}
              onNext={handleNext}
              onReset={handleReset}
              currentPCB={activePCB}
              disabled={{
                pass: pcbStatuses[activePCB - 1] !== 'untested' || allTested,
                fail: pcbStatuses[activePCB - 1] !== 'untested' || allTested,
                next: allTested
              }}
            />
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Index;
