```markdown
# OnMyList Function Tests

This document outlines how to test our Firebase Cloud Functions locally, focusing on scheduling algorithms and notification system.

## Setup

1. Start the emulators:
```bash
firebase emulators:start --only functions,pubsub,firestore
```

## Available Tests

### 1. Scheduling Algorithm Tests
Tests the core scheduling logic, including timezone handling, edge cases, and error scenarios.
```bash
node testSchedulingAlgorithm.js
```
Followed by:
```bash
curl -X POST http://127.0.0.1:5001/onmylist-app/us-central1/testScheduler
```

This verifies:
- Basic scheduling calculations
- Timezone handling
- Edge cases (DST, year boundaries, etc.)
- Error handling

### 2. Notification System Tests
Tests the notification creation and processing workflow.
```bash
node testNotificationSystem.js
```

This verifies:
- Reminder creation
- Processing triggers
- Status updates

## Common Issues

1. If emulator fails to start:
   - Make sure no other instances are running
   - Clear port 5001 if needed: `lsof -i :5001` then `kill -9 PID`

## File Structure

- `testSchedulingAlgorithm.js`: Tests core scheduling logic
- `testNotificationSystem.js`: Tests notification workflow
- `index.js`: Main functions file

## Notes

- Tests use the emulator to avoid affecting production data
- Stop emulators when done (Ctrl+C)
- Notification delivery testing should be done in production
```
