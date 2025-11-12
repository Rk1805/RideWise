import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../service/themeContext';
import { doc, updateDoc, collection, addDoc, getDoc } from 'firebase/firestore';
import { db, auth } from '../service/firebase';

interface RideRatingModalProps {
  visible: boolean;
  onClose: () => void;
  rideId: string;
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
}

const RideRatingModal: React.FC<RideRatingModalProps> = ({
  visible,
  onClose,
  rideId,
  rideData,
}) => {
  const { isDarkMode } = useTheme();
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const handleStarPress = (starValue: number) => {
    setRating(starValue);
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Error', 'Please provide a rating before submitting');
      return;
    }

    try {
      setSubmitting(true);

      // Add rating to ratings collection
      await addDoc(collection(db, 'ratings'), {
        rideId,
        rating,
        rideData,
        createdAt: new Date(),
        userId: auth.currentUser?.uid || 'unknown',
        driverId: rideData.driverId,
        type: 'ride_rating'
      });

      // Check if the ride history document exists before updating
      const historyRef = doc(db, 'history', rideId);
      const historyDoc = await getDoc(historyRef);
      
      if (historyDoc.exists()) {
        // Update the ride history to mark as rated
        await updateDoc(historyRef, {
          userRating: rating,
          ratedAt: new Date(),
          isRated: true
        });
      } else {
        // If document doesn't exist, create it with rating
        await addDoc(collection(db, 'history'), {
          rideId,
          userRating: rating,
          ratedAt: new Date(),
          isRated: true,
          ...rideData,
          createdAt: new Date(),
          userId: auth.currentUser?.uid || 'unknown',
        });
      }

      Alert.alert(
        'Thank You!',
        'Your rating has been submitted successfully.',
        [{ text: 'OK', onPress: onClose }]
      );
    } catch (error) {
      console.error('Error submitting rating:', error);
      Alert.alert('Error', 'Failed to submit rating. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = () => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <TouchableOpacity
          key={i}
          onPress={() => handleStarPress(i)}
          style={styles.starButton}
        >
          <Text style={[
            styles.star,
            { color: i <= rating ? '#FFD700' : '#ccc' }
          ]}>
            ★
          </Text>
        </TouchableOpacity>
      );
    }
    return stars;
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[
          styles.modalContent,
          { backgroundColor: isDarkMode ? '#1f2937' : '#ffffff' }
        ]}>
          <Text style={[
            styles.modalTitle,
            { color: isDarkMode ? '#f3f4f6' : '#1f2937' }
          ]}>
            Rate Your Ride Experience
          </Text>

          <View style={[
            styles.rideInfo,
            { backgroundColor: isDarkMode ? '#374151' : '#f8fafc' }
          ]}>
            <Text style={[
              styles.rideRoute,
              { color: isDarkMode ? '#d1d5db' : '#4b5563' }
            ]}>
              {rideData.from} → {rideData.to}
            </Text>
            <Text style={[
              styles.rideDetails,
              { color: isDarkMode ? '#9ca3af' : '#6b7280' }
            ]}>
              Driver: {rideData.driverName} | {rideData.date} at {rideData.time}
            </Text>
            <Text style={[
              styles.rideDetails,
              { color: isDarkMode ? '#9ca3af' : '#6b7280' }
            ]}>
              Distance: {rideData.distance} km | Amount: ${rideData.amount}
            </Text>
          </View>

          <View style={styles.ratingSection}>
            <Text style={[
              styles.ratingLabel,
              { color: isDarkMode ? '#d1d5db' : '#4b5563' }
            ]}>
              How would you rate your overall experience?
            </Text>
            <View style={styles.starsContainer}>
              {renderStars()}
            </View>
            <Text style={[
              styles.ratingText,
              { color: isDarkMode ? '#9ca3af' : '#6b7280' }
            ]}>
              {rating > 0 ? `${rating} out of 5 stars` : 'Tap to rate'}
            </Text>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={submitting}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.button,
                styles.submitButton,
                rating === 0 && styles.disabledButton
              ]}
              onPress={handleSubmit}
              disabled={submitting || rating === 0}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>Submit Rating</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  rideInfo: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  rideRoute: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  rideDetails: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 4,
  },
  ratingSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  ratingLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 16,
    textAlign: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  starButton: {
    padding: 8,
  },
  star: {
    fontSize: 40,
  },
  ratingText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  cancelButton: {
    backgroundColor: '#6b7280',
  },
  submitButton: {
    backgroundColor: '#3b82f6',
  },
  disabledButton: {
    backgroundColor: '#9ca3af',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default RideRatingModal;
