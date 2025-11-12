import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker } from 'react-native-maps';

interface RideMapProps {
  startLat: number;
  startLong: number;
  endLat: number;
  endLong: number;
  height?: number;
}

const RideMap: React.FC<RideMapProps> = ({ 
  startLat, 
  startLong, 
  endLat, 
  endLong, 
  height = 150 
}) => {
  // Calculate center point between start and end
  const centerLat = (startLat + endLat) / 2;
  const centerLong = (startLong + endLong) / 2;
  
  // Calculate delta for zoom level
  const latDelta = Math.abs(startLat - endLat) * 1.5 + 0.01;
  const longDelta = Math.abs(startLong - endLong) * 1.5 + 0.01;

  return (
    <View style={[styles.container, { height }]}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: centerLat,
          longitude: centerLong,
          latitudeDelta: Math.max(latDelta, 0.01),
          longitudeDelta: Math.max(longDelta, 0.01),
        }}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        mapType="standard"
      >
        {/* Start location marker */}
        <Marker
          coordinate={{
            latitude: startLat,
            longitude: startLong,
          }}
          title="Pickup Location"
          description="Start point"
          pinColor="#10b981"
        />
        
        {/* End location marker */}
        <Marker
          coordinate={{
            latitude: endLat,
            longitude: endLong,
          }}
          title="Drop Location"
          description="Destination"
          pinColor="#ef4444"
        />
      </MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  map: {
    flex: 1,
  },
});

export default RideMap;
