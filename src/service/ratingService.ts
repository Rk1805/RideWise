import { collection, query, where, getDocs, addDoc, updateDoc, doc, orderBy, limit } from 'firebase/firestore';
import { db } from './firebase';

export interface Rating {
  id?: string;
  rideId: string;
  rating: number;
  comment?: string;
  rideData: {
    from: string;
    to: string;
    driverName: string;
    driverId: string;
    amount: string;
    distance: string;
    date: string;
    time: string;
  };
  createdAt: Date;
  userId: string;
  driverId: string;
  type: 'ride_rating';
}

export interface DriverRating {
  driverId: string;
  driverName: string;
  averageRating: number;
  totalRatings: number;
  ratings: Rating[];
}

class RatingService {
  // Submit a new rating
  async submitRating(ratingData: Omit<Rating, 'id' | 'createdAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'ratings'), {
        ...ratingData,
        createdAt: new Date(),
      });
      
      // Update the ride history to mark as rated
      const historyQuery = query(
        collection(db, 'history'),
        where('rideID', '==', ratingData.rideId)
      );
      
      const historySnapshot = await getDocs(historyQuery);
      if (!historySnapshot.empty) {
        const historyDoc = historySnapshot.docs[0];
        await updateDoc(historyDoc.ref, {
          userRating: ratingData.rating,
          userComment: ratingData.comment || '',
          ratedAt: new Date(),
          isRated: true
        });
      }
      
      return docRef.id;
    } catch (error) {
      console.error('Error submitting rating:', error);
      throw new Error('Failed to submit rating');
    }
  }

  // Get all ratings for admin view
  async getAllRatings(): Promise<Rating[]> {
    try {
      const q = query(
        collection(db, 'ratings'),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const ratings: Rating[] = [];
      
      snapshot.forEach((doc) => {
        ratings.push({
          id: doc.id,
          ...doc.data()
        } as Rating);
      });
      
      return ratings;
    } catch (error) {
      console.error('Error fetching ratings:', error);
      throw new Error('Failed to fetch ratings');
    }
  }

  // Get ratings for a specific driver
  async getDriverRatings(driverId: string): Promise<Rating[]> {
    try {
      const q = query(
        collection(db, 'ratings'),
        where('driverId', '==', driverId),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const ratings: Rating[] = [];
      
      snapshot.forEach((doc) => {
        ratings.push({
          id: doc.id,
          ...doc.data()
        } as Rating);
      });
      
      return ratings;
    } catch (error) {
      console.error('Error fetching driver ratings:', error);
      throw new Error('Failed to fetch driver ratings');
    }
  }

  // Get average rating for a driver
  async getDriverAverageRating(driverId: string): Promise<number> {
    try {
      const ratings = await this.getDriverRatings(driverId);
      
      if (ratings.length === 0) {
        return 0;
      }
      
      const totalRating = ratings.reduce((sum, rating) => sum + rating.rating, 0);
      return Math.round((totalRating / ratings.length) * 10) / 10; // Round to 1 decimal place
    } catch (error) {
      console.error('Error calculating driver average rating:', error);
      return 0;
    }
  }

  // Get top rated drivers
  async getTopRatedDrivers(limitCount: number = 10): Promise<DriverRating[]> {
    try {
      const allRatings = await this.getAllRatings();
      
      // Group ratings by driver
      const driverRatingsMap = new Map<string, Rating[]>();
      
      allRatings.forEach(rating => {
        if (!driverRatingsMap.has(rating.driverId)) {
          driverRatingsMap.set(rating.driverId, []);
        }
        driverRatingsMap.get(rating.driverId)!.push(rating);
      });
      
      // Calculate average ratings for each driver
      const driverRatings: DriverRating[] = [];
      
      driverRatingsMap.forEach((ratings, driverId) => {
        const averageRating = ratings.reduce((sum, rating) => sum + rating.rating, 0) / ratings.length;
        const driverName = ratings[0]?.rideData.driverName || 'Unknown Driver';
        
        driverRatings.push({
          driverId,
          driverName,
          averageRating: Math.round(averageRating * 10) / 10,
          totalRatings: ratings.length,
          ratings
        });
      });
      
      // Sort by average rating (descending) and return top drivers
      return driverRatings
        .sort((a, b) => b.averageRating - a.averageRating)
        .slice(0, limitCount);
    } catch (error) {
      console.error('Error fetching top rated drivers:', error);
      throw new Error('Failed to fetch top rated drivers');
    }
  }

  // Get rating statistics for admin dashboard
  async getRatingStatistics(): Promise<{
    totalRatings: number;
    averageRating: number;
    ratingDistribution: { [key: number]: number };
    totalDrivers: number;
  }> {
    try {
      const allRatings = await this.getAllRatings();
      
      if (allRatings.length === 0) {
        return {
          totalRatings: 0,
          averageRating: 0,
          ratingDistribution: {},
          totalDrivers: 0
        };
      }
      
      // Calculate total and average
      const totalRating = allRatings.reduce((sum, rating) => sum + rating.rating, 0);
      const averageRating = Math.round((totalRating / allRatings.length) * 10) / 10;
      
      // Calculate rating distribution
      const ratingDistribution: { [key: number]: number } = {};
      for (let i = 1; i <= 5; i++) {
        ratingDistribution[i] = allRatings.filter(rating => rating.rating === i).length;
      }
      
      // Count unique drivers
      const uniqueDrivers = new Set(allRatings.map(rating => rating.driverId));
      
      return {
        totalRatings: allRatings.length,
        averageRating,
        ratingDistribution,
        totalDrivers: uniqueDrivers.size
      };
    } catch (error) {
      console.error('Error calculating rating statistics:', error);
      throw new Error('Failed to calculate rating statistics');
    }
  }

  // Check if a ride has been rated
  async isRideRated(rideId: string): Promise<boolean> {
    try {
      const q = query(
        collection(db, 'ratings'),
        where('rideId', '==', rideId)
      );
      
      const snapshot = await getDocs(q);
      return !snapshot.empty;
    } catch (error) {
      console.error('Error checking if ride is rated:', error);
      return false;
    }
  }
}

export const ratingService = new RatingService();
export default ratingService;
