# OnMyList Cloud Functions Overview

## Core Functions

### 1. Test Notification (scheduledNotification)
**Purpose**: Daily test notification to verify system functionality
**Flow**:
1. Runs daily at 10:20 AM EST
2. Targets specific test user
3. Sends notification with user's tokens
4. Handles invalid tokens cleanup
5. Confirms notification delivery

**Key Features**:
- Isolated test environment
- Token validation
- Error logging
- Device registration cleanup

### 2. Scheduled Reminders (processReminders)
**Purpose**: Process and send regular scheduled reminders
**Flow**:
1. Runs every minute
2. Checks for reminders due within next 5 minutes
3. Filters for:
   - Not notified
   - Type "SCHEDULED"
   - Status "pending"
   - Not snoozed
4. Sends notifications
5. Creates next recurring reminder
6. Updates contact scheduling data

**Key Features**:
- Recurring schedule maintenance
- Contact history updates
- Token validation
- Batch processing

### 3. Custom Date Reminders (processCustomReminders)
**Purpose**: Process one-time custom date reminders
**Flow**:
1. Runs every minute
2. Checks for reminders due within next 5 minutes
3. Filters for:
   - Not notified
   - Type "CUSTOM_DATE"
   - Status "pending"
   - Not snoozed
4. Sends notifications
5. Clears custom scheduling data

**Key Features**:
- One-time reminder handling
- Contact custom date cleanup
- Token validation

### 4. Snoozed Scheduled Reminders (processSnoozedScheduledReminders)
**Purpose**: Process snoozed scheduled reminders and maintain recurring schedule
**Flow**:
1. Runs every minute
2. Checks for reminders due within next 5 minutes
3. Filters for:
   - Type "SCHEDULED"
   - Status "snoozed"
   - Snoozed flag true
4. Sends notifications
5. Calculates next recurring reminder
6. Updates contact scheduling
7. Creates new reminder for next occurrence

**Key Features**:
- Maintains recurring schedule after snooze
- Contact scheduling updates
- Next reminder calculation
- Pattern maintenance

### 5. Snoozed Custom Reminders (processSnoozedCustomReminders)
**Purpose**: Process snoozed custom date reminders
**Flow**:
1. Runs every minute
2. Checks for reminders due within next 5 minutes
3. Filters for:
   - Type "CUSTOM_DATE"
   - Status "snoozed"
   - Snoozed flag true
4. Sends notifications
5. Clears custom scheduling data
6. Updates contact history

**Key Features**:
- Custom date cleanup
- Contact history updates
- One-time reminder completion

## Testing Infrastructure

### Local Testing Setup
```bash
firebase emulators:start --only functions,pubsub,firestore
```

### Test Categories
1. **Scheduling Logic**
   - Base scheduling calculations
   - Timezone handling
   - DST transitions
   - Conflict resolution
   - Pattern recognition

2. **Notification Processing**
   - Token validation
   - Message delivery
   - Error handling
   - Status updates

3. **Data Updates**
   - Contact scheduling
   - Reminder creation
   - History maintenance
   - Batch processing

4. **Error Scenarios**
   - Invalid tokens
   - Missing data
   - Timezone issues
   - Network failures

### Monitoring Points
- Function execution time
- Notification success rate
- Token validity
- Scheduling accuracy
- Error rates
- Pattern recognition success

### Potential Errors
- Check logs to see if Firestore indexes need to be built when deploying new functions

### Links
- Firebase Console: https://console.firebase.google.com/u/0/project/onmylist-app/firestore/databases/
- Cloud Function Logs: https://console.cloud.google.com/logs/