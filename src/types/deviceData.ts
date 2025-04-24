
export interface DeviceData {
  RTC: {
    configured: boolean;
    initialized: boolean;
  };
  lowRateAccel: {
    initialized: boolean;
    selfTestPassed: boolean;
  };
  hiRateAccel: {
    initialized: boolean;
  };
  extTemperatureSensor: {
    initialized: boolean;
  };
  PSRAM: {
    initialized: boolean;
    testPassed: boolean;
  };
  exFlash: {
    initialized: boolean;
  };
  extNFC: {
    configuring: boolean;
    initialized: boolean;
  };
  deviceInfo: {
    DUID: string;
    MAC_Address: string;
    Hw_ver: string;
    Appl_ver: string;
    Ble_adv_name: string;
  };
  voltages: {
    VSC_V: number;
    VMC_V: number;
  };
  detectionParameters: {
    DET_RANGE_G: number;
    DET_SAMPLING_HZ: number;
    DET_TRESHOLD_G: number;
    DET_TRESHOLD_MS: number;
  };
}

export const mockDeviceData: DeviceData = {
  RTC: {
    configured: true,
    initialized: true
  },
  lowRateAccel: {
    initialized: true,
    selfTestPassed: true
  },
  hiRateAccel: {
    initialized: true
  },
  extTemperatureSensor: {
    initialized: false
  },
  PSRAM: {
    initialized: true,
    testPassed: true
  },
  exFlash: {
    initialized: true
  },
  extNFC: {
    configuring: true,
    initialized: true
  },
  deviceInfo: {
    DUID: "F0B00D136D4DXXXX",
    MAC_Address: "C7662F8CXXXX",
    Hw_ver: "2.1",
    Appl_ver: "0.4",
    Ble_adv_name: "PRABS_F0B00D136D4DXXX"
  },
  voltages: {
    VSC_V: 3.500,
    VMC_V: 2.964
  },
  detectionParameters: {
    DET_RANGE_G: 8,
    DET_SAMPLING_HZ: 400,
    DET_TRESHOLD_G: 1.000,
    DET_TRESHOLD_MS: 10.000
  }
};
