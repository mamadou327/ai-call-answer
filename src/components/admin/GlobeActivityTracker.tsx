import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, DollarSign, CalendarDays, MapPin, Building2, Clock, TrendingUp, Activity } from 'lucide-react';
import { format } from 'date-fns';

interface BusinessPoint {
  id: string;
  lat: number;
  lng: number;
  name: string;
  address: string;
  status: string;
  createdAt: Date;
  bookingsCount: number;
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

// UK Cities with coordinates
const ukCityCoordinates: Record<string, { lat: number; lng: number; region: string }> = {
  'london': { lat: 51.5074, lng: -0.1278, region: 'London' },
  'se1': { lat: 51.4975, lng: -0.0870, region: 'London' },
  'sw1': { lat: 51.4975, lng: -0.1357, region: 'London' },
  'e1': { lat: 51.5155, lng: -0.0722, region: 'London' },
  'w1': { lat: 51.5155, lng: -0.1460, region: 'London' },
  'n1': { lat: 51.5387, lng: -0.1027, region: 'London' },
  'manchester': { lat: 53.4808, lng: -2.2426, region: 'North West' },
  'birmingham': { lat: 52.4862, lng: -1.8904, region: 'West Midlands' },
  'leeds': { lat: 53.8008, lng: -1.5491, region: 'Yorkshire' },
  'liverpool': { lat: 53.4084, lng: -2.9916, region: 'North West' },
  'newcastle': { lat: 54.9783, lng: -1.6178, region: 'North East' },
  'bristol': { lat: 51.4545, lng: -2.5879, region: 'South West' },
  'sheffield': { lat: 53.3811, lng: -1.4701, region: 'Yorkshire' },
  'nottingham': { lat: 52.9548, lng: -1.1581, region: 'East Midlands' },
  'leicester': { lat: 52.6369, lng: -1.1398, region: 'East Midlands' },
  'coventry': { lat: 52.4068, lng: -1.5197, region: 'West Midlands' },
  'bradford': { lat: 53.7960, lng: -1.7594, region: 'Yorkshire' },
  'belfast': { lat: 54.5973, lng: -5.9301, region: 'Northern Ireland' },
  'glasgow': { lat: 55.8642, lng: -4.2518, region: 'Scotland' },
  'edinburgh': { lat: 55.9533, lng: -3.1883, region: 'Scotland' },
  'aberdeen': { lat: 57.1497, lng: -2.0943, region: 'Scotland' },
  'dundee': { lat: 56.4620, lng: -2.9707, region: 'Scotland' },
  'cardiff': { lat: 51.4816, lng: -3.1791, region: 'Wales' },
  'swansea': { lat: 51.6214, lng: -3.9436, region: 'Wales' },
  'newport': { lat: 51.5842, lng: -2.9977, region: 'Wales' },
  'southampton': { lat: 50.9097, lng: -1.4044, region: 'South East' },
  'portsmouth': { lat: 50.8198, lng: -1.0880, region: 'South East' },
  'brighton': { lat: 50.8225, lng: -0.1372, region: 'South East' },
  'reading': { lat: 51.4543, lng: -0.9781, region: 'South East' },
  'oxford': { lat: 51.7520, lng: -1.2577, region: 'South East' },
  'cambridge': { lat: 52.2053, lng: 0.1218, region: 'East' },
  'norwich': { lat: 52.6309, lng: 1.2974, region: 'East' },
  'plymouth': { lat: 50.3755, lng: -4.1427, region: 'South West' },
  'exeter': { lat: 50.7184, lng: -3.5339, region: 'South West' },
  'york': { lat: 53.9600, lng: -1.0873, region: 'Yorkshire' },
  'hull': { lat: 53.7676, lng: -0.3274, region: 'Yorkshire' },
};

function extractUKLocation(address: string): { lat: number; lng: number; region: string } {
  const lowerAddress = address.toLowerCase();
  
  for (const [key, coords] of Object.entries(ukCityCoordinates)) {
    if (lowerAddress.includes(key)) {
      return {
        lat: coords.lat + (Math.random() - 0.5) * 0.08,
        lng: coords.lng + (Math.random() - 0.5) * 0.08,
        region: coords.region,
      };
    }
  }
  
  // Default to central UK with randomness
  return {
    lat: 52.5 + (Math.random() - 0.5) * 4,
    lng: -1.5 + (Math.random() - 0.5) * 3,
    region: 'Unknown',
  };
}

export function GlobeActivityTracker() {
  const [businesses, setBusinesses] = useState<BusinessPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ 
    totalBookings: 0, 
    totalBusinesses: 0, 
    activeRegions: 0,
    totalCalls: 0,
    totalRevenue: 0 
  });
  const [regionStats, setRegionStats] = useState<Record<string, number>>({});
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [newActivityFlash, setNewActivityFlash] = useState<string | null>(null);
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessDetails | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const handleBusinessClick = useCallback(async (business: BusinessPoint) => {
    try {
      const { data: bizData } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', business.id)
        .maybeSingle();
      
      if (!bizData) {
        toast({ title: 'Error', description: 'Business not found', variant: 'destructive' });
        return;
      }

      const { count: bookingsCount } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', business.id);

      const { count: callsCount } = await supabase
        .from('calls_log')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', business.id);

      const { data: bookingsWithServices } = await supabase
        .from('bookings')
        .select('service_id')
        .eq('business_id', business.id)
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
        id: bizData.id,
        business_name: bizData.business_name,
        address: bizData.address,
        main_phone: bizData.main_phone,
        status: bizData.status,
        created_at: bizData.created_at,
        bookings_count: bookingsCount || 0,
        calls_count: callsCount || 0,
        revenue,
      });
      setDialogOpen(true);
    } catch (error) {
      console.error('Error fetching business details:', error);
      toast({ title: 'Error', description: 'Failed to load business details', variant: 'destructive' });
    }
  }, [toast]);

  const handleNewBooking = useCallback(async (payload: any) => {
    const booking = payload.new;
    
    setBusinesses(prev => prev.map(b => 
      b.id === booking.business_id 
        ? { ...b, bookingsCount: b.bookingsCount + 1 }
        : b
    ));
    
    setStats(prev => ({ ...prev, totalBookings: prev.totalBookings + 1 }));
    setNewActivityFlash('booking');
    
    toast({
      title: "📅 New Booking",
      description: `${booking.customer_name} just made a booking`,
    });
    
    setTimeout(() => setNewActivityFlash(null), 2000);
  }, [toast]);

  const handleNewBusiness = useCallback((payload: any) => {
    const business = payload.new;
    
    if (business.status !== 'approved') return;
    
    const location = extractUKLocation(business.address || '');
    const newBusiness: BusinessPoint = {
      id: business.id,
      lat: location.lat,
      lng: location.lng,
      name: business.business_name,
      address: business.address || '',
      status: business.status,
      createdAt: new Date(business.created_at),
      bookingsCount: 0,
    };
    
    setBusinesses(prev => [newBusiness, ...prev]);
    setStats(prev => ({ 
      ...prev, 
      totalBusinesses: prev.totalBusinesses + 1,
    }));
    setRegionStats(prev => ({
      ...prev,
      [location.region]: (prev[location.region] || 0) + 1,
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
    loadData();
    
    const channel = supabase
      .channel('uk-map-tracker')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bookings' }, handleNewBooking)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'businesses' }, handleNewBusiness)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'businesses' }, handleBusinessUpdate)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setRealtimeStatus('connected');
        else if (status === 'CHANNEL_ERROR') setRealtimeStatus('error');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [handleNewBooking, handleNewBusiness, handleBusinessUpdate]);

  const loadData = async () => {
    try {
      const { data: businessData } = await supabase
        .from('businesses')
        .select('id, business_name, address, created_at, status')
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      const { count: totalBookings } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true });

      const { count: totalCalls } = await supabase
        .from('calls_log')
        .select('*', { count: 'exact', head: true });

      // Get booking counts per business
      const { data: bookingCounts } = await supabase
        .from('bookings')
        .select('business_id');

      const bookingCountMap = new Map<string, number>();
      bookingCounts?.forEach(b => {
        bookingCountMap.set(b.business_id, (bookingCountMap.get(b.business_id) || 0) + 1);
      });

      // Get total revenue
      const { data: bookingsWithServices } = await supabase
        .from('bookings')
        .select('service_id')
        .not('service_id', 'is', null);

      const { data: allServices } = await supabase
        .from('services')
        .select('id, price');
      
      const priceMap = new Map(allServices?.map(s => [s.id, Number(s.price) || 0]) || []);
      
      let totalRevenue = 0;
      bookingsWithServices?.forEach(booking => {
        if (booking.service_id && priceMap.has(booking.service_id)) {
          totalRevenue += priceMap.get(booking.service_id) || 0;
        }
      });

      const businessPoints: BusinessPoint[] = [];
      const regions: Record<string, number> = {};

      businessData?.forEach((biz) => {
        const location = extractUKLocation(biz.address || '');
        const point: BusinessPoint = {
          id: biz.id,
          lat: location.lat,
          lng: location.lng,
          name: biz.business_name,
          address: biz.address || '',
          status: biz.status,
          createdAt: new Date(biz.created_at),
          bookingsCount: bookingCountMap.get(biz.id) || 0,
        };
        businessPoints.push(point);
        regions[location.region] = (regions[location.region] || 0) + 1;
      });

      setBusinesses(businessPoints);
      setRegionStats(regions);

      setStats({
        totalBookings: totalBookings || 0,
        totalBusinesses: businessData?.length || 0,
        activeRegions: Object.keys(regions).length,
        totalCalls: totalCalls || 0,
        totalRevenue,
      });
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
  };

  const topRegions = useMemo(() => 
    Object.entries(regionStats)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5),
    [regionStats]
  );

  // UK bounds for SVG viewBox
  const ukBounds = {
    minLat: 49.5,
    maxLat: 59,
    minLng: -8.5,
    maxLng: 2,
  };

  const latLngToXY = (lat: number, lng: number) => {
    const x = ((lng - ukBounds.minLng) / (ukBounds.maxLng - ukBounds.minLng)) * 400;
    const y = ((ukBounds.maxLat - lat) / (ukBounds.maxLat - ukBounds.minLat)) * 500;
    return { x, y };
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
              <Phone className="h-5 w-5 text-orange-500" />
              <span className="text-sm text-muted-foreground">Total Calls</span>
            </div>
            <div className="text-2xl font-bold mt-1">{stats.totalCalls}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-500" />
              <span className="text-sm text-muted-foreground">Revenue</span>
            </div>
            <div className="text-2xl font-bold mt-1">{formatCurrency(stats.totalRevenue)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-purple-500" />
              <span className="text-sm text-muted-foreground">Regions</span>
            </div>
            <div className="text-2xl font-bold mt-1">{stats.activeRegions}</div>
          </CardContent>
        </Card>
      </div>

      {/* Map and Region Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* SVG Map */}
        <Card className="lg:col-span-3 overflow-hidden">
          <CardContent className="p-4">
            <div className="relative h-[500px] bg-gradient-to-b from-blue-50 to-blue-100 dark:from-slate-900 dark:to-slate-800 rounded-lg overflow-hidden">
              {loading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Loading UK map...</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* SVG UK Map */}
                  <svg viewBox="0 0 400 500" className="w-full h-full">
                    {/* UK Outline (simplified) */}
                    <defs>
                      <linearGradient id="ukGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.1" />
                      </linearGradient>
                      <filter id="glow">
                        <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                        <feMerge>
                          <feMergeNode in="coloredBlur"/>
                          <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                      </filter>
                    </defs>
                    
                    {/* Simplified UK shape */}
                    <path
                      d="M 200 50 
                         Q 230 60 250 100 
                         Q 270 130 280 180
                         Q 290 220 285 260
                         Q 280 300 260 340
                         Q 250 370 240 390
                         Q 230 420 210 440
                         Q 190 460 170 450
                         Q 150 440 140 410
                         Q 130 380 135 340
                         Q 140 300 150 260
                         Q 145 220 140 180
                         Q 135 140 145 100
                         Q 160 60 200 50 Z"
                      fill="url(#ukGradient)"
                      stroke="hsl(var(--primary))"
                      strokeWidth="2"
                      opacity="0.5"
                    />
                    
                    {/* Scotland */}
                    <path
                      d="M 180 50 
                         Q 200 40 220 50
                         Q 240 60 250 90
                         Q 255 110 245 130
                         Q 230 140 210 135
                         Q 190 140 175 130
                         Q 165 115 170 90
                         Q 175 65 180 50 Z"
                      fill="url(#ukGradient)"
                      stroke="hsl(var(--primary))"
                      strokeWidth="1"
                      opacity="0.3"
                    />
                    
                    {/* Northern Ireland */}
                    <path
                      d="M 100 150 
                         Q 120 140 140 145
                         Q 150 155 145 175
                         Q 135 190 115 185
                         Q 95 180 100 150 Z"
                      fill="url(#ukGradient)"
                      stroke="hsl(var(--primary))"
                      strokeWidth="1"
                      opacity="0.3"
                    />
                    
                    {/* Business markers */}
                    {businesses.map((business) => {
                      const { x, y } = latLngToXY(business.lat, business.lng);
                      const hasBookings = business.bookingsCount > 0;
                      const size = hasBookings ? 8 : 6;
                      
                      return (
                        <g
                          key={business.id}
                          onClick={() => handleBusinessClick(business)}
                          style={{ cursor: 'pointer' }}
                        >
                          {/* Pulse animation for active businesses */}
                          {hasBookings && (
                            <circle
                              cx={x}
                              cy={y}
                              r={size + 4}
                              fill="none"
                              stroke="hsl(var(--primary))"
                              strokeWidth="2"
                              opacity="0.5"
                            >
                              <animate
                                attributeName="r"
                                from={size}
                                to={size + 12}
                                dur="2s"
                                repeatCount="indefinite"
                              />
                              <animate
                                attributeName="opacity"
                                from="0.5"
                                to="0"
                                dur="2s"
                                repeatCount="indefinite"
                              />
                            </circle>
                          )}
                          
                          {/* Main marker */}
                          <circle
                            cx={x}
                            cy={y}
                            r={size}
                            fill={hasBookings ? 'hsl(var(--primary))' : '#94a3b8'}
                            stroke="white"
                            strokeWidth="2"
                            filter={hasBookings ? 'url(#glow)' : undefined}
                          />
                          
                          {/* Hover tooltip */}
                          <title>{business.name} - {business.bookingsCount} bookings</title>
                        </g>
                      );
                    })}
                    
                    {/* Major city labels */}
                    {[
                      { name: 'London', lat: 51.5074, lng: -0.1278 },
                      { name: 'Manchester', lat: 53.4808, lng: -2.2426 },
                      { name: 'Birmingham', lat: 52.4862, lng: -1.8904 },
                      { name: 'Edinburgh', lat: 55.9533, lng: -3.1883 },
                      { name: 'Cardiff', lat: 51.4816, lng: -3.1791 },
                      { name: 'Belfast', lat: 54.5973, lng: -5.9301 },
                    ].map((city) => {
                      const { x, y } = latLngToXY(city.lat, city.lng);
                      return (
                        <text
                          key={city.name}
                          x={x}
                          y={y - 12}
                          textAnchor="middle"
                          className="fill-muted-foreground text-[8px] font-medium pointer-events-none"
                        >
                          {city.name}
                        </text>
                      );
                    })}
                  </svg>
                  
                  {/* Realtime indicator */}
                  <div className="absolute top-4 right-4">
                    <Badge 
                      variant={realtimeStatus === 'connected' ? 'default' : realtimeStatus === 'error' ? 'destructive' : 'secondary'}
                      className="flex items-center gap-1"
                    >
                      <Activity className="h-3 w-3" />
                      {realtimeStatus === 'connected' ? 'Live' : realtimeStatus === 'error' ? 'Error' : 'Connecting...'}
                    </Badge>
                  </div>
                  
                  {/* Legend */}
                  <div className="absolute bottom-4 left-4 bg-background/80 backdrop-blur-sm rounded-lg p-3 text-xs space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-primary" />
                      <span>Active (has bookings)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-slate-400" />
                      <span>Registered</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Regional Stats */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span className="font-semibold">Top Regions</span>
            </div>
            <div className="space-y-3">
              {topRegions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No regional data yet</p>
              ) : (
                topRegions.map(([region, count], index) => (
                  <div key={region} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-muted-foreground w-4">{index + 1}.</span>
                      <span className="text-sm">{region}</span>
                    </div>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                ))
              )}
            </div>
            
            <div className="mt-6 pt-4 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Regions</span>
                <span className="font-semibold">{stats.activeRegions}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Business Details Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {selectedBusiness?.business_name}
            </DialogTitle>
            <DialogDescription>Business details and statistics</DialogDescription>
          </DialogHeader>
          
          {selectedBusiness && (
            <div className="space-y-4">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-1 text-muted-foreground" />
                <span className="text-sm">{selectedBusiness.address}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{selectedBusiness.main_phone}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Joined {format(new Date(selectedBusiness.created_at), 'PPP')}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Badge variant={selectedBusiness.status === 'approved' ? 'default' : 'secondary'}>
                  {selectedBusiness.status}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{selectedBusiness.bookings_count}</div>
                  <div className="text-xs text-muted-foreground">Bookings</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-500">{selectedBusiness.calls_count}</div>
                  <div className="text-xs text-muted-foreground">Calls</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-emerald-500">{formatCurrency(selectedBusiness.revenue)}</div>
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
