import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useTheme } from '../service/themeContext';
import { feedbackService } from '../service/feedbackService';
import { auth } from '../service/firebase';

interface FeedbackFormRouteParams {
  rideId: string;
  from: string;
  to: string;
  driverName?: string;
  driverId?: string;
  amount?: number;
  distance?: number;
  duration?: number;
}

const FeedbackForm = () => {
  const { isDarkMode } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ FeedbackForm: FeedbackFormRouteParams }, 'FeedbackForm'>>();
  const { rideId, from, to, driverName, driverId, amount, distance, duration } = route.params;

  const [loading, setLoading] = useState(false);
  const [rating, setRating] = useState({
    overall: 0,
    punctuality: 0,
    cleanliness: 0,
    safety: 0,
    communication: 0,
    value: 0,
  });
  const [feedback, setFeedback] = useState({
    title: '',
    description: '',
    category: 'positive' as 'positive' | 'negative' | 'suggestion' | 'complaint',
    tags: [] as string[],
  });
  const [isAnonymous, setIsAnonymous] = useState(false);

  const ratingCategories = [
    { key: 'overall', label: 'Overall Experience', icon: '⭐' },
    { key: 'punctuality', label: 'Punctuality', icon: '⏰' },
    { key: 'cleanliness', label: 'Vehicle Cleanliness', icon: '🧹' },
    { key: 'safety', label: 'Safety & Driving', icon: '🛡️' },
    { key: 'communication', label: 'Communication', icon: '💬' },
    { key: 'value', label: 'Value for Money', icon: '💰' },
  ];

  const feedbackCategories = [
    { key: 'positive', label: 'Positive', icon: '😊', color: '#4CAF50' },
    { key: 'negative', label: 'Negative', icon: '😞', color: '#f44336' },
    { key: 'suggestion', label: 'Suggestion', icon: '💡', color: '#2196F3' },
    { key: 'complaint', label: 'Complaint', icon: '⚠️', color: '#FF9800' },
  ];

  const availableTags = [
    'Professional Driver', 'Clean Vehicle', 'Safe Driving', 'Good Communication',
    'On Time', 'Friendly Service', 'Reasonable Price', 'Smooth Ride',
    'Poor Communication', 'Dirty Vehicle', 'Rough Driving', 'Late Arrival',
    'High Price', 'Uncomfortable', 'Great Experience', 'Would Recommend',
    'Needs Improvement', 'Excellent Service', 'Good Value', 'Fast Service'
  ];

  const handleRatingChange = (category: string, value: number) => {
    setRating(prev => ({
      ...prev,
      [category]: value,
    }));
  };

  const handleCategoryChange = (category: 'positive' | 'negative' | 'suggestion' | 'complaint') => {
    setFeedback(prev => ({
      ...prev,
      category,
    }));
  };

  const handleTagToggle = (tag: string) => {
    setFeedback(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag],
    }));
  };

  const validateForm = () => {
    if (rating.overall === 0) {
      Alert.alert('Error', 'Please provide an overall rating');
      return false;
    }

    if (!feedback.title.trim()) {
      Alert.alert('Error', 'Please provide a feedback title');
      return false;
    }

    if (!feedback.description.trim()) {
      Alert.alert('Error', 'Please provide feedback description');
      return false;
    }

    if (feedback.tags.length === 0) {
      Alert.alert('Error', 'Please select at least one tag');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const rideData = {
        from,
        to,
        driverId,
        driverName,
        amount: amount || 0,
        distance: distance || 0,
        duration: duration || 0,
      };

      await feedbackService.createFeedbackFromRide(
        rideId,
        rideData,
        rating,
        feedback,
        isAnonymous
      );

      Alert.alert(
        'Thank You!',
        'Your feedback has been submitted successfully. We appreciate your input!',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('Error submitting feedback:', error);
      Alert.alert('Error', 'Failed to submit feedback. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderRatingCategory = ({ item }: { item: any }) => (
    <View style={styles.ratingCategory}>
      <View style={styles.ratingHeader}>
        <Text style={styles.ratingIcon}>{item.icon}</Text>
        <Text style={[styles.ratingLabel, { color: isDarkMode ? '#ffffff' : '#333333' }]}>
          {item.label}
        </Text>
      </View>
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            style={styles.starButton}
            onPress={() => handleRatingChange(item.key, star)}
          >
            <Text style={[
              styles.star,
              { color: star <= rating[item.key as keyof typeof rating] ? '#FFD700' : '#ccc' }
            ]}>
              ★
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={[styles.ratingValue, { color: isDarkMode ? '#cccccc' : '#666666' }]}>
        {rating[item.key as keyof typeof rating]}/5
      </Text>
    </View>
  );

  const renderFeedbackCategory = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[
        styles.categoryButton,
        {
          backgroundColor: feedback.category === item.key ? item.color : isDarkMode ? '#2a2a2a' : '#f0f0f0',
          borderColor: feedback.category === item.key ? item.color : isDarkMode ? '#444' : '#ddd',
        }
      ]}
      onPress={() => handleCategoryChange(item.key)}
    >
      <Text style={styles.categoryIcon}>{item.icon}</Text>
      <Text style={[
        styles.categoryLabel,
        { color: feedback.category === item.key ? '#ffffff' : isDarkMode ? '#cccccc' : '#666666' }
      ]}>
        {item.label}
      </Text>
    </TouchableOpacity>
  );

  const renderTag = ({ item }: { item: string }) => (
    <TouchableOpacity
      style={[
        styles.tagButton,
        {
          backgroundColor: feedback.tags.includes(item) ? '#2196F3' : isDarkMode ? '#2a2a2a' : '#f0f0f0',
          borderColor: feedback.tags.includes(item) ? '#2196F3' : isDarkMode ? '#444' : '#ddd',
        }
      ]}
      onPress={() => handleTagToggle(item)}
    >
      <Text style={[
        styles.tagText,
        { color: feedback.tags.includes(item) ? '#ffffff' : isDarkMode ? '#cccccc' : '#666666' }
      ]}>
        {item}
      </Text>
    </TouchableOpacity>
  );

  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Rate Your Ride</Text>
        <Text style={styles.subtitle}>
          Help us improve by sharing your experience
        </Text>

        {/* Ride Summary */}
        <View style={[styles.rideSummary, { backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' }]}>
          <Text style={[styles.summaryTitle, { color: isDarkMode ? '#ffffff' : '#333333' }]}>
            Trip Summary
          </Text>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: isDarkMode ? '#cccccc' : '#666666' }]}>From:</Text>
            <Text style={[styles.summaryValue, { color: isDarkMode ? '#ffffff' : '#333333' }]}>{from}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: isDarkMode ? '#cccccc' : '#666666' }]}>To:</Text>
            <Text style={[styles.summaryValue, { color: isDarkMode ? '#ffffff' : '#333333' }]}>{to}</Text>
          </View>
          {driverName && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: isDarkMode ? '#cccccc' : '#666666' }]}>Driver:</Text>
              <Text style={[styles.summaryValue, { color: isDarkMode ? '#ffffff' : '#333333' }]}>{driverName}</Text>
            </View>
          )}
          {amount && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: isDarkMode ? '#cccccc' : '#666666' }]}>Amount:</Text>
              <Text style={[styles.summaryValue, { color: isDarkMode ? '#ffffff' : '#333333' }]}>₹{amount}</Text>
            </View>
          )}
        </View>

        {/* Rating Categories */}
        <View style={styles.ratingSection}>
          <Text style={[styles.sectionTitle, { color: isDarkMode ? '#ffffff' : '#333333' }]}>
            Rate Your Experience
          </Text>
          <FlatList
            data={ratingCategories}
            renderItem={renderRatingCategory}
            keyExtractor={(item) => item.key}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
          />
        </View>

        {/* Feedback Category */}
        <View style={styles.categorySection}>
          <Text style={[styles.sectionTitle, { color: isDarkMode ? '#ffffff' : '#333333' }]}>
            Feedback Category
          </Text>
          <View style={styles.categoryButtons}>
            <FlatList
              data={feedbackCategories}
              renderItem={renderFeedbackCategory}
              keyExtractor={(item) => item.key}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryList}
            />
          </View>
        </View>

        {/* Feedback Title */}
        <View style={[styles.inputSection, { backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' }]}>
          <Text style={[styles.inputLabel, { color: isDarkMode ? '#ffffff' : '#333333' }]}>
            Feedback Title *
          </Text>
          <TextInput
            style={[styles.input, { 
              backgroundColor: isDarkMode ? '#1e1e1e' : '#f8f9fa',
              color: isDarkMode ? '#ffffff' : '#333333',
              borderColor: isDarkMode ? '#444' : '#ddd'
            }]}
            value={feedback.title}
            onChangeText={(text) => setFeedback(prev => ({ ...prev, title: text }))}
            placeholder="Brief summary of your feedback"
            placeholderTextColor={isDarkMode ? '#666' : '#999'}
            maxLength={100}
          />
        </View>

        {/* Feedback Description */}
        <View style={[styles.inputSection, { backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' }]}>
          <Text style={[styles.inputLabel, { color: isDarkMode ? '#ffffff' : '#333333' }]}>
            Detailed Feedback *
          </Text>
          <TextInput
            style={[styles.textArea, { 
              backgroundColor: isDarkMode ? '#1e1e1e' : '#f8f9fa',
              color: isDarkMode ? '#ffffff' : '#333333',
              borderColor: isDarkMode ? '#444' : '#ddd'
            }]}
            value={feedback.description}
            onChangeText={(text) => setFeedback(prev => ({ ...prev, description: text }))}
            placeholder="Share your detailed experience, suggestions, or concerns..."
            placeholderTextColor={isDarkMode ? '#666' : '#999'}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            maxLength={500}
          />
        </View>

        {/* Tags Selection */}
        <View style={styles.tagsSection}>
          <Text style={[styles.sectionTitle, { color: isDarkMode ? '#ffffff' : '#333333' }]}>
            Select Tags (Choose relevant ones)
          </Text>
          <FlatList
            data={availableTags}
            renderItem={renderTag}
            keyExtractor={(item) => item}
            numColumns={2}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.tagsList}
          />
        </View>

        {/* Anonymous Option */}
        <View style={[styles.anonymousSection, { backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' }]}>
          <TouchableOpacity
            style={styles.anonymousRow}
            onPress={() => setIsAnonymous(!isAnonymous)}
          >
            <View style={[styles.checkbox, { backgroundColor: isAnonymous ? '#2196F3' : 'transparent' }]}>
              {isAnonymous && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={[styles.anonymousText, { color: isDarkMode ? '#ffffff' : '#333333' }]}>
              Submit feedback anonymously
            </Text>
          </TouchableOpacity>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: '#4CAF50' }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.submitButtonText}>Submit Feedback</Text>
          )}
        </TouchableOpacity>

        {/* Cancel Button */}
        <TouchableOpacity
          style={[styles.cancelButton, { backgroundColor: isDarkMode ? '#444' : '#f0f0f0' }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.cancelButtonText, { color: isDarkMode ? '#ffffff' : '#333333' }]}>
            Cancel
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginTop: 40,
    marginBottom: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  subtitle: {
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 30,
    opacity: 0.9,
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  rideSummary: {
    padding: 20,
    borderRadius: 15,
    marginBottom: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    textAlign: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  ratingSection: {
    marginBottom: 25,
  },
  ratingCategory: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
  },
  ratingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  ratingIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  ratingLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 10,
  },
  starButton: {
    padding: 5,
  },
  star: {
    fontSize: 30,
  },
  ratingValue: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
  },
  categorySection: {
    marginBottom: 25,
  },
  categoryButtons: {
    marginBottom: 15,
  },
  categoryList: {
    paddingHorizontal: 5,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    marginHorizontal: 5,
    borderWidth: 2,
    minWidth: 120,
    justifyContent: 'center',
  },
  categoryIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  inputSection: {
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    minHeight: 120,
  },
  tagsSection: {
    marginBottom: 25,
  },
  tagsList: {
    paddingHorizontal: 5,
  },
  tagButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 5,
    marginBottom: 10,
    borderWidth: 1,
    flex: 1,
    alignItems: 'center',
  },
  tagText: {
    fontSize: 14,
    fontWeight: '500',
  },
  anonymousSection: {
    padding: 20,
    borderRadius: 15,
    marginBottom: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  anonymousRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#2196F3',
    marginRight: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  anonymousText: {
    fontSize: 16,
    fontWeight: '500',
  },
  submitButton: {
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cancelButton: {
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default FeedbackForm;
