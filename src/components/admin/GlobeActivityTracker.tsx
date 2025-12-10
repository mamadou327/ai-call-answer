import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
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
  callsCount: number;
  revenue: number;
  phone: string;
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
  const [hoveredBusiness, setHoveredBusiness] = useState<BusinessPoint | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const { toast } = useToast();

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
      callsCount: 0,
      revenue: 0,
      phone: business.main_phone || '',
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
        .select('id, business_name, address, created_at, status, main_phone')
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

      // Get call counts per business
      const { data: callCounts } = await supabase
        .from('calls_log')
        .select('business_id');

      const callCountMap = new Map<string, number>();
      callCounts?.forEach(c => {
        callCountMap.set(c.business_id, (callCountMap.get(c.business_id) || 0) + 1);
      });

      // Get bookings with services for revenue
      const { data: bookingsWithServices } = await supabase
        .from('bookings')
        .select('business_id, service_id')
        .not('service_id', 'is', null);

      const { data: allServices } = await supabase
        .from('services')
        .select('id, price');
      
      const priceMap = new Map(allServices?.map(s => [s.id, Number(s.price) || 0]) || []);
      
      // Calculate revenue per business
      const revenueMap = new Map<string, number>();
      let totalRevenue = 0;
      bookingsWithServices?.forEach(booking => {
        if (booking.service_id && priceMap.has(booking.service_id)) {
          const price = priceMap.get(booking.service_id) || 0;
          totalRevenue += price;
          revenueMap.set(booking.business_id, (revenueMap.get(booking.business_id) || 0) + price);
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
          callsCount: callCountMap.get(biz.id) || 0,
          revenue: revenueMap.get(biz.id) || 0,
          phone: biz.main_phone || '',
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

  // UK bounds for SVG viewBox (adjusted for proper UK shape)
  const ukBounds = {
    minLat: 49.5,
    maxLat: 59,
    minLng: -10.5,
    maxLng: 2,
  };

  const latLngToXY = (lat: number, lng: number) => {
    const x = ((lng - ukBounds.minLng) / (ukBounds.maxLng - ukBounds.minLng)) * 500;
    const y = ((ukBounds.maxLat - lat) / (ukBounds.maxLat - ukBounds.minLat)) * 700;
    return { x, y };
  };

  const handleMouseEnter = (business: BusinessPoint, event: React.MouseEvent<SVGGElement>) => {
    const svgRect = (event.currentTarget.closest('svg') as SVGElement)?.getBoundingClientRect();
    const containerRect = (event.currentTarget.closest('.map-container') as HTMLElement)?.getBoundingClientRect();
    
    if (svgRect && containerRect) {
      const { x, y } = latLngToXY(business.lat, business.lng);
      const scaleX = svgRect.width / 500;
      const scaleY = svgRect.height / 700;
      
      setTooltipPosition({
        x: x * scaleX + (svgRect.left - containerRect.left),
        y: y * scaleY + (svgRect.top - containerRect.top),
      });
    }
    setHoveredBusiness(business);
  };

  const handleMouseLeave = () => {
    setHoveredBusiness(null);
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
            <div className="map-container relative h-[500px] bg-gradient-to-b from-sky-100 to-sky-200 dark:from-slate-900 dark:to-slate-800 rounded-lg overflow-hidden">
              {loading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Loading UK map...</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* SVG UK Map - Accurate representation */}
                  <svg viewBox="0 0 500 700" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
                    {/* Defs for gradients and filters */}
                    <defs>
                      <linearGradient id="landGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#4ade80" />
                        <stop offset="100%" stopColor="#22c55e" />
                      </linearGradient>
                      <linearGradient id="scotlandGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#34d399" />
                        <stop offset="100%" stopColor="#10b981" />
                      </linearGradient>
                      <linearGradient id="walesGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#22c55e" />
                        <stop offset="100%" stopColor="#16a34a" />
                      </linearGradient>
                      <linearGradient id="niGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#4ade80" />
                        <stop offset="100%" stopColor="#22c55e" />
                      </linearGradient>
                      <linearGradient id="irelandGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#86efac" />
                        <stop offset="100%" stopColor="#4ade80" />
                      </linearGradient>
                      <filter id="glow">
                        <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                        <feMerge>
                          <feMergeNode in="coloredBlur"/>
                          <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                      </filter>
                      <filter id="shadow">
                        <feDropShadow dx="1" dy="2" stdDeviation="2" floodOpacity="0.2"/>
                      </filter>
                    </defs>
                    
                    {/* Republic of Ireland - background, lighter */}
                    <path
                      d="M 95 280 
                         C 85 260, 90 235, 100 215
                         C 108 200, 120 190, 135 185
                         C 150 180, 165 182, 175 190
                         C 182 195, 185 205, 182 215
                         C 180 225, 172 232, 170 245
                         C 170 260, 178 275, 175 290
                         C 172 305, 162 320, 148 335
                         C 135 348, 118 355, 100 350
                         C 85 345, 75 330, 72 310
                         C 70 295, 78 282, 95 280 Z"
                      fill="url(#irelandGradient)"
                      stroke="#166534"
                      strokeWidth="1"
                      opacity="0.7"
                      filter="url(#shadow)"
                    />
                    
                    {/* Northern Ireland */}
                    <path
                      d="M 155 200
                         C 170 195, 188 198, 200 208
                         C 210 216, 215 228, 210 240
                         C 205 250, 192 255, 178 252
                         C 165 250, 155 240, 152 228
                         C 148 215, 150 205, 155 200 Z"
                      fill="url(#niGradient)"
                      stroke="#166534"
                      strokeWidth="1.5"
                      filter="url(#shadow)"
                    />
                    
                    {/* Scotland - main landmass */}
                    <path
                      d="M 270 60
                         C 290 55, 315 60, 335 75
                         C 355 90, 368 115, 375 145
                         C 382 175, 380 205, 370 235
                         C 362 260, 348 280, 328 295
                         C 312 308, 292 315, 272 318
                         C 258 320, 245 318, 235 312
                         C 225 305, 220 295, 222 282
                         C 225 268, 238 258, 245 245
                         C 248 235, 242 225, 235 218
                         C 225 208, 212 205, 205 195
                         C 198 185, 198 172, 205 160
                         C 212 148, 225 140, 235 135
                         C 242 132, 248 138, 255 135
                         C 260 130, 258 118, 255 108
                         C 250 95, 255 78, 270 60 Z"
                      fill="url(#scotlandGradient)"
                      stroke="#166534"
                      strokeWidth="1.5"
                      filter="url(#shadow)"
                    />
                    
                    {/* Scotland - Highlands bump */}
                    <path
                      d="M 225 85
                         C 235 78, 250 80, 258 90
                         C 265 100, 262 115, 252 122
                         C 242 128, 228 125, 222 115
                         C 215 105, 218 92, 225 85 Z"
                      fill="url(#scotlandGradient)"
                      stroke="#166534"
                      strokeWidth="1"
                    />
                    
                    {/* Outer Hebrides */}
                    <path
                      d="M 180 100
                         C 185 90, 195 88, 202 95
                         C 208 102, 208 115, 202 125
                         C 196 135, 185 140, 178 135
                         C 172 128, 175 110, 180 100 Z"
                      fill="url(#scotlandGradient)"
                      stroke="#166534"
                      strokeWidth="1"
                      opacity="0.9"
                    />
                    
                    {/* Shetland Islands - small group */}
                    <g transform="translate(380, 25)">
                      <circle cx="0" cy="0" r="8" fill="url(#scotlandGradient)" stroke="#166534" strokeWidth="1" />
                      <circle cx="12" cy="5" r="5" fill="url(#scotlandGradient)" stroke="#166534" strokeWidth="1" />
                      <circle cx="-5" cy="12" r="4" fill="url(#scotlandGradient)" stroke="#166534" strokeWidth="1" />
                    </g>
                    
                    {/* Orkney Islands */}
                    <g transform="translate(335, 55)">
                      <ellipse cx="0" cy="0" rx="12" ry="8" fill="url(#scotlandGradient)" stroke="#166534" strokeWidth="1" />
                      <circle cx="15" cy="-5" r="5" fill="url(#scotlandGradient)" stroke="#166534" strokeWidth="1" />
                    </g>
                    
                    {/* England - main landmass */}
                    <path
                      d="M 272 318
                         C 295 312, 320 318, 345 335
                         C 368 350, 388 375, 400 405
                         C 412 435, 415 468, 408 500
                         C 402 530, 388 558, 368 580
                         C 350 600, 328 615, 305 622
                         C 285 628, 265 628, 248 620
                         C 235 614, 228 602, 225 588
                         C 222 575, 228 562, 238 550
                         C 248 538, 262 530, 268 518
                         C 272 508, 265 498, 255 490
                         C 242 480, 225 475, 218 462
                         C 210 448, 215 432, 225 420
                         C 232 410, 242 405, 245 395
                         C 248 385, 242 375, 235 368
                         C 225 358, 212 355, 210 345
                         C 208 335, 218 325, 232 320
                         C 248 315, 262 318, 272 318 Z"
                      fill="url(#landGradient)"
                      stroke="#166534"
                      strokeWidth="1.5"
                      filter="url(#shadow)"
                    />
                    
                    {/* East Anglia bulge */}
                    <path
                      d="M 400 405
                         C 418 400, 435 410, 445 425
                         C 452 438, 450 455, 440 465
                         C 430 475, 415 478, 405 472
                         C 395 465, 395 450, 400 435
                         C 402 422, 400 410, 400 405 Z"
                      fill="url(#landGradient)"
                      stroke="#166534"
                      strokeWidth="1"
                    />
                    
                    {/* Wales */}
                    <path
                      d="M 218 450
                         C 235 445, 248 455, 255 470
                         C 260 485, 258 502, 248 518
                         C 240 532, 228 542, 212 545
                         C 198 548, 182 542, 172 530
                         C 165 520, 165 505, 175 492
                         C 185 478, 200 465, 218 450 Z"
                      fill="url(#walesGradient)"
                      stroke="#166534"
                      strokeWidth="1.5"
                      filter="url(#shadow)"
                    />
                    
                    {/* Cornwall peninsula */}
                    <path
                      d="M 225 588
                         C 210 592, 190 590, 172 582
                         C 155 575, 140 562, 135 548
                         C 132 538, 140 530, 155 528
                         C 172 526, 192 535, 208 548
                         C 222 560, 232 575, 225 588 Z"
                      fill="url(#landGradient)"
                      stroke="#166534"
                      strokeWidth="1"
                    />
                    
                    {/* Isle of Wight */}
                    <ellipse cx="348" cy="610" rx="15" ry="8" fill="url(#landGradient)" stroke="#166534" strokeWidth="1" />
                    
                    {/* Isle of Man */}
                    <ellipse cx="215" cy="340" rx="12" ry="15" fill="url(#landGradient)" stroke="#166534" strokeWidth="1" />
                    
                    {/* Anglesey */}
                    <ellipse cx="185" cy="425" rx="18" ry="12" fill="url(#walesGradient)" stroke="#166534" strokeWidth="1" />
                    
                    {/* Region Labels */}
                    <text x="305" y="180" textAnchor="middle" className="fill-white text-[14px] font-bold" style={{ textShadow: '1px 1px 3px rgba(0,0,0,0.6)' }}>Scotland</text>
                    <text x="180" y="225" textAnchor="middle" className="fill-white text-[10px] font-medium" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}>N. Ireland</text>
                    <text x="125" y="295" textAnchor="middle" className="fill-white/80 text-[11px] font-medium" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}>Ireland</text>
                    <text x="330" y="470" textAnchor="middle" className="fill-white text-[14px] font-bold" style={{ textShadow: '1px 1px 3px rgba(0,0,0,0.6)' }}>England</text>
                    <text x="205" y="500" textAnchor="middle" className="fill-white text-[12px] font-semibold" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}>Wales</text>
                    
                    {/* Major city markers (small dots) */}
                    {[
                      { name: 'London', x: 380, y: 540 },
                      { name: 'Manchester', x: 280, y: 410 },
                      { name: 'Birmingham', x: 305, y: 465 },
                      { name: 'Edinburgh', x: 295, y: 285 },
                      { name: 'Cardiff', x: 238, y: 530 },
                      { name: 'Belfast', x: 178, y: 225 },
                      { name: 'Glasgow', x: 265, y: 295 },
                      { name: 'Liverpool', x: 255, y: 415 },
                      { name: 'Leeds', x: 315, y: 400 },
                      { name: 'Bristol', x: 275, y: 535 },
                      { name: 'Newcastle', x: 320, y: 355 },
                      { name: 'Aberdeen', x: 345, y: 195 },
                    ].map((city) => (
                      <g key={city.name}>
                        <circle
                          cx={city.x}
                          cy={city.y}
                          r="4"
                          fill="#1f2937"
                          stroke="white"
                          strokeWidth="1.5"
                        />
                        <text
                          x={city.x}
                          y={city.y - 10}
                          textAnchor="middle"
                          className="fill-slate-700 dark:fill-slate-300 text-[9px] font-medium pointer-events-none"
                        >
                          {city.name}
                        </text>
                      </g>
                    ))}
                    
                    {/* Business markers */}
                    {businesses.map((business) => {
                      // Convert lat/lng to SVG coordinates for new viewBox
                      const x = ((business.lng - (-10.5)) / (2 - (-10.5))) * 500;
                      const y = ((59 - business.lat) / (59 - 49.5)) * 700;
                      const hasBookings = business.bookingsCount > 0;
                      const size = hasBookings ? 12 : 8;
                      
                      return (
                        <g
                          key={business.id}
                          onMouseEnter={(e) => handleMouseEnter(business, e)}
                          onMouseLeave={handleMouseLeave}
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
                                to={size + 18}
                                dur="2s"
                                repeatCount="indefinite"
                              />
                              <animate
                                attributeName="opacity"
                                from="0.6"
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
                            fill={hasBookings ? 'hsl(var(--primary))' : '#64748b'}
                            stroke="white"
                            strokeWidth="2.5"
                            filter={hasBookings ? 'url(#glow)' : undefined}
                          />
                          
                          {/* Inner dot */}
                          <circle
                            cx={x}
                            cy={y}
                            r={size / 3}
                            fill="white"
                            opacity="0.8"
                          />
                        </g>
                      );
                    })}
                  </svg>
                  
                  {/* Hover Tooltip */}
                  {hoveredBusiness && (
                    <div 
                      className="absolute z-50 pointer-events-none"
                      style={{
                        left: tooltipPosition.x,
                        top: tooltipPosition.y,
                        transform: 'translate(-50%, -100%) translateY(-15px)',
                      }}
                    >
                      <div className="bg-background border border-border rounded-lg shadow-xl p-4 min-w-[280px]">
                        <div className="flex items-center gap-2 mb-3">
                          <Building2 className="h-5 w-5 text-primary" />
                          <span className="font-semibold text-foreground">{hoveredBusiness.name}</span>
                        </div>
                        
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="h-4 w-4" />
                            <span>{hoveredBusiness.address}</span>
                          </div>
                          
                          {hoveredBusiness.phone && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Phone className="h-4 w-4" />
                              <span>{hoveredBusiness.phone}</span>
                            </div>
                          )}
                          
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span>Joined {format(hoveredBusiness.createdAt, 'PPP')}</span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-border">
                          <div className="text-center">
                            <div className="text-lg font-bold text-primary">{hoveredBusiness.bookingsCount}</div>
                            <div className="text-xs text-muted-foreground">Bookings</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-orange-500">{hoveredBusiness.callsCount}</div>
                            <div className="text-xs text-muted-foreground">Calls</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-emerald-500">{formatCurrency(hoveredBusiness.revenue)}</div>
                            <div className="text-xs text-muted-foreground">Revenue</div>
                          </div>
                        </div>
                        
                        {/* Tooltip arrow */}
                        <div className="absolute left-1/2 bottom-0 transform -translate-x-1/2 translate-y-full">
                          <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-background" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.1))' }} />
                        </div>
                      </div>
                    </div>
                  )}
                  
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
                  <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur-sm rounded-lg p-3 text-xs space-y-2 shadow-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-primary border-2 border-white shadow" />
                      <span>Active (has bookings)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-slate-500 border-2 border-white shadow" />
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
    </div>
  );
}
