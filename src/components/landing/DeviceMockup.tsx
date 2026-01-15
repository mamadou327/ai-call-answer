const DeviceMockup = () => {
  return (
    <div className="relative w-full max-w-7xl mx-auto mt-16 px-4">
      {/* Laptop/Desktop Frame - Main Device */}
      <div className="relative animate-float">
        {/* Screen Bezel */}
        <div className="bg-[#1a1a1a] rounded-t-2xl p-3 shadow-2xl">
          {/* Screen */}
          <div className="relative bg-muted rounded-lg overflow-hidden shadow-inner">
            {/* Browser Chrome */}
            <div className="bg-[#2a2a2a] px-4 py-2.5 flex items-center gap-3">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-[#ff5f57] shadow-sm" />
                <div className="w-3 h-3 rounded-full bg-[#ffbd2e] shadow-sm" />
                <div className="w-3 h-3 rounded-full bg-[#28ca41] shadow-sm" />
              </div>
              <div className="flex-1 mx-4">
                <div className="bg-[#3a3a3a] rounded-md px-4 py-1.5 text-xs text-gray-400 font-mono flex items-center gap-2">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  dashboard.aivia.app
                </div>
              </div>
              <div className="flex gap-2">
                <div className="w-4 h-4 rounded bg-[#3a3a3a]" />
                <div className="w-4 h-4 rounded bg-[#3a3a3a]" />
              </div>
            </div>
            
            {/* Dashboard Content */}
            <div className="bg-background p-5 md:p-8 min-h-[380px] md:min-h-[480px]">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                    <span className="text-primary-foreground font-bold text-sm">A</span>
                  </div>
                  <span className="font-bold text-base md:text-lg">AIVIA Dashboard</span>
                </div>
                <div className="flex gap-2">
                  <div className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium shadow-sm">Bookings</div>
                  <div className="px-4 py-2 bg-muted rounded-lg text-xs font-medium hidden sm:block">Calls</div>
                  <div className="px-4 py-2 bg-muted rounded-lg text-xs font-medium hidden md:block">Settings</div>
                </div>
              </div>
              
              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-4 md:gap-6 mb-6">
                <div className="bg-card border border-border rounded-xl p-4 md:p-5 shadow-sm">
                  <div className="text-xs text-muted-foreground mb-2">Today's Calls</div>
                  <div className="text-2xl md:text-3xl font-bold">127</div>
                  <div className="text-xs text-green-500 mt-2 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                    23%
                  </div>
                </div>
                <div className="bg-card border border-border rounded-xl p-4 md:p-5 shadow-sm">
                  <div className="text-xs text-muted-foreground mb-2">Revenue</div>
                  <div className="text-2xl md:text-3xl font-bold">£2.4k</div>
                  <div className="text-xs text-green-500 mt-2 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                    18%
                  </div>
                </div>
                <div className="bg-card border border-border rounded-xl p-4 md:p-5 shadow-sm">
                  <div className="text-xs text-muted-foreground mb-2">Answered</div>
                  <div className="text-2xl md:text-3xl font-bold">95%</div>
                  <div className="text-xs text-green-500 mt-2 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                    12%
                  </div>
                </div>
              </div>
              
              {/* Chart */}
              <div className="bg-card border border-border rounded-xl p-5 h-24 md:h-28 flex items-end gap-1.5">
                {[40, 65, 45, 80, 55, 70, 90, 60, 75, 85, 50, 95].map((height, i) => (
                  <div 
                    key={i} 
                    className="flex-1 bg-primary/80 rounded-t transition-all hover:bg-primary"
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
        
        {/* Laptop Base / Stand */}
        <div className="relative">
          {/* Hinge */}
          <div className="h-3 bg-gradient-to-b from-[#2a2a2a] to-[#1a1a1a] rounded-b-sm" />
          {/* Base */}
          <div className="h-5 bg-gradient-to-b from-[#3a3a3a] to-[#2a2a2a] rounded-b-xl mx-8 shadow-lg" />
          {/* Bottom edge */}
          <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-1/3 h-1 bg-[#4a4a4a] rounded-b" />
        </div>
        
        {/* Reflection effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-2xl pointer-events-none" />
      </div>
      
      {/* Phone Frame - Floating overlay on the laptop */}
      <div className="absolute right-8 md:right-16 lg:right-24 -bottom-4 md:bottom-4 w-28 md:w-36 lg:w-40 animate-float-delayed z-20 drop-shadow-2xl">
        {/* Phone Body */}
        <div className="bg-[#1a1a1a] rounded-[2rem] p-2 shadow-2xl ring-1 ring-white/10">
          {/* Phone Screen */}
          <div className="bg-background rounded-[1.5rem] overflow-hidden">
            {/* Dynamic Island / Notch */}
            <div className="h-7 bg-background flex justify-center items-center pt-2">
              <div className="w-16 h-4 bg-[#1a1a1a] rounded-full flex items-center justify-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#2a2a2a]" />
                <div className="w-1 h-1 rounded-full bg-[#3a3a3a]" />
              </div>
            </div>
            
            {/* Phone Content */}
            <div className="p-2.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold">AIVIA</div>
                <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-primary-foreground text-[7px] font-bold">A</span>
                </div>
              </div>
              
              {/* Mini Stats */}
              <div className="grid grid-cols-2 gap-1.5">
                <div className="bg-card border border-border rounded-lg p-1.5">
                  <div className="text-[7px] text-muted-foreground">Calls</div>
                  <div className="text-xs font-bold">127</div>
                  <div className="text-[6px] text-green-500">↑ 23%</div>
                </div>
                <div className="bg-card border border-border rounded-lg p-1.5">
                  <div className="text-[7px] text-muted-foreground">Revenue</div>
                  <div className="text-xs font-bold">£2.4k</div>
                  <div className="text-[6px] text-green-500">↑ 18%</div>
                </div>
              </div>
              
              {/* Mini Chart */}
              <div className="bg-card border border-border rounded-lg p-1.5 h-10 flex items-end gap-0.5">
                {[40, 65, 80, 55, 90, 60, 75].map((height, i) => (
                  <div 
                    key={i} 
                    className="flex-1 bg-primary/80 rounded-t"
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
              
              {/* Booking Preview */}
              <div className="bg-card border border-border rounded-lg p-1.5">
                <div className="text-[7px] text-muted-foreground">Next Booking</div>
                <div className="text-[9px] font-medium">Sarah M. - 2:30 PM</div>
                <div className="text-[7px] text-muted-foreground mt-0.5">Haircut & Style</div>
              </div>
              
              {/* Bottom nav hint */}
              <div className="flex justify-center pt-1">
                <div className="w-16 h-1 bg-foreground/20 rounded-full" />
              </div>
            </div>
          </div>
        </div>
        
        {/* Phone side buttons */}
        <div className="absolute -left-0.5 top-16 w-0.5 h-6 bg-[#2a2a2a] rounded-l" />
        <div className="absolute -left-0.5 top-24 w-0.5 h-10 bg-[#2a2a2a] rounded-l" />
        <div className="absolute -right-0.5 top-20 w-0.5 h-8 bg-[#2a2a2a] rounded-r" />
      </div>
    </div>
  );
};

export default DeviceMockup;
