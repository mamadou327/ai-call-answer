import { useRef, useMemo, useState, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Sphere, Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import { supabase } from '@/integrations/supabase/client';

interface ActivityPoint {
  id: string;
  lat: number;
  lng: number;
  type: 'booking' | 'business';
  name: string;
  timestamp: Date;
}

interface ArcData {
  id: string;
  start: THREE.Vector3;
  end: THREE.Vector3;
  color: string;
}

// Geocoding lookup - maps cities/regions to approximate coordinates
const cityCoordinates: Record<string, { lat: number; lng: number }> = {
  // UK Cities
  'london': { lat: 51.5074, lng: -0.1278 },
  'manchester': { lat: 53.4808, lng: -2.2426 },
  'birmingham': { lat: 52.4862, lng: -1.8904 },
  'leeds': { lat: 53.8008, lng: -1.5491 },
  'liverpool': { lat: 53.4084, lng: -2.9916 },
  'newcastle': { lat: 54.9783, lng: -1.6178 },
  'bristol': { lat: 51.4545, lng: -2.5879 },
  'sheffield': { lat: 53.3811, lng: -1.4701 },
  'belfast': { lat: 54.5973, lng: -5.9301 },
  'glasgow': { lat: 55.8642, lng: -4.2518 },
  'edinburgh': { lat: 55.9533, lng: -3.1883 },
  'cardiff': { lat: 51.4816, lng: -3.1791 },
  // US Cities
  'new york': { lat: 40.7128, lng: -74.0060 },
  'los angeles': { lat: 34.0522, lng: -118.2437 },
  'chicago': { lat: 41.8781, lng: -87.6298 },
  'houston': { lat: 29.7604, lng: -95.3698 },
  'miami': { lat: 25.7617, lng: -80.1918 },
  'san francisco': { lat: 37.7749, lng: -122.4194 },
  'seattle': { lat: 47.6062, lng: -122.3321 },
  'boston': { lat: 42.3601, lng: -71.0589 },
  // European Cities
  'paris': { lat: 48.8566, lng: 2.3522 },
  'berlin': { lat: 52.5200, lng: 13.4050 },
  'madrid': { lat: 40.4168, lng: -3.7038 },
  'rome': { lat: 41.9028, lng: 12.4964 },
  'amsterdam': { lat: 52.3676, lng: 4.9041 },
  'dublin': { lat: 53.3498, lng: -6.2603 },
  // Countries as fallback
  'uk': { lat: 54.0, lng: -2.0 },
  'united kingdom': { lat: 54.0, lng: -2.0 },
  'england': { lat: 52.0, lng: -1.0 },
  'usa': { lat: 39.8283, lng: -98.5795 },
  'united states': { lat: 39.8283, lng: -98.5795 },
  'germany': { lat: 51.1657, lng: 10.4515 },
  'france': { lat: 46.2276, lng: 2.2137 },
  'spain': { lat: 40.4637, lng: -3.7492 },
  'italy': { lat: 41.8719, lng: 12.5674 },
  'ireland': { lat: 53.1424, lng: -7.6921 },
  'canada': { lat: 56.1304, lng: -106.3468 },
  'australia': { lat: -25.2744, lng: 133.7751 },
};

function extractLocationFromAddress(address: string): { lat: number; lng: number } | null {
  const lowerAddress = address.toLowerCase();
  
  // Try to find a matching city or country
  for (const [key, coords] of Object.entries(cityCoordinates)) {
    if (lowerAddress.includes(key)) {
      // Add some randomness to avoid all points stacking
      return {
        lat: coords.lat + (Math.random() - 0.5) * 2,
        lng: coords.lng + (Math.random() - 0.5) * 2,
      };
    }
  }
  
  // Default to a random location if no match
  return {
    lat: (Math.random() - 0.5) * 120,
    lng: (Math.random() - 0.5) * 360,
  };
}

function latLngToVector3(lat: number, lng: number, radius: number = 2): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  
  return new THREE.Vector3(x, y, z);
}

// Hexagonal globe grid
function HexGlobe() {
  const meshRef = useRef<THREE.Points>(null);
  
  const points = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    const hexSize = 0.05;
    
    // Generate hex grid on sphere
    for (let lat = -80; lat <= 80; lat += 4) {
      const latRad = lat * Math.PI / 180;
      const circumference = Math.cos(latRad) * 2 * Math.PI;
      const numPoints = Math.max(1, Math.floor(circumference / hexSize * 10));
      
      for (let i = 0; i < numPoints; i++) {
        const lng = (i / numPoints) * 360 - 180;
        
        // Check if this point is on land (simplified check)
        if (isLand(lat, lng)) {
          const pos = latLngToVector3(lat, lng, 2);
          positions.push(pos.x, pos.y, pos.z);
          
          // Color based on latitude for visual interest
          const greenIntensity = 0.4 + Math.abs(lat) / 200;
          colors.push(0.2, greenIntensity, 0.4);
        }
      }
    }
    
    return { positions: new Float32Array(positions), colors: new Float32Array(colors) };
  }, []);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.001;
    }
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={points.positions.length / 3}
          array={points.positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={points.colors.length / 3}
          array={points.colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.03}
        vertexColors
        transparent
        opacity={0.8}
        sizeAttenuation
      />
    </points>
  );
}

// Simplified land check (very basic approximation)
function isLand(lat: number, lng: number): boolean {
  // North America
  if (lat > 25 && lat < 70 && lng > -170 && lng < -50) return true;
  // South America
  if (lat > -55 && lat < 15 && lng > -80 && lng < -35) return true;
  // Europe
  if (lat > 35 && lat < 70 && lng > -10 && lng < 60) return true;
  // Africa
  if (lat > -35 && lat < 37 && lng > -20 && lng < 55) return true;
  // Asia
  if (lat > 10 && lat < 75 && lng > 60 && lng < 180) return true;
  // Australia
  if (lat > -45 && lat < -10 && lng > 110 && lng < 160) return true;
  // UK/Ireland specifically
  if (lat > 50 && lat < 60 && lng > -10 && lng < 2) return true;
  
  return false;
}

// Activity point (pulsing dot)
function ActivityPoint({ position, color, label }: { position: THREE.Vector3; color: string; label: string }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  
  useFrame((state) => {
    if (meshRef.current) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.3;
      meshRef.current.scale.setScalar(scale);
    }
  });

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[0.03, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} />
      </mesh>
      {/* Glow effect */}
      <mesh>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} />
      </mesh>
      {hovered && (
        <Html distanceFactor={10}>
          <div className="bg-background/90 backdrop-blur-sm border border-border rounded-md px-2 py-1 text-xs whitespace-nowrap">
            {label}
          </div>
        </Html>
      )}
    </group>
  );
}

// Animated arc between two points
function ActivityArc({ start, end, color, progress }: { start: THREE.Vector3; end: THREE.Vector3; color: string; progress: number }) {
  const curve = useMemo(() => {
    const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const distance = start.distanceTo(end);
    midPoint.normalize().multiplyScalar(2 + distance * 0.3);
    
    return new THREE.QuadraticBezierCurve3(start, midPoint, end);
  }, [start, end]);

  const points = useMemo(() => {
    const pts = curve.getPoints(50);
    const visiblePoints = Math.floor(pts.length * Math.min(progress, 1));
    return pts.slice(0, visiblePoints);
  }, [curve, progress]);

  if (points.length < 2) return null;

  return (
    <Line
      points={points}
      color={color}
      lineWidth={1.5}
      transparent
      opacity={0.6}
    />
  );
}

// Main scene content
function GlobeScene({ activities }: { activities: ActivityPoint[] }) {
  const groupRef = useRef<THREE.Group>(null);
  const [arcs, setArcs] = useState<ArcData[]>([]);
  const [arcProgress, setArcProgress] = useState<Record<string, number>>({});
  
  // Center point (London-ish for hub effect)
  const centerPoint = latLngToVector3(51.5, -0.1, 2);

  useEffect(() => {
    // Create arcs from activities
    const newArcs: ArcData[] = activities.slice(0, 20).map((activity, i) => ({
      id: activity.id,
      start: centerPoint.clone(),
      end: latLngToVector3(activity.lat, activity.lng, 2),
      color: activity.type === 'booking' ? '#3b82f6' : '#22c55e',
    }));
    setArcs(newArcs);
    
    // Animate arcs
    const progressMap: Record<string, number> = {};
    newArcs.forEach((arc, i) => {
      progressMap[arc.id] = 0;
      setTimeout(() => {
        const interval = setInterval(() => {
          setArcProgress(prev => {
            const newProgress = (prev[arc.id] || 0) + 0.05;
            if (newProgress >= 1) {
              clearInterval(interval);
              return { ...prev, [arc.id]: 1 };
            }
            return { ...prev, [arc.id]: newProgress };
          });
        }, 30);
      }, i * 200);
    });
    setArcProgress(progressMap);
  }, [activities]);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.0005;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Base sphere for atmosphere */}
      <Sphere args={[1.98, 64, 64]}>
        <meshBasicMaterial color="#0c1929" transparent opacity={0.9} />
      </Sphere>
      
      {/* Hexagonal land masses */}
      <HexGlobe />
      
      {/* Activity arcs */}
      {arcs.map((arc) => (
        <ActivityArc
          key={arc.id}
          start={arc.start}
          end={arc.end}
          color={arc.color}
          progress={arcProgress[arc.id] || 0}
        />
      ))}
      
      {/* Activity points */}
      {activities.slice(0, 30).map((activity) => (
        <ActivityPoint
          key={activity.id}
          position={latLngToVector3(activity.lat, activity.lng, 2.02)}
          color={activity.type === 'booking' ? '#3b82f6' : '#22c55e'}
          label={`${activity.type === 'booking' ? '📅' : '🏢'} ${activity.name}`}
        />
      ))}
      
      {/* Center hub point */}
      <mesh position={centerPoint.clone().multiplyScalar(1.01)}>
        <sphereGeometry args={[0.04, 16, 16]} />
        <meshBasicMaterial color="#a855f7" />
      </mesh>
    </group>
  );
}

function CameraController() {
  const { camera } = useThree();
  
  useEffect(() => {
    camera.position.set(0, 2, 5);
    camera.lookAt(0, 0, 0);
  }, [camera]);
  
  return <OrbitControls enableZoom={true} enablePan={false} minDistance={3} maxDistance={8} autoRotate={false} />;
}

export function GlobeActivityTracker() {
  const [activities, setActivities] = useState<ActivityPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalBookings: 0, totalBusinesses: 0, activeRegions: 0 });

  useEffect(() => {
    loadActivityData();
  }, []);

  const loadActivityData = async () => {
    try {
      // Load recent businesses
      const { data: businesses } = await supabase
        .from('businesses')
        .select('id, business_name, address, created_at, status')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(50);

      // Load recent bookings
      const { data: bookings } = await supabase
        .from('bookings')
        .select('id, customer_name, business_id, created_at')
        .order('created_at', { ascending: false })
        .limit(100);

      // Get business addresses for bookings
      const businessIds = [...new Set(bookings?.map(b => b.business_id) || [])];
      const { data: businessAddresses } = await supabase
        .from('businesses')
        .select('id, address')
        .in('id', businessIds);

      const addressMap = new Map(businessAddresses?.map(b => [b.id, b.address]) || []);

      const activityPoints: ActivityPoint[] = [];
      const regions = new Set<string>();

      // Add business signups
      businesses?.forEach((biz) => {
        const coords = extractLocationFromAddress(biz.address || 'UK');
        if (coords) {
          activityPoints.push({
            id: `biz-${biz.id}`,
            lat: coords.lat,
            lng: coords.lng,
            type: 'business',
            name: biz.business_name,
            timestamp: new Date(biz.created_at),
          });
          regions.add(biz.address?.split(',').pop()?.trim() || 'Unknown');
        }
      });

      // Add bookings
      bookings?.forEach((booking) => {
        const address = addressMap.get(booking.business_id) || 'UK';
        const coords = extractLocationFromAddress(address);
        if (coords) {
          activityPoints.push({
            id: `book-${booking.id}`,
            lat: coords.lat,
            lng: coords.lng,
            type: 'booking',
            name: booking.customer_name,
            timestamp: new Date(booking.created_at),
          });
        }
      });

      setActivities(activityPoints);
      setStats({
        totalBookings: bookings?.length || 0,
        totalBusinesses: businesses?.length || 0,
        activeRegions: regions.size,
      });
    } catch (error) {
      console.error('Error loading activity data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative w-full h-[600px] bg-gradient-to-b from-background to-muted/20 rounded-lg border overflow-hidden">
      {/* Stats overlay */}
      <div className="absolute top-4 left-4 z-10 space-y-2">
        <div className="bg-background/80 backdrop-blur-sm border rounded-lg px-4 py-2">
          <h3 className="text-lg font-semibold">Global Activity</h3>
          <p className="text-sm text-muted-foreground">Real-time booking & signup locations</p>
        </div>
        <div className="flex gap-2">
          <div className="bg-background/80 backdrop-blur-sm border rounded-lg px-3 py-2">
            <div className="text-2xl font-bold text-primary">{stats.totalBookings}</div>
            <div className="text-xs text-muted-foreground">Bookings</div>
          </div>
          <div className="bg-background/80 backdrop-blur-sm border rounded-lg px-3 py-2">
            <div className="text-2xl font-bold text-green-500">{stats.totalBusinesses}</div>
            <div className="text-xs text-muted-foreground">Businesses</div>
          </div>
          <div className="bg-background/80 backdrop-blur-sm border rounded-lg px-3 py-2">
            <div className="text-2xl font-bold text-purple-500">{stats.activeRegions}</div>
            <div className="text-xs text-muted-foreground">Regions</div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-10 bg-background/80 backdrop-blur-sm border rounded-lg px-4 py-2">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span>Bookings</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span>New Business</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500" />
            <span>Hub</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      ) : (
        <Canvas>
          <Suspense fallback={null}>
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} />
            <GlobeScene activities={activities} />
            <CameraController />
          </Suspense>
        </Canvas>
      )}
    </div>
  );
}
