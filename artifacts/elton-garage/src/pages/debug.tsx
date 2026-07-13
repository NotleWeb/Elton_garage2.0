import { useEffect, useState } from 'react';

export default function Debug() {
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const allLogs: string[] = [];
    const startTime = Date.now();

    const log = (msg: string) => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      const entry = `[${elapsed}s] ${msg}`;
      allLogs.push(entry);
      setLogs([...allLogs]);
    };

    const originalLog = console.log;
    const originalError = console.error;

    console.log = (...args) => {
      log(args.join(' '));
      originalLog.apply(console, args);
    };

    console.error = (...args) => {
      log('ERROR: ' + args.join(' '));
      originalError.apply(console, args);
    };

    // Get info
    log(`User Agent: ${navigator.userAgent}`);
    log(`API URL: ${import.meta.env.VITE_API_URL || '[NOT SET]'}`);
    log(`Skip Login: ${import.meta.env.VITE_SKIP_LOGIN || '[NOT SET]'}`);
    log(`Storage Available: ${typeof localStorage !== 'undefined'}`);

    try {
      const token = localStorage.getItem('elton_garage_token');
      log(`Auth Token: ${token ? '[SET]' : '[EMPTY]'}`);
    } catch (e) {
      log(`Storage Error: ${e}`);
    }

    return () => {
      console.log = originalLog;
      console.error = originalError;
    };
  }, []);

  return (
    <div style={{
      padding: '20px',
      fontFamily: 'monospace',
      fontSize: '12px',
      backgroundColor: '#000',
      color: '#0f0',
      minHeight: '100vh',
    }}>
      <h1 style={{ margin: 0, marginBottom: '20px' }}>DEBUG</h1>
      <div style={{
        backgroundColor: '#001',
        padding: '15px',
        borderRadius: '4px',
        border: '1px solid #0f0',
        maxHeight: '80vh',
        overflow: 'auto',
      }}>
        {logs.map((log, i) => (
          <div key={i} style={{ marginBottom: '4px', lineHeight: '1.4' }}>
            {log}
          </div>
        ))}
      </div>
      <div style={{ marginTop: '20px' }}>
        <button
          onClick={() => {
            localStorage.clear();
            window.location.href = '/';
          }}
          style={{
            padding: '10px 20px',
            marginRight: '10px',
            backgroundColor: '#f00',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            borderRadius: '4px',
            fontSize: '12px',
          }}
        >
          Clear & Go Home
        </button>
      </div>
    </div>
  );
}
