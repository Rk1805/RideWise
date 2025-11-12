import { auth, db } from './firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  where, 
  onSnapshot,
  getDocs,
  orderBy,
  limit
} from 'firebase/firestore';
import { notificationService } from './notificationService';

export interface FeedbackData {
  id: string;
  rideId: string;
  userId: string;
  userName: string;
  driverId?: string;
  driverName?: string;
  rating: {
    overall: number; // 1-5 stars
    punctuality: number; // 1-5 stars
    cleanliness: number; // 1-5 stars
    safety: number; // 1-5 stars
    communication: number; // 1-5 stars
    value: number; // 1-5 stars
  };
  feedback: {
    title: string;
    description: string;
    category: 'positive' | 'negative' | 'suggestion' | 'complaint';
    tags: string[];
  };
  rideDetails: {
    from: string;
    to: string;
    date: Date;
    amount: number;
    distance: number;
    duration: number;
  };
  status: 'pending' | 'submitted' | 'reviewed' | 'resolved';
  adminNotes?: string;
  createdAt: Date;
  updatedAt: Date;
  isAnonymous: boolean;
}

export interface FeedbackAnalytics {
  totalFeedback: number;
  averageRating: number;
  ratingDistribution: {
    '1': number;
    '2': number;
    '3': number;
    '4': number;
    '5': number;
  };
  categoryBreakdown: {
    positive: number;
    negative: number;
    suggestion: number;
    complaint: number;
  };
  topTags: Array<{ tag: string; count: number }>;
  monthlyTrends: Array<{ month: string; averageRating: number; count: number }>;
  driverPerformance: Array<{ driverId: string; driverName: string; averageRating: number; totalRides: number }>;
}

export interface FeedbackSummary {
  rideId: string;
  totalRatings: number;
  averageRating: number;
  feedbackCount: number;
  lastFeedback?: Date;
}

class FeedbackService {
  private userFeedback: Map<string, FeedbackData> = new Map();
  private feedbackListener: (() => void) | null = null;

  constructor() {
    this.initializeService();
  }

  // Initialize the service
  private async initializeService() {
    if (auth.currentUser) {
      await this.loadUserFeedback();
    }
  }

  // Load user's feedback
  private async loadUserFeedback() {
    if (!auth.currentUser) return;

    try {
      const feedbackQuery = query(
        collection(db, 'feedback'),
        where('userId', '==', auth.currentUser.uid),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(feedbackQuery);
      this.userFeedback.clear();

      snapshot.forEach((doc) => {
        const feedback = { id: doc.id, ...doc.data() } as FeedbackData;
        this.userFeedback.set(doc.id, feedback);
      });

      console.log(`Loaded ${this.userFeedback.size} feedback entries`);
    } catch (error) {
      console.error('Error loading user feedback:', error);
    }
  }

  // Submit feedback for a ride
  async submitFeedback(feedbackData: Omit<FeedbackData, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<string> {
    try {
      const feedbackDoc: Omit<FeedbackData, 'id'> = {
        ...feedbackData,
        status: 'submitted',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const docRef = await addDoc(collection(db, 'feedback'), feedbackDoc);
      
      // Add to local cache
      this.userFeedback.set(docRef.id, { id: docRef.id, ...feedbackDoc });

      // Send notification to admin about new feedback
      await this.notifyAdminAboutFeedback(docRef.id, feedbackData);

      // Send feedback request notification to user
      await notificationService.sendFeedbackRequestNotification(
        feedbackData.userId,
        {
          id: docRef.id,
          from: feedbackData.rideDetails.from,
          to: feedbackData.rideDetails.to,
        }
      );

      console.log('Feedback submitted:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Error submitting feedback:', error);
      throw error;
    }
  }

  // Create feedback from ride data
  async createFeedbackFromRide(
    rideId: string,
    rideData: any,
    rating: FeedbackData['rating'],
    feedback: FeedbackData['feedback'],
    isAnonymous: boolean = false
  ): Promise<string> {
    const feedbackData: Omit<FeedbackData, 'id' | 'createdAt' | 'updatedAt' | 'status'> = {
      rideId,
      userId: auth.currentUser?.uid || '',
      userName: auth.currentUser?.displayName || 'Anonymous',
      driverId: rideData.driverId,
      driverName: rideData.driverName,
      rating,
      feedback,
      rideDetails: {
        from: rideData.from,
        to: rideData.to,
        date: new Date(rideData.date),
        amount: parseFloat(rideData.amount) || 0,
        distance: parseFloat(rideData.distance) || 0,
        duration: parseInt(rideData.duration) || 0,
      },
      isAnonymous,
    };

    return await this.submitFeedback(feedbackData);
  }

  // Update feedback
  async updateFeedback(feedbackId: string, updates: Partial<FeedbackData>): Promise<void> {
    try {
      const feedbackRef = doc(db, 'feedback', feedbackId);
      await updateDoc(feedbackRef, {
        ...updates,
        updatedAt: new Date(),
      });

      // Update local cache
      const feedback = this.userFeedback.get(feedbackId);
      if (feedback) {
        Object.assign(feedback, updates, { updatedAt: new Date() });
      }

      console.log('Feedback updated:', feedbackId);
    } catch (error) {
      console.error('Error updating feedback:', error);
      throw error;
    }
  }

  // Delete feedback
  async deleteFeedback(feedbackId: string): Promise<void> {
    try {
      // Remove from local cache
      this.userFeedback.delete(feedbackId);

      // Mark as deleted in database
      const feedbackRef = doc(db, 'feedback', feedbackId);
      await updateDoc(feedbackRef, {
        status: 'deleted',
        updatedAt: new Date(),
      });

      console.log('Feedback deleted:', feedbackId);
    } catch (error) {
      console.error('Error deleting feedback:', error);
      throw error;
    }
  }

  // Get feedback for a specific ride
  async getFeedbackForRide(rideId: string): Promise<FeedbackData[]> {
    try {
      const q = query(
        collection(db, 'feedback'),
        where('rideId', '==', rideId),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      const feedback: FeedbackData[] = [];

      snapshot.forEach((doc) => {
        feedback.push({
          id: doc.id,
          ...doc.data()
        } as FeedbackData);
      });

      return feedback;
    } catch (error) {
      console.error('Error getting feedback for ride:', error);
      return [];
    }
  }

  // Get user's feedback
  async getUserFeedback(userId: string, callback: (feedback: FeedbackData[]) => void) {
    const q = query(
      collection(db, 'feedback'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const feedback: FeedbackData[] = [];
      snapshot.forEach((doc) => {
        feedback.push({
          id: doc.id,
          ...doc.data()
        } as FeedbackData);
      });
      
      callback(feedback);
    });
  }

  // Get all feedback (for admin)
  async getAllFeedback(callback: (feedback: FeedbackData[]) => void) {
    const q = query(
      collection(db, 'feedback'),
      orderBy('createdAt', 'desc'),
      limit(100) // Limit to last 100 feedback entries
    );

    return onSnapshot(q, (snapshot) => {
      const feedback: FeedbackData[] = [];
      snapshot.forEach((doc) => {
        feedback.push({
          id: doc.id,
          ...doc.data()
        } as FeedbackData);
      });
      
      callback(feedback);
    });
  }

  // Get feedback analytics
  async getFeedbackAnalytics(): Promise<FeedbackAnalytics> {
    try {
      const q = query(collection(db, 'feedback'));
      const snapshot = await getDocs(q);
      
      const analytics: FeedbackAnalytics = {
        totalFeedback: 0,
        averageRating: 0,
        ratingDistribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
        categoryBreakdown: { positive: 0, negative: 0, suggestion: 0, complaint: 0 },
        topTags: [],
        monthlyTrends: [],
        driverPerformance: [],
      };

      const tags: Map<string, number> = new Map();
      const driverRatings: Map<string, { total: number; count: number; name: string }> = new Map();
      const monthlyData: Map<string, { total: number; count: number }> = new Map();
      let totalRating = 0;

      snapshot.forEach((doc) => {
        const feedback = doc.data() as FeedbackData;
        
        analytics.totalFeedback++;
        totalRating += feedback.rating.overall;
        
        // Rating distribution
        const rating = feedback.rating.overall.toString() as keyof typeof analytics.ratingDistribution;
        analytics.ratingDistribution[rating]++;

        // Category breakdown
        analytics.categoryBreakdown[feedback.feedback.category]++;

        // Tags
        feedback.feedback.tags.forEach(tag => {
          tags.set(tag, (tags.get(tag) || 0) + 1);
        });

        // Driver performance
        if (feedback.driverId) {
          const driver = driverRatings.get(feedback.driverId);
          if (driver) {
            driver.total += feedback.rating.overall;
            driver.count++;
          } else {
            driverRatings.set(feedback.driverId, {
              total: feedback.rating.overall,
              count: 1,
              name: feedback.driverName || 'Unknown',
            });
          }
        }

        // Monthly trends
        const month = new Date(feedback.createdAt).toISOString().slice(0, 7); // YYYY-MM
        const monthData = monthlyData.get(month);
        if (monthData) {
          monthData.total += feedback.rating.overall;
          monthData.count++;
        } else {
          monthlyData.set(month, { total: feedback.rating.overall, count: 1 });
        }
      });

      // Calculate averages
      analytics.averageRating = analytics.totalFeedback > 0 ? totalRating / analytics.totalFeedback : 0;

      // Top tags
      analytics.topTags = Array.from(tags.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Driver performance
      analytics.driverPerformance = Array.from(driverRatings.entries())
        .map(([driverId, data]) => ({
          driverId,
          driverName: data.name,
          averageRating: data.total / data.count,
          totalRides: data.count,
        }))
        .sort((a, b) => b.averageRating - a.averageRating)
        .slice(0, 10);

      // Monthly trends
      analytics.monthlyTrends = Array.from(monthlyData.entries())
        .map(([month, data]) => ({
          month,
          averageRating: data.total / data.count,
          count: data.count,
        }))
        .sort((a, b) => a.month.localeCompare(b.month));

      return analytics;
    } catch (error) {
      console.error('Error getting feedback analytics:', error);
      throw error;
    }
  }

  // Get feedback summary for a ride
  async getFeedbackSummaryForRide(rideId: string): Promise<FeedbackSummary | null> {
    try {
      const feedback = await this.getFeedbackForRide(rideId);
      
      if (feedback.length === 0) return null;

      const totalRatings = feedback.length;
      const totalRating = feedback.reduce((sum, f) => sum + f.rating.overall, 0);
      const averageRating = totalRating / totalRatings;
      const lastFeedback = feedback[0].createdAt;

      return {
        rideId,
        totalRatings,
        averageRating,
        feedbackCount: feedback.length,
        lastFeedback,
      };
    } catch (error) {
      console.error('Error getting feedback summary for ride:', error);
      return null;
    }
  }

  // Search feedback
  async searchFeedback(searchTerm: string, filters?: {
    category?: string;
    minRating?: number;
    maxRating?: number;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<FeedbackData[]> {
    try {
      let q = query(collection(db, 'feedback'));

      // Apply filters
      if (filters?.category) {
        q = query(q, where('feedback.category', '==', filters.category));
      }
      if (filters?.minRating) {
        q = query(q, where('rating.overall', '>=', filters.minRating));
      }
      if (filters?.maxRating) {
        q = query(q, where('rating.overall', '<=', filters.maxRating));
      }

      const snapshot = await getDocs(q);
      let feedback: FeedbackData[] = [];

      snapshot.forEach((doc) => {
        feedback.push({
          id: doc.id,
          ...doc.data()
        } as FeedbackData);
      });

      // Apply date filters and search term filtering
      if (filters?.dateFrom || filters?.dateTo) {
        feedback = feedback.filter(f => {
          const createdAt = new Date(f.createdAt);
          if (filters.dateFrom && createdAt < filters.dateFrom) return false;
          if (filters.dateTo && createdAt > filters.dateTo) return false;
          return true;
        });
      }

      // Apply search term filtering
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        feedback = feedback.filter(f => 
          f.feedback.title.toLowerCase().includes(term) ||
          f.feedback.description.toLowerCase().includes(term) ||
          f.rideDetails.from.toLowerCase().includes(term) ||
          f.rideDetails.to.toLowerCase().includes(term) ||
          f.driverName?.toLowerCase().includes(term) ||
          f.feedback.tags.some(tag => tag.toLowerCase().includes(term))
        );
      }

      return feedback.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
      console.error('Error searching feedback:', error);
      return [];
    }
  }

  // Notify admin about new feedback
  private async notifyAdminAboutFeedback(feedbackId: string, feedbackData: any): Promise<void> {
    try {
      // This would typically send a notification to admin users
      // For now, we'll just log it
      console.log('New feedback submitted:', feedbackId, feedbackData);
      
      // You could implement admin notification logic here
      // await notificationService.sendAdminNotification('New feedback received', feedbackData);
    } catch (error) {
      console.error('Error notifying admin about feedback:', error);
    }
  }

  // Check if user has submitted feedback for a ride
  hasFeedbackForRide(rideId: string): boolean {
    return Array.from(this.userFeedback.values()).some(f => f.rideId === rideId);
  }

  // Cleanup method
  cleanup() {
    if (this.feedbackListener) {
      this.feedbackListener();
    }
    this.userFeedback.clear();
  }
}

// Export singleton instance
export const feedbackService = new FeedbackService();
export default feedbackService;
