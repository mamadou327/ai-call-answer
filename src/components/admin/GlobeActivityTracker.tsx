import { useState, useEffect, useCallback, useRef } from 'react';
import Globe from 'react-globe.gl';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, DollarSign, CalendarDays, MapPin, Building2, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface ActivityPoint {
  id: string;
  lat: number;
  lng: number;
  type: 'booking' | 'business';
  name: string;
  timestamp: Date;
  businessId: string;
  businessName: string;
  address: string;
  isNew?: boolean;
}

interface ArcData {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: string;
}

interface BusinessDetails {
  id: string;
  business_name: string;
  address: string;
  main_phone: string;
  status: string;
  created_at: string;
  bookings_count: number;
  calls_count: number;
  revenue: number;
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
  'se1': { lat: 51.4975, lng: -0.0870 },
  'new kent': { lat: 51.4933, lng: -0.0931 },
  'harper road': { lat: 51.4950, lng: -0.0980 },
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

function extractLocationFromAddress(address: string): { lat: number; lng: number } {
  const lowerAddress = address.toLowerCase();
  
  // Try to find a matching city or country
  for (const [key, coords] of Object.entries(cityCoordinates)) {
    if (lowerAddress.includes(key)) {
      // Add some randomness to avoid all points stacking (smaller variance)
      return {
        lat: coords.lat + (Math.random() - 0.5) * 0.5,
        lng: coords.lng + (Math.random() - 0.5) * 0.5,
      };
    }
  }
  
  // Default to London with randomness if no match
  return {
    lat: 51.5074 + (Math.random() - 0.5) * 2,
    lng: -0.1278 + (Math.random() - 0.5) * 2,
  };
}

export function GlobeActivityTracker() {
  const globeRef = useRef<any>(null);
  const [activities, setActivities] = useState<ActivityPoint[]>([]);
  const [arcs, setArcs] = useState<ArcData[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ 
    totalBookings: 0, 
    totalBusinesses: 0, 
    activeRegions: 0,
    totalCalls: 0,
    totalRevenue: 0 
  });
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [newActivityFlash, setNewActivityFlash] = useState<string | null>(null);
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessDetails | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();
  const businessAddressCache = useRef<Map<string, string>>(new Map());

  // Hub location (London)
  const hubLat = 51.5074;
  const hubLng = -0.1278;

  // Handle point click
  const handlePointClick = useCallback(async (point: any) => {
    console.log('[Globe] Point clicked:', point);
    
    try {
      // Get business details
      const { data: business } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', point.businessId)
        .maybeSingle();
      
      if (!business) {
        toast({ title: 'Error', description: 'Business not found', variant: 'destructive' });
        return;
      }

      // Get bookings count
      const { count: bookingsCount } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', point.businessId);

      // Get calls count
      const { count: callsCount } = await supabase
        .from('calls_log')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', point.businessId);

      // Get revenue from bookings with services
      const { data: bookingsWithServices } = await supabase
        .from('bookings')
        .select('service_id')
        .eq('business_id', point.businessId)
        .not('service_id', 'is', null);

      let revenue = 0;
      if (bookingsWithServices && bookingsWithServices.length > 0) {
        const serviceIds = [...new Set(bookingsWithServices.map(b => b.service_id).filter(Boolean))];
        if (serviceIds.length > 0) {
          const { data: services } = await supabase
            .from('services')
            .select('id, price')
            .in('id', serviceIds);
          
          if (services) {
            const priceMap = new Map(services.map(s => [s.id, Number(s.price) || 0]));
            revenue = bookingsWithServices.reduce((sum, b) => sum + (priceMap.get(b.service_id!) || 0), 0);
          }
        }
      }

      setSelectedBusiness({
        id: business.id,
        business_name: business.business_name,
        address: business.address,
        main_phone: business.main_phone,
        status: business.status,
        created_at: business.created_at,
        bookings_count: bookingsCount || 0,
        calls_count: callsCount || 0,
        revenue,
      });
      setDialogOpen(true);
    } catch (error) {
      console.error('[Globe] Error fetching business details:', error);
      toast({ title: 'Error', description: 'Failed to load business details', variant: 'destructive' });
    }
  }, [toast]);

  // Handle new booking from realtime
  const handleNewBooking = useCallback(async (payload: any) => {
    console.log('[Globe] New booking received:', payload.new);
    const booking = payload.new;
    
    let address = businessAddressCache.current.get(booking.business_id);
    let businessName = 'Unknown Business';
    
    if (!address) {
      const { data } = await supabase
        .from('businesses')
        .select('address, business_name')
        .eq('id', booking.business_id)
        .maybeSingle();
      address = data?.address || 'UK';
      businessName = data?.business_name || 'Unknown Business';
      businessAddressCache.current.set(booking.business_id, address);
    }
    
    const coords = extractLocationFromAddress(address);
    const newActivity: ActivityPoint = {
      id: `book-${booking.id}`,
      lat: coords.lat,
      lng: coords.lng,
      type: 'booking',
      name: booking.customer_name,
      timestamp: new Date(booking.created_at),
      businessId: booking.business_id,
      businessName,
      address,
      isNew: true,
    };
    
    // Add arc from hub to new point
    setArcs(prev => [...prev, {
      startLat: hubLat,
      startLng: hubLng,
      endLat: coords.lat,
      endLng: coords.lng,
      color: '#3b82f6',
    }]);
    
    setActivities(prev => [newActivity, ...prev.slice(0, 49)]);
    setStats(prev => ({ ...prev, totalBookings: prev.totalBookings + 1 }));
    setNewActivityFlash('booking');
    
    toast({
      title: "📅 New Booking",
      description: `${booking.customer_name} just made a booking`,
    });
    
    setTimeout(() => setNewActivityFlash(null), 2000);
  }, [toast]);

  // Handle new business from realtime
  const handleNewBusiness = useCallback((payload: any) => {
    console.log('[Globe] New business received:', payload.new);
    const business = payload.new;
    
    if (business.status !== 'approved') return;
    
    const coords = extractLocationFromAddress(business.address || 'UK');
    const newActivity: ActivityPoint = {
      id: `biz-${business.id}`,
      lat: coords.lat,
      lng: coords.lng,
      type: 'business',
      name: business.business_name,
      timestamp: new Date(business.created_at),
      businessId: business.id,
      businessName: business.business_name,
      address: business.address || 'UK',
      isNew: true,
    };
    
    businessAddressCache.current.set(business.id, business.address || 'UK');
    
    // Add arc
    setArcs(prev => [...prev, {
      startLat: hubLat,
      startLng: hubLng,
      endLat: coords.lat,
      endLng: coords.lng,
      color: '#22c55e',
    }]);
    
    setActivities(prev => [newActivity, ...prev.slice(0, 49)]);
    setStats(prev => ({ 
      ...prev, 
      totalBusinesses: prev.totalBusinesses + 1,
      activeRegions: prev.activeRegions + 1 
    }));
    setNewActivityFlash('business');
    
    toast({
      title: "🏢 New Business",
      description: `${business.business_name} just signed up`,
    });
    
    setTimeout(() => setNewActivityFlash(null), 2000);
  }, [toast]);

  const handleBusinessUpdate = useCallback((payload: any) => {
    const business = payload.new;
    const oldBusiness = payload.old;
    
    if (oldBusiness?.status !== 'approved' && business.status === 'approved') {
      handleNewBusiness({ new: business });
    }
  }, [handleNewBusiness]);

  useEffect(() => {
    loadActivityData();
    
    const channel = supabase
      .channel('globe-activity-tracker')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bookings' }, handleNewBooking)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'businesses' }, handleNewBusiness)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'businesses' }, handleBusinessUpdate)
      .subscribe((status) => {
        console.log('[Globe] Realtime status:', status);
        if (status === 'SUBSCRIBED') setRealtimeStatus('connected');
        else if (status === 'CHANNEL_ERROR') setRealtimeStatus('error');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [handleNewBooking, handleNewBusiness, handleBusinessUpdate]);

  // Auto-rotate globe
  useEffect(() => {
    if (globeRef.current) {
      globeRef.current.controls().autoRotate = true;
      globeRef.current.controls().autoRotateSpeed = 0.5;
      globeRef.current.pointOfView({ lat: 30, lng: 0, altitude: 2.5 });
    }
  }, [loading]);

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
        .select('id, customer_name, business_id, created_at, service_id')
        .order('created_at', { ascending: false })
        .limit(100);

      // Get total calls
      const { count: totalCalls } = await supabase
        .from('calls_log')
        .select('*', { count: 'exact', head: true });

      // Get all services for revenue calculation
      const { data: allServices } = await supabase
        .from('services')
        .select('id, price');
      
      const priceMap = new Map(allServices?.map(s => [s.id, Number(s.price) || 0]) || []);
      
      // Calculate total revenue
      let totalRevenue = 0;
      bookings?.forEach(booking => {
        if (booking.service_id && priceMap.has(booking.service_id)) {
          totalRevenue += priceMap.get(booking.service_id) || 0;
        }
      });

      // Get business addresses for bookings
      const businessIds = [...new Set(bookings?.map(b => b.business_id) || [])];
      const { data: businessAddresses } = await supabase
        .from('businesses')
        .select('id, address, business_name')
        .in('id', businessIds.length > 0 ? businessIds : ['00000000-0000-0000-0000-000000000000']);

      const addressMap = new Map(businessAddresses?.map(b => [b.id, { address: b.address, name: b.business_name }]) || []);
      
      // Cache addresses
      addressMap.forEach((data, id) => {
        businessAddressCache.current.set(id, data.address);
      });

      const activityPoints: ActivityPoint[] = [];
      const arcData: ArcData[] = [];
      const regions = new Set<string>();

      // Add business signups
      businesses?.forEach((biz) => {
        const coords = extractLocationFromAddress(biz.address || 'UK');
        activityPoints.push({
          id: `biz-${biz.id}`,
          lat: coords.lat,
          lng: coords.lng,
          type: 'business',
          name: biz.business_name,
          timestamp: new Date(biz.created_at),
          businessId: biz.id,
          businessName: biz.business_name,
          address: biz.address || 'UK',
        });
        regions.add(biz.address?.split(',').pop()?.trim() || 'Unknown');
        businessAddressCache.current.set(biz.id, biz.address || 'UK');
        
        // Add arc from hub
        arcData.push({
          startLat: hubLat,
          startLng: hubLng,
          endLat: coords.lat,
          endLng: coords.lng,
          color: '#22c55e',
        });
      });

      // Add bookings
      bookings?.forEach((booking) => {
        const bizData = addressMap.get(booking.business_id);
        const address = bizData?.address || 'UK';
        const coords = extractLocationFromAddress(address);
        activityPoints.push({
          id: `book-${booking.id}`,
          lat: coords.lat,
          lng: coords.lng,
          type: 'booking',
          name: booking.customer_name,
          timestamp: new Date(booking.created_at),
          businessId: booking.business_id,
          businessName: bizData?.name || 'Unknown',
          address,
        });
        
        // Add arc from hub
        arcData.push({
          startLat: hubLat,
          startLng: hubLng,
          endLat: coords.lat,
          endLng: coords.lng,
          color: '#3b82f6',
        });
      });

      setActivities(activityPoints);
      setArcs(arcData.slice(0, 30)); // Limit arcs for performance
      setStats({
        totalBookings: bookings?.length || 0,
        totalBusinesses: businesses?.length || 0,
        activeRegions: regions.size,
        totalCalls: totalCalls || 0,
        totalRevenue,
      });
    } catch (error) {
      console.error('Error loading activity data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
  };

  return (
    <div className="space-y-4">
      {/* Stats Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className={`transition-all ${newActivityFlash === 'booking' ? 'ring-2 ring-blue-500' : ''}`}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              <span className="text-sm text-muted-foreground">Bookings</span>
            </div>
            <div className="text-2xl font-bold mt-1">{stats.totalBookings}</div>
          </CardContent>
        </Card>
        
        <Card className={`transition-all ${newActivityFlash === 'business' ? 'ring-2 ring-green-500' : ''}`}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-green-500" />
              <span className="text-sm text-muted-foreground">Businesses</span>
            </div>
            <div className="text-2xl font-bold mt-1">{stats.totalBusinesses}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-purple-500" />
              <span className="text-sm text-muted-foreground">Total Calls</span>
            </div>
            <div className="text-2xl font-bold mt-1">{stats.totalCalls}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-yellow-500" />
              <span className="text-sm text-muted-foreground">Revenue</span>
            </div>
            <div className="text-2xl font-bold mt-1">{formatCurrency(stats.totalRevenue)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-orange-500" />
              <span className="text-sm text-muted-foreground">Regions</span>
            </div>
            <div className="text-2xl font-bold mt-1">{stats.activeRegions}</div>
          </CardContent>
        </Card>
      </div>

      {/* Globe Container */}
      <div className="relative w-full h-[600px] bg-gradient-to-b from-slate-900 to-slate-800 rounded-lg border overflow-hidden">
        {/* Status indicator */}
        <div className="absolute top-4 left-4 z-10 bg-background/80 backdrop-blur-sm border rounded-lg px-4 py-2">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">Global Activity</h3>
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${
                realtimeStatus === 'connected' ? 'bg-green-500 animate-pulse' : 
                realtimeStatus === 'error' ? 'bg-red-500' : 'bg-yellow-500 animate-pulse'
              }`} />
              <span className="text-xs text-muted-foreground">
                {realtimeStatus === 'connected' ? 'Live' : realtimeStatus === 'error' ? 'Offline' : 'Connecting'}
              </span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Click on a point to view business details</p>
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
              <span>Businesses</span>
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
          <Globe
            ref={globeRef}
            globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
            bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
            backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
            
            // Points data
            pointsData={activities}
            pointLat="lat"
            pointLng="lng"
            pointColor={(d: any) => d.type === 'booking' ? '#3b82f6' : '#22c55e'}
            pointAltitude={0.01}
            pointRadius={0.5}
            pointLabel={(d: any) => `
              <div style="background: rgba(0,0,0,0.8); padding: 8px 12px; border-radius: 8px; color: white;">
                <div style="font-weight: bold;">${d.type === 'booking' ? '📅' : '🏢'} ${d.name}</div>
                <div style="font-size: 12px; opacity: 0.8;">${d.businessName}</div>
                <div style="font-size: 11px; opacity: 0.6;">Click for details</div>
              </div>
            `}
            onPointClick={handlePointClick}
            
            // Arcs data
            arcsData={arcs}
            arcStartLat="startLat"
            arcStartLng="startLng"
            arcEndLat="endLat"
            arcEndLng="endLng"
            arcColor="color"
            arcDashLength={0.5}
            arcDashGap={0.2}
            arcDashAnimateTime={2000}
            arcStroke={0.5}
            
            // Hub ring
            ringsData={[{ lat: hubLat, lng: hubLng }]}
            ringColor={() => '#a855f7'}
            ringMaxRadius={3}
            ringPropagationSpeed={2}
            ringRepeatPeriod={1000}
            
            width={typeof window !== 'undefined' ? window.innerWidth * 0.9 : 800}
            height={600}
          />
        )}
      </div>

      {/* Business Details Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {selectedBusiness?.business_name}
            </DialogTitle>
            <DialogDescription>Business performance overview</DialogDescription>
          </DialogHeader>
          
          {selectedBusiness && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant={selectedBusiness.status === 'approved' ? 'default' : 'secondary'}>
                  {selectedBusiness.status}
                </Badge>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{selectedBusiness.address}</span>
                </div>
                
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{selectedBusiness.main_phone}</span>
                </div>
                
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>Joined {format(new Date(selectedBusiness.created_at), 'PPP')}</span>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-3 pt-4 border-t">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{selectedBusiness.bookings_count}</div>
                  <div className="text-xs text-muted-foreground">Bookings</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-500">{selectedBusiness.calls_count}</div>
                  <div className="text-xs text-muted-foreground">Calls</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-500">{formatCurrency(selectedBusiness.revenue)}</div>
                  <div className="text-xs text-muted-foreground">Revenue</div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
