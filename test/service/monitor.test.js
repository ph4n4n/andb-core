const MonitorService = require('../../src/service/monitor');

describe('MonitorService', () => {
  let monitor;
  const mockMonitorService = {
    getProcessList: jest.fn().mockResolvedValue(['p1']),
    getStatus: jest.fn().mockResolvedValue({ status: 'ok' }),
    getVariables: jest.fn().mockResolvedValue({ var: 'val' }),
    getVersion: jest.fn().mockResolvedValue('8.0.0'),
    getConnections: jest.fn().mockResolvedValue(10),
    getTransactions: jest.fn().mockResolvedValue([]),
  };
  const mockDriver = {
    connect: jest.fn().mockResolvedValue(),
    disconnect: jest.fn().mockResolvedValue(),
    getMonitoringService: jest.fn(() => mockMonitorService),
  };

  const mockGetDBDestination = jest.fn(env => ({ database: 'db' }));
  const mockGetDBName = jest.fn(env => 'db');

  beforeEach(() => {
    jest.clearAllMocks();
    monitor = new MonitorService({
      driver: jest.fn().mockResolvedValue(mockDriver),
      getDBDestination: mockGetDBDestination,
      getDBName: mockGetDBName
    });
  });

  test('monitor PROCESSLIST calls driver correctly', async () => {
    const monitorFn = monitor.monitor('PROCESSLIST');
    const result = await monitorFn('DEV');
    expect(mockMonitorService.getProcessList).toHaveBeenCalled();
    expect(result.data).toEqual(['p1']);
  });

  test('monitor STATUS calls driver correctly', async () => {
    const monitorFn = monitor.monitor('STATUS');
    const result = await monitorFn('DEV');
    expect(mockMonitorService.getStatus).toHaveBeenCalled();
    expect(result.data).toEqual({ status: 'ok' });
  });

  test('monitor throws error for unknown field', async () => {
    const monitorFn = monitor.monitor('UNKNOWN');
    await expect(monitorFn('DEV')).rejects.toThrow('Unknown monitor field: UNKNOWN');
  });

  test('all supported fields work', async () => {
    const fields = ['PROCESSLIST', 'STATUS', 'VARIABLES', 'VERSION', 'CONNECTIONS', 'TRANSACTIONS'];
    for (const field of fields) {
      const monitorFn = monitor.monitor(field);
      await monitorFn('DEV');
    }
    expect(mockMonitorService.getProcessList).toHaveBeenCalled();
    expect(mockMonitorService.getStatus).toHaveBeenCalled();
    expect(mockMonitorService.getVariables).toHaveBeenCalled();
    expect(mockMonitorService.getVersion).toHaveBeenCalled();
    expect(mockMonitorService.getConnections).toHaveBeenCalled();
    expect(mockMonitorService.getTransactions).toHaveBeenCalled();
  });
});
