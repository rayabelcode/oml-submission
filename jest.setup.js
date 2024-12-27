jest.mock('firebase/firestore', () => ({
  Timestamp: {
    fromDate: (date) => ({
      toDate: () => date
    }),
    now: () => ({
      toDate: () => new Date(),
      seconds: Math.floor(Date.now() / 1000),
      nanoseconds: (Date.now() % 1000) * 1000000
    })
  }
}));
