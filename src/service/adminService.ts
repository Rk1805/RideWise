import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { signUp } from './auth';

export interface AdminUser {
  uid: string;
  email: string;
  username: string;
  userType: 'admin';
  createdAt: Date;
  isActive: boolean;
  permissions: string[];
}

export class AdminService {
  /**
   * Create a new admin user
   * This should only be used by existing admins or during initial setup
   */
  static async createAdminUser(
    email: string, 
    password: string, 
    username: string,
    permissions: string[] = ['read', 'write', 'delete']
  ): Promise<AdminUser | null> {
    try {
      // Create the user account
      const userCredential = await signUp(email, password);
      
      if (!userCredential) {
        throw new Error('Failed to create user account');
      }

      const uid = userCredential.uid;

      // Create admin user document
      const adminUser: AdminUser = {
        uid,
        email,
        username,
        userType: 'admin',
        createdAt: new Date(),
        isActive: true,
        permissions
      };

      // Save to users collection
      await setDoc(doc(db, 'users', uid), {
        uid,
        email,
        username,
        userType: 'admin',
        createdAt: new Date(),
        isActive: true,
        permissions
      });

      console.log('Admin user created successfully:', uid);
      return adminUser;

    } catch (error) {
      console.error('Error creating admin user:', error);
      return null;
    }
  }

  /**
   * Verify if a user has admin privileges
   */
  static async verifyAdminAccess(uid: string): Promise<boolean> {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      
      if (!userDoc.exists()) {
        return false;
      }

      const userData = userDoc.data();
      return userData.userType === 'admin' && userData.isActive === true;

    } catch (error) {
      console.error('Error verifying admin access:', error);
      return false;
    }
  }

  /**
   * Get admin user details
   */
  static async getAdminUser(uid: string): Promise<AdminUser | null> {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      
      if (!userDoc.exists()) {
        return null;
      }

      const userData = userDoc.data();
      
      if (userData.userType !== 'admin') {
        return null;
      }

      return userData as AdminUser;

    } catch (error) {
      console.error('Error getting admin user:', error);
      return null;
    }
  }

  /**
   * Update admin permissions
   */
  static async updateAdminPermissions(
    uid: string, 
    permissions: string[]
  ): Promise<boolean> {
    try {
      await updateDoc(doc(db, 'users', uid), {
        permissions,
        updatedAt: new Date()
      });
      
      return true;
    } catch (error) {
      console.error('Error updating admin permissions:', error);
      return false;
    }
  }

  /**
   * Deactivate admin user
   */
  static async deactivateAdmin(uid: string): Promise<boolean> {
    try {
      await updateDoc(doc(db, 'users', uid), {
        isActive: false,
        updatedAt: new Date()
      });
      
      return true;
    } catch (error) {
      console.error('Error deactivating admin:', error);
      return false;
    }
  }

  /**
   * Get all admin users (for super admin use)
   */
  static async getAllAdminUsers(): Promise<AdminUser[]> {
    try {
      // Note: This would require a Firestore query with proper indexing
      // For now, we'll return an empty array as this is a sensitive operation
      console.warn('getAllAdminUsers: This operation requires proper Firestore security rules');
      return [];
    } catch (error) {
      console.error('Error getting all admin users:', error);
      return [];
    }
  }
}

export default AdminService;
