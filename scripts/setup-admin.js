/**
 * Setup Script for Creating First Admin User
 * 
 * This script helps create the first admin user for the RideWise application.
 * Run this script once during initial setup to create your first admin account.
 * 
 * Usage:
 * 1. Make sure you have Firebase credentials configured
 * 2. Run: node scripts/setup-admin.js
 * 3. Follow the prompts to create your admin account
 */

const readline = require('readline');
const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

// Firebase configuration - Update these values with your Firebase project details
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function setupAdmin() {
  try {
    console.log('🚀 RideWise Admin Setup Script');
    console.log('================================\n');

    // Get admin details
    const email = await question('Enter admin email: ');
    const password = await question('Enter admin password (min 6 characters): ');
    const confirmPassword = await question('Confirm admin password: ');
    const username = await question('Enter admin username: ');

    // Validate inputs
    if (password !== confirmPassword) {
      console.error('❌ Passwords do not match!');
      rl.close();
      return;
    }

    if (password.length < 6) {
      console.error('❌ Password must be at least 6 characters long!');
      rl.close();
      return;
    }

    if (!email || !username) {
      console.error('❌ Email and username are required!');
      rl.close();
      return;
    }

    console.log('\n🔄 Creating admin account...');

    // Create user account
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;

    console.log('✅ User account created successfully');

    // Create admin user document
    const adminUser = {
      uid,
      email,
      username,
      userType: 'admin',
      createdAt: new Date(),
      isActive: true,
      permissions: ['read', 'write', 'delete', 'admin'],
      profile: {
        firstName: username,
        lastName: 'Admin'
      }
    };

    await setDoc(doc(db, 'users', uid), adminUser);
    console.log('✅ Admin user document created successfully');

    console.log('\n🎉 Admin setup completed successfully!');
    console.log('================================');
    console.log(`Admin UID: ${uid}`);
    console.log(`Email: ${email}`);
    console.log(`Username: ${username}`);
    console.log(`User Type: ${adminUser.userType}`);
    console.log(`Permissions: ${adminUser.permissions.join(', ')}`);
    console.log('\nYou can now log in to the RideWise admin panel using these credentials.');

  } catch (error) {
    console.error('❌ Error during admin setup:', error.message);
    
    if (error.code === 'auth/email-already-in-use') {
      console.error('This email is already registered. Please use a different email or reset the password.');
    } else if (error.code === 'auth/weak-password') {
      console.error('Password is too weak. Please use a stronger password.');
    } else if (error.code === 'auth/invalid-email') {
      console.error('Invalid email format. Please enter a valid email address.');
    }
  } finally {
    rl.close();
  }
}

// Check if Firebase config is properly set
if (firebaseConfig.apiKey === "YOUR_API_KEY") {
  console.error('❌ Please update the Firebase configuration in this script before running it.');
  console.error('You can find your Firebase config in your Firebase project settings.');
  process.exit(1);
}

// Run the setup
setupAdmin();
