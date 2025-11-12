// Test Database Population Script
// Run this in your Firebase console or as a Node.js script

// Sample data for Firestore history collection
const sampleHistoryData = {
  userID: "testUser123",
  rideID: "ride_001",
  from: "Mumbai Airport",
  to: "Mumbai Central",
  startLat: 19.0896,
  startLong: 72.8656,
  endLat: 19.0760,
  endLong: 72.8777,
  date: "Mon Jan 15 2024",
  time: "14:30:00",
  amount: "450",
  distance: "12.5",
  duration: 1800,
  status: "requested",
  type: "individual",
  timestamp: new Date(),
  userName: "Test User"
};

// Sample data for Realtime Database rideRequests
const sampleRideRequest = {
  userId: "testUser123",
  userName: "Test User",
  from: "Mumbai Airport",
  to: "Mumbai Central",
  startLat: 19.0896,
  startLong: 72.8656,
  endLat: 19.0760,
  endLong: 72.8777,
  date: "Mon Jan 15 2024",
  time: "14:30:00",
  requestedAt: Date.now(),
  status: "requested",
  distance: 12.5,
  duration: 1800,
  amount: 450,
  driverAccepted: false
};

console.log("Sample History Data for Firestore:");
console.log(JSON.stringify(sampleHistoryData, null, 2));

console.log("\nSample Ride Request for Realtime Database:");
console.log(JSON.stringify(sampleRideRequest, null, 2));

// Instructions:
// 1. Copy the sampleHistoryData to your Firestore 'history' collection
// 2. Copy the sampleRideRequest to your Realtime Database 'rideRequests' node
// 3. Test your app to see if data is properly displayed
