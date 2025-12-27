# TODO: Modify Anomaly Freeze Logic

## Tasks
- [x] Modify main.js to remove immediate freeze on anomaly detection
- [x] Ensure anomalies decrement attempts and update display
- [x] Freeze screen only after 3 attempts (anomalies or failures)
- [x] Test the changes to ensure no impact on typing sequence or other features

## Details
- Current: Anomaly sets attempts=0 and freezes immediately
- New: Anomaly decrements attempts, updates display, freezes only if attempts <=0
- Keep other logic intact (alert, etc.)
