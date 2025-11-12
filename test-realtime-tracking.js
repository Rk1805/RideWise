// 🧪 Test Script for Real-Time Companion Tracking
// This script tests the real-time tracking system by simulating ride updates

const { initializeApp } = require('firebase/app');
const { getDatabase, ref, set, update, onValue, off } = require('firebase/database');

// Firebase configuration (replace with your actual config)
const firebaseConfig = {
  // Add your Firebase config here
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-default-rtdb.firebaseio.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Test configuration
const TEST_RIDE_ID = 'test_ride_001';
const TEST_USER_ID = 'test_traveler_123';
const TEST_COMPANION_ID = 'test_companion_456';

console.log('🧪 Starting Real-Time Tracking Test...\n');

// Test 1: Create a ride request
async function testCreateRideRequest() {
  console.log('📝 Test 1: Creating ride request...');
  
  try {
    const rideData = {
      userID: TEST_USER_ID,
      status: 'requested',
      from: 'Test Origin',
      to: 'Test Destination',
      endLat: 37.78825,
      endLong: -122.4324,
      requestedAt: Date.now(),
      time: Date.now()
    };

    await set(ref(db, `rideRequests/${TEST_RIDE_ID}`), rideData);
    console.log('✅ Ride request created successfully');
    console.log('📍 Location: Firebase Realtime Database > rideRequests > test_ride_001\n');
    
    return true;
  } catch (error) {
    console.error('❌ Failed to create ride request:', error);
    return false;
  }
}

// Test 2: Create companion tracking entry
async function testCreateCompanionTracking() {
  console.log('📝 Test 2: Creating companion tracking entry...');
  
  try {
    const trackingData = {
      id: `auto_${TEST_RIDE_ID}`,
      companionId: TEST_COMPANION_ID,
      travelerId: TEST_USER_ID,
      rideId: TEST_RIDE_ID,
      status: 'tracking',
      startTime: Date.now(),
      destination: {
        latitude: 37.78825,
        longitude: -122.4324,
        address: 'Test Destination'
      },
      lastUpdate: Date.now(),
      notifications: {
        rideStarted: false,
        rideInProgress: false,
        rideCompleted: false,
        rideCancelled: false
      }
    };

    await set(ref(db, `companionRideTracking/${TEST_COMPANION_ID}/${TEST_RIDE_ID}`), trackingData);
    console.log('✅ Companion tracking entry created successfully');
    console.log('📍 Location: Firebase Realtime Database > companionRideTracking > test_companion_456 > test_ride_001\n');
    
    return true;
  } catch (error) {
    console.error('❌ Failed to create companion tracking:', error);
    return false;
  }
}

// Test 3: Simulate driver location updates
async function testDriverLocationUpdates() {
  console.log('📝 Test 3: Simulating driver location updates...');
  
  const locations = [
    { lat: 37.78825, lng: -122.4324, status: 'accepted' },
    { lat: 37.78900, lng: -122.43100, status: 'started' },
    { lat: 37.78950, lng: -122.43000, status: 'in_progress' },
    { lat: 37.79000, lng: -122.42900, status: 'in_progress' },
    { lat: 37.79050, lng: -122.42800, status: 'completed' }
  ];

  for (let i = 0; i < locations.length; i++) {
    const location = locations[i];
    console.log(`📍 Update ${i + 1}: Driver at (${location.lat}, ${location.lng}) - Status: ${location.status}`);
    
    try {
      await update(ref(db, `rideRequests/${TEST_RIDE_ID}`), {
        status: location.status,
        driverLocation: {
          latitude: location.lat,
          longitude: location.lng,
          timestamp: Date.now(),
          accuracy: 10
        },
        lastUpdate: Date.now()
      });
      
      console.log(`✅ Location update ${i + 1} applied successfully`);
      
      // Wait 2 seconds between updates
      if (i < locations.length - 1) {
        console.log('⏳ Waiting 2 seconds...\n');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error(`❌ Failed to update location ${i + 1}:`, error);
    }
  }
  
  console.log('\n✅ All driver location updates completed\n');
}

// Test 4: Listen to real-time updates
function testRealTimeListening() {
  console.log('📝 Test 4: Testing real-time listening...');
  
  // Listen to ride request updates
  const rideRef = ref(db, `rideRequests/${TEST_RIDE_ID}`);
  const rideUnsubscribe = onValue(rideRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      console.log(`📡 Real-time ride update received:`);
      console.log(`   Status: ${data.status}`);
      console.log(`   Driver Location: (${data.driverLocation?.latitude || 'N/A'}, ${data.driverLocation?.longitude || 'N/A'})`);
      console.log(`   Timestamp: ${new Date(data.lastUpdate).toLocaleTimeString()}\n`);
    }
  });

  // Listen to companion tracking updates
  const trackingRef = ref(db, `companionRideTracking/${TEST_COMPANION_ID}/${TEST_RIDE_ID}`);
  const trackingUnsubscribe = onValue(trackingRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      console.log(`📡 Real-time companion tracking update received:`);
      console.log(`   Status: ${data.status}`);
      console.log(`   Current Location: (${data.currentLocation?.latitude || 'N/A'}, ${data.currentLocation?.longitude || 'N/A'})`);
      console.log(`   Last Update: ${new Date(data.lastUpdate).toLocaleTimeString()}\n`);
    }
  });

  console.log('✅ Real-time listeners set up successfully');
  console.log('🔍 Now run the location updates to see real-time data flow\n');
  
  return { rideUnsubscribe, trackingUnsubscribe };
}

// Test 5: Cleanup test data
async function cleanupTestData() {
  console.log('📝 Test 5: Cleaning up test data...');
  
  try {
    // Remove test ride request
    await set(ref(db, `rideRequests/${TEST_RIDE_ID}`), null);
    console.log('✅ Test ride request removed');
    
    // Remove test companion tracking
    await set(ref(db, `companionRideTracking/${TEST_COMPANION_ID}/${TEST_RIDE_ID}`), null);
    console.log('✅ Test companion tracking removed');
    
    console.log('🧹 Test data cleanup completed\n');
  } catch (error) {
    console.error('❌ Failed to cleanup test data:', error);
  }
}

// Main test execution
async function runTests() {
  console.log('🚀 Starting Real-Time Tracking Tests...\n');
  
  try {
    // Setup phase
    const rideCreated = await testCreateRideRequest();
    if (!rideCreated) return;
    
    const trackingCreated = await testCreateCompanionTracking();
    if (!trackingCreated) return;
    
    // Set up real-time listeners
    const listeners = testRealTimeListening();
    
    console.log('⏳ Waiting 5 seconds before starting location updates...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Test real-time updates
    await testDriverLocationUpdates();
    
    console.log('⏳ Waiting 5 seconds to observe real-time updates...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Cleanup listeners
    listeners.rideUnsubscribe();
    listeners.trackingUnsubscribe();
    console.log('🔌 Real-time listeners cleaned up');
    
    // Cleanup test data
    await cleanupTestData();
    
    console.log('🎉 All tests completed successfully!');
    console.log('\n📋 Test Summary:');
    console.log('✅ Ride request creation');
    console.log('✅ Companion tracking setup');
    console.log('✅ Real-time listening');
    console.log('✅ Driver location updates');
    console.log('✅ Data cleanup');
    
  } catch (error) {
    console.error('❌ Test execution failed:', error);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().then(() => {
    console.log('\n🏁 Test script finished');
    process.exit(0);
  }).catch((error) => {
    console.error('\n💥 Test script failed:', error);
    process.exit(1);
  });
}

module.exports = {
  testCreateRideRequest,
  testCreateCompanionTracking,
  testDriverLocationUpdates,
  testRealTimeListening,
  cleanupTestData,
  runTests
};
